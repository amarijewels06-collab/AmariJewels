import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { errorResponse, ok } from "@/server/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const current = await requireUser(req);
    const user = await prisma.user.findUnique({
      where: { id: current.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        mobile: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
      },
    });

    return ok({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
