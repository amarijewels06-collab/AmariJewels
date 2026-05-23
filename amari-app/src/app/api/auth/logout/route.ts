import { type NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, refreshCookie } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(refreshCookie)?.value;
  if (token) {
    await prisma.userSession.updateMany({
      where: { refreshToken: token, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
