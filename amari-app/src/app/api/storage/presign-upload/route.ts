import { type NextRequest } from "next/server";
import { presignUploadSchema } from "@/lib/validation/schemas";
import { requireRole } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { errorResponse, ok, readJson } from "@/server/http";
import { objectKeyForUpload, presignUploadUrl } from "@/server/storage/s3";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    requireRole(user, "STAFF");
    const body = presignUploadSchema.parse(await readJson(req));
    const objectKey = objectKeyForUpload(body.scope, body.ownerCode, body.filename);
    const uploadUrl = await presignUploadUrl(objectKey, body.contentType);

    return ok({ objectKey, uploadUrl, headers: { "Content-Type": body.contentType } });
  } catch (error) {
    return errorResponse(error);
  }
}
