import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { requireRole } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { errorResponse, ok, readJson } from "@/server/http";

const bulkStatusSchema = z.object({
  ids: z.array(z.string().uuid()),
  status: z.enum(["IN_STOCK", "RESERVED", "SOLD", "INACTIVE"]),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(req);
    requireRole(user, "STAFF");
    const body = bulkStatusSchema.parse(await readJson<Record<string, unknown>>(req));

    if (body.ids.length === 0) {
      return ok({ count: 0 });
    }

    const result = await prisma.stockItem.updateMany({
      where: { id: { in: body.ids } },
      data: { status: body.status },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entityType: "StockItem",
        action: "BULK_STATUS",
        newValues: { status: body.status, count: result.count, ids: body.ids },
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: req.headers.get("user-agent"),
      },
    });

    return ok({ count: result.count });
  } catch (error) {
    return errorResponse(error);
  }
}
