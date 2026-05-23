import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, refreshExpiryDate } from "./tokens";

export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "STAFF" | "VIEWER";
};

export const accessCookie = "amari_access";
export const refreshCookie = "amari_refresh";

export function publicUser(user: {
  id: string;
  username: string;
  displayName: string;
  mobile?: string | null;
  email?: string | null;
  role: string;
  status: string;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    mobile: user.mobile,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(accessCookie, accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  response.cookies.set(refreshCookie, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(accessCookie, "", { path: "/", maxAge: 0 });
  response.cookies.set(refreshCookie, "", { path: "/", maxAge: 0 });
}

export async function createSession(req: NextRequest, user: CurrentUser) {
  const payload = { sub: user.id, username: user.username, role: user.role };
  const accessToken = signAccessToken(payload);
  const refresh = signRefreshToken(payload);

  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshToken: refresh.token,
      userAgent: req.headers.get("user-agent"),
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      expiresAt: refreshExpiryDate(),
    },
  });

  return { accessToken, refreshToken: refresh.token };
}

// ── In-memory user cache (avoids DB round-trip on every API call) ──
const userCache = new Map<string, { user: CurrentUser; expiresAt: number }>();
const USER_CACHE_TTL_MS = 60_000; // 60 seconds

function getCachedUser(userId: string): CurrentUser | null {
  const entry = userCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    userCache.delete(userId);
    return null;
  }
  return entry.user;
}

function setCachedUser(user: CurrentUser) {
  // Cap cache size to prevent memory leaks
  if (userCache.size > 200) {
    const oldest = userCache.keys().next().value;
    if (oldest) userCache.delete(oldest);
  }
  userCache.set(user.id, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
}

export async function requireUser(req: NextRequest): Promise<CurrentUser> {
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const cookieToken = req.cookies.get(accessCookie)?.value;
  const token = bearer || cookieToken;

  if (!token) {
    throw Object.assign(new Error("Authentication required"), { status: 401 });
  }

  // JWT signature is verified every time (security)
  const payload = verifyAccessToken(token);

  // Check cache first — skip DB round-trip if user was recently verified
  const cached = getCachedUser(payload.sub);
  if (cached) return cached;

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, status: "ACTIVE", deletedAt: null },
  });

  if (!user) {
    throw Object.assign(new Error("User is inactive or missing"), { status: 401 });
  }

  const currentUser: CurrentUser = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };

  setCachedUser(currentUser);
  return currentUser;
}

export async function refreshSession(req: NextRequest) {
  const token = req.cookies.get(refreshCookie)?.value;
  if (!token) {
    throw Object.assign(new Error("Refresh token missing"), { status: 401 });
  }

  const payload = verifyRefreshToken(token);
  const stored = await prisma.userSession.findUnique({ where: { refreshToken: token } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw Object.assign(new Error("Refresh token is invalid"), { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, status: "ACTIVE", deletedAt: null },
  });

  if (!user) {
    throw Object.assign(new Error("User is inactive or missing"), { status: 401 });
  }

  await prisma.userSession.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return createSession(req, {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  });
}
