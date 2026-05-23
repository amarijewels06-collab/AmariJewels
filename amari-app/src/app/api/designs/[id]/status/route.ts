import { entityHandlers, resources } from "@/server/services/resources";

export const runtime = "nodejs";

const handlers = entityHandlers(resources.designs);
export const PATCH = handlers.PATCH;
