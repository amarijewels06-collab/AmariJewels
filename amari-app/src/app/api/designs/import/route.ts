import { type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireRole } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { errorResponse, ok, readJson } from "@/server/http";

export const runtime = "nodejs";

type ImportDesignRow = {
  designNo?: string;
  designDate?: string;
  categoryName?: string;
  subCategoryName?: string;
  metalQuality?: string;
  grossWeight?: number | string;
  diamondWeight?: number | string;
  diamondPieces?: number;
  stoneWeight?: number | string;
  stonePieces?: number;
  diamondSizes?: (string | { size: string; quantity: number })[];
  diamondColor?: string;
  diamondQuality?: string;
  remarks?: string;
  status?: "ACTIVE" | "INACTIVE";
};

// Purity mapping matching the client
const purityMapping: Record<string, number> = {
  "24KT": 1.0,
  "22KT": 0.916,
  "18KT": 0.76,
  "14KT": 0.6,
  "10KT": 0.42,
  "9KT": 0.4,
  "24K": 1.0,
  "22K": 0.916,
  "18K": 0.76,
};

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    requireRole(user, "STAFF");

    const payload = await readJson<ImportDesignRow[]>(req);
    if (!Array.isArray(payload)) {
      throw Object.assign(new Error("Invalid payload: expected an array of designs"), { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent") || null;

    const result = await prisma.$transaction(async (tx) => {
      // Fetch current active categories and subcategories for resolution cache
      const categories = await tx.category.findMany({ where: { deletedAt: null } });
      const subCategories = await tx.subCategory.findMany({ where: { deletedAt: null } });

      let createdCount = 0;
      let updatedCount = 0;
      let newCategoriesCount = 0;
      let newSubCategoriesCount = 0;

      // Helper function to resolve category by name/code, creating it if missing
      async function resolveCategory(name: string) {
        const cleanName = name.trim();
        if (!cleanName) return null;

        let cat = categories.find(
          (c) =>
            c.name?.toLowerCase() === cleanName.toLowerCase() ||
            c.code?.toLowerCase() === cleanName.toLowerCase()
        );

        if (!cat) {
          const count = await tx.category.count();
          const code = `CAT-${String(count + 1).padStart(6, "0")}`;
          cat = await tx.category.create({
            data: {
              code,
              name: cleanName,
              status: "ACTIVE",
            },
          });
          categories.push(cat);
          newCategoriesCount++;
        }
        return cat;
      }

      // Helper function to resolve subcategory under category by name/code, creating if missing
      async function resolveSubCategory(categoryId: string, name: string) {
        const cleanName = name.trim();
        if (!cleanName) return null;

        let sub = subCategories.find(
          (s) =>
            s.categoryId === categoryId &&
            (s.name?.toLowerCase() === cleanName.toLowerCase() ||
              s.code?.toLowerCase() === cleanName.toLowerCase())
        );

        if (!sub) {
          const count = await tx.subCategory.count();
          const code = `SUB-${String(count + 1).padStart(6, "0")}`;
          sub = await tx.subCategory.create({
            data: {
              categoryId,
              code,
              name: cleanName,
              status: "ACTIVE",
            },
          });
          subCategories.push(sub);
          newSubCategoriesCount++;
        }
        return sub;
      }

      for (const row of payload) {
        let categoryId: string | null = null;
        let subCategoryId: string | null = null;

        if (row.categoryName) {
          const cat = await resolveCategory(row.categoryName);
          if (cat) {
            categoryId = cat.id;
            if (row.subCategoryName) {
              const sub = await resolveSubCategory(cat.id, row.subCategoryName);
              if (sub) {
                subCategoryId = sub.id;
              }
            }
          }
        }

        // Determine Design Number
        let designNo = row.designNo?.trim() || "";
        if (!designNo) {
          const count = await tx.design.count();
          designNo = `DES-${String(count + 1).padStart(6, "0")}`;
        }

        // Parse weights & counts
        const grossWeight = Number(row.grossWeight) || 0;
        const diamondWeight = Number(row.diamondWeight) || 0;
        const stoneWeight = Number(row.stoneWeight) || 0;
        const diamondGram = diamondWeight * 0.2;
        const stoneGram = stoneWeight * 0.2;
        const netWeight = Math.max(0, grossWeight - diamondGram - stoneGram);

        const metalQuality = row.metalQuality || "18KT";
        const purity = purityMapping[metalQuality] || 0;
        const pureWeight = netWeight * purity;

        // Normalize diamond sizes: map from string arrays or size/qty objects to client's format 'size:quantity'
        const diamondSizes = Array.isArray(row.diamondSizes)
          ? row.diamondSizes
              .map((s) => {
                if (typeof s === "string") return s;
                if (typeof s === "object" && s !== null && "size" in s) {
                  return `${s.size}:${s.quantity || 0}`;
                }
                return "";
              })
              .filter(Boolean)
          : [];

        // Check if designNo already exists
        const existing = await tx.design.findFirst({
          where: { designNo, deletedAt: null },
          include: { images: true },
        });

        const designData = {
          designNo,
          designDate: row.designDate ? new Date(row.designDate) : new Date(),
          categoryId,
          subCategoryId,
          metalQuality,
          grossWeight,
          netWeight,
          diamondWeight,
          diamondPieces: Number(row.diamondPieces) || 0,
          diamondSizes: diamondSizes.length ? diamondSizes : undefined,
          stoneWeight,
          stonePieces: Number(row.stonePieces) || 0,
          diamondColor: row.diamondColor || null,
          diamondQuality: row.diamondQuality || null,
          remarks: row.remarks || null,
          status: row.status || "ACTIVE",
          updatedById: user.id,
        };

        if (existing) {
          // Update existing design
          const updated = await tx.design.update({
            where: { id: existing.id },
            data: designData,
          });

          await tx.auditLog.create({
            data: {
              userId: user.id,
              entityType: "Design",
              entityId: existing.id,
              action: "UPDATE",
              oldValues: JSON.parse(JSON.stringify(existing)),
              newValues: JSON.parse(JSON.stringify(updated)),
              ipAddress: ip,
              userAgent,
            },
          });
          updatedCount++;
        } else {
          // Create new design
          const created = await tx.design.create({
            data: {
              ...designData,
              createdById: user.id,
            },
          });

          await tx.auditLog.create({
            data: {
              userId: user.id,
              entityType: "Design",
              entityId: created.id,
              action: "CREATE",
              newValues: JSON.parse(JSON.stringify(created)),
              ipAddress: ip,
              userAgent,
            },
          });
          createdCount++;
        }
      }

      return {
        createdCount,
        updatedCount,
        newCategoriesCount,
        newSubCategoriesCount,
      };
    });

    return ok({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
