import { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireUser } from "@/server/auth/session";
import { errorResponse, ok } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireUser(req);
    const { designNos } = (await req.json()) as { designNos: string[] };
    if (!Array.isArray(designNos) || designNos.length === 0) {
      return ok([]);
    }

    const existing = await prisma.design.findMany({
      where: {
        designNo: { in: designNos },
        deletedAt: null,
      },
      select: { designNo: true },
    });

    return ok(existing.map((d) => d.designNo));
  } catch (error) {
    return errorResponse(error);
  }
}
