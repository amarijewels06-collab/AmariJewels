import { type NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation/schemas";
import { verifyPassword } from "@/server/auth/password";
import { createSession, publicUser, setAuthCookies } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { errorResponse, readJson } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await readJson(req));
    const user = await prisma.user.findFirst({
      where: { username: body.username, status: "ACTIVE", deletedAt: null },
    });

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw Object.assign(new Error("Invalid username or password"), { status: 401 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });


    const tokens = await createSession(req, {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    });

    const response = NextResponse.json({ user: publicUser(user) });
    setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
