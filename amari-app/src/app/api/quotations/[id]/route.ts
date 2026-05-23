import { entityHandlers, resources } from "@/server/services/resources";

export const runtime = "nodejs";

const handlers = entityHandlers(resources.quotations);
export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
