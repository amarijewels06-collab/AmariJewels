import { type NextRequest, NextResponse } from "next/server";
import { refreshSession, setAuthCookies } from "@/server/auth/session";
import { errorResponse } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const tokens = await refreshSession(req);
    const response = NextResponse.json({ ok: true });
    setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
