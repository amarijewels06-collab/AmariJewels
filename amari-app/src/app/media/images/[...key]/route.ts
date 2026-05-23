import { type NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/session";
import { errorResponse } from "@/server/http";
import { presignReadUrl, safeObjectKey } from "@/server/storage/s3";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  try {
    await requireUser(req);
    const { key } = await ctx.params;
    const objectKey = safeObjectKey(key.join("/"));
    const readUrl = await presignReadUrl(objectKey);

    return NextResponse.redirect(readUrl, 302);
  } catch (error) {
    return errorResponse(error);
  }
}
