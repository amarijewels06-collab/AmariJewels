import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { requireUser } from "@/server/auth/session";
import { errorResponse, ok, readJson } from "@/server/http";
import { presignReadUrl } from "@/server/storage/s3";

export const runtime = "nodejs";

const schema = z.object({
  designNos: z.array(z.string().trim().min(1)).min(1).max(100),
});

/**
 * POST /api/designs/images-by-design-nos
 * Body: { designNos: ["DES-001", "DES-002", ...] }
 * Returns: { images: { "DES-001": "https://presigned-url...", ... } }
 *
 * For each design number, returns the presigned read URL
 * for its primary image (or first available image).
 */
export async function POST(req: NextRequest) {
  try {
    await requireUser(req);
    const body = schema.parse(await readJson(req));

    // Find all designs with their primary images in one query
    const designs = await prisma.design.findMany({
      where: {
        designNo: { in: body.designNos },
        deletedAt: null,
      },
      select: {
        designNo: true,
        images: {
          orderBy: { isPrimary: "desc" },
          take: 1,
          select: { objectKey: true },
        },
      },
    });

    // Build a map of designNo → presigned URL
    const imageMap: Record<string, string> = {};

    await Promise.all(
      designs.map(async (design) => {
        if (!design.designNo || design.images.length === 0) return;
        const objectKey = design.images[0].objectKey;
        try {
          const url = await presignReadUrl(objectKey);
          imageMap[design.designNo] = url;
        } catch {
          // Skip if presigning fails for this design
        }
      })
    );

    return ok({ images: imageMap });
  } catch (error) {
    return errorResponse(error);
  }
}
