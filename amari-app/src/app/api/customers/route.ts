import { collectionHandlers, resources } from "@/server/services/resources";

export const runtime = "nodejs";

const handlers = collectionHandlers(resources.customers);
export const GET = handlers.GET;
export const POST = handlers.POST;
