import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { errorResponse, ok } from "@/server/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);
    const [
      totalCustomers,
      totalSuppliers,
      totalDesigns,
      totalStockItems,
      inStockCount,
      soldCount,
      recentDesigns,
      recentStock,
    ] = await Promise.all([
      prisma.customer.count({ where: { deletedAt: null } }),
      prisma.supplier.count({ where: { deletedAt: null } }),
      prisma.design.count({ where: { deletedAt: null } }),
      prisma.stockItem.count({ where: { deletedAt: null } }),
      prisma.stockItem.count({ where: { deletedAt: null, status: "IN_STOCK" } }),
      prisma.stockItem.count({ where: { deletedAt: null, status: "SOLD" } }),
      prisma.design.findMany({
        where: { deletedAt: null },
        include: { category: true, images: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.stockItem.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return ok({
      totals: { totalCustomers, totalSuppliers, totalDesigns, totalStockItems, inStockCount, soldCount },
      recentDesigns,
      recentStock,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
