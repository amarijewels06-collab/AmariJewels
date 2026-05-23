import { type NextRequest } from "next/server";
import { requireRole } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { errorResponse, ok } from "@/server/http";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; imageId: string }> }) {
  try {
    const user = await requireUser(_req);
    requireRole(user, "STAFF");
    const { id, imageId } = await ctx.params;
    await prisma.designImage.delete({ where: { id: imageId, designId: id } });
    return ok({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
