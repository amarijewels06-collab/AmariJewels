import { type NextRequest } from "next/server";
import { changePasswordSchema } from "@/lib/validation/schemas";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { errorResponse, ok, readJson } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const current = await requireUser(req);
    const body = changePasswordSchema.parse(await readJson(req));
    const user = await prisma.user.findUnique({ where: { id: current.id } });
    if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
      throw Object.assign(new Error("Current password is incorrect"), { status: 400 });
    }

    await prisma.user.update({
      where: { id: current.id },
      data: { passwordHash: await hashPassword(body.newPassword) },
    });

    return ok({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
