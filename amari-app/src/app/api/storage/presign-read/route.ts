import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { errorResponse, ok, readJson } from "@/server/http";
import { presignReadUrl } from "@/server/storage/s3";

export const runtime = "nodejs";

const schema = z.object({ objectKey: z.string().trim().min(1).max(1000) });

export async function POST(req: NextRequest) {
  try {
    await requireUser(req);
    const body = schema.parse(await readJson(req));
    const readUrl = await presignReadUrl(body.objectKey);

    return ok({ readUrl });
  } catch (error) {
    return errorResponse(error);
  }
}
