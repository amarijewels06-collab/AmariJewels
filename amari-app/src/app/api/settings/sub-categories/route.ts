import { collectionHandlers, resources } from "@/server/services/resources";

export const runtime = "nodejs";

const handlers = collectionHandlers(resources.subCategories);
export const GET = handlers.GET;
export const POST = handlers.POST;
