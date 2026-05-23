import { type NextRequest } from "next/server";
import { businessProfileSchema } from "@/lib/validation/schemas";
import { requireRole } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { errorResponse, ok, readJson } from "@/server/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);
    const profile = await prisma.businessProfile.findFirst();
    return ok(profile);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser(req);
    requireRole(user, "ADMIN");
    const body = businessProfileSchema.parse(await readJson(req));
    const existing = await prisma.businessProfile.findFirst();
    const profile = existing
      ? await prisma.businessProfile.update({ where: { id: existing.id }, data: body })
      : await prisma.businessProfile.create({ data: body });

    return ok(profile);
  } catch (error) {
    return errorResponse(error);
  }
}
