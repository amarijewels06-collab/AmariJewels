import { entityHandlers, resources } from "@/server/services/resources";

export const runtime = "nodejs";

const handlers = entityHandlers(resources.categories);
export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
export const PATCH = handlers.PATCH;
