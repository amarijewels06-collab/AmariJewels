import { type NextRequest } from "next/server";
import { imageMetadataSchema } from "@/lib/validation/schemas";
import { requireRole } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { errorResponse, ok, readJson } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    requireRole(user, "STAFF");
    const { id } = await ctx.params;
    const body = imageMetadataSchema.parse(await readJson(req));
    const design = await prisma.design.findFirst({ where: { id, deletedAt: null } });
    if (!design) throw Object.assign(new Error("Design not found"), { status: 404 });

    const image = await prisma.designImage.create({
      data: {
        designId: id,
        bucket: process.env.IDRIVE_E2_BUCKET || "",
        objectKey: body.objectKey,
        originalFilename: body.originalFilename,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        isPrimary: body.isPrimary,
      },
    });

    return ok({ ...image, sizeBytes: image.sizeBytes != null ? Number(image.sizeBytes) : null }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
