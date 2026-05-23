import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { prisma } from "@/server/db/prisma";
import { errorResponse, ok, readJson } from "@/server/http";

export const runtime = "nodejs";

const resetSchema = z.object({ password: z.string().min(8).max(100) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const current = await requireUser(req);
    requireRole(current, "ADMIN");
    const { id } = await ctx.params;
    const body = resetSchema.parse(await readJson(req));

    await prisma.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(body.password) },
    });

    return ok({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
