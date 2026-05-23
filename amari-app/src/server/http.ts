import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created(data: unknown) {
  return ok(data, { status: 201 });
}

export function errorResponse(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;

  if (error instanceof ZodError) {
    return ok(
      {
        error: "Validation failed",
        issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
      { status: 422 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return ok({ error: "A record with this unique value already exists" }, { status: 409 });
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";
  return ok({ error: message }, { status: Number.isFinite(status) ? status : 500 });
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON"), { status: 400 });
  }
}
