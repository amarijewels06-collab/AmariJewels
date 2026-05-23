import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { errorResponse, ok, readJson } from "@/server/http";
import { mobileSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  mobile: z.preprocess((value) => (value === "" ? undefined : value), mobileSchema.optional()),
  email: z.preprocess((value) => (value === "" ? undefined : value), z.string().email().max(180).optional()),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, username: true, displayName: true, mobile: true, email: true, role: true },
    });
    return ok(profile);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = profileSchema.parse(await readJson(req));
    const profile = await prisma.user.update({
      where: { id: user.id },
      data: body,
      select: { id: true, username: true, displayName: true, mobile: true, email: true, role: true },
    });
    return ok(profile);
  } catch (error) {
    return errorResponse(error);
  }
}
