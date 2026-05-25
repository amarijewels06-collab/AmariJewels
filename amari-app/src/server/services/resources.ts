import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { requireRole } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { created, errorResponse, ok, readJson } from "@/server/http";
import { hashPassword } from "@/server/auth/password";
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  customerCreateSchema,
  customerUpdateSchema,
  designCreateSchema,
  designUpdateSchema,
  ledgerEntryCreateSchema,
  ledgerEntryUpdateSchema,
  quotationCreateSchema,
  quotationUpdateSchema,
  saleCreateSchema,
  saleUpdateSchema,
  stockCreateSchema,
  stockUpdateSchema,
  subCategoryCreateSchema,
  subCategoryUpdateSchema,
  supplierCreateSchema,
  supplierLedgerCreateSchema,
  supplierLedgerUpdateSchema,
  supplierUpdateSchema,
  userCreateSchema,
  userUpdateSchema,
  statusPatchSchema,
} from "@/lib/validation/schemas";

type ResourceConfig = {
  name: string;
  delegate: string;
  createSchema: z.ZodTypeAny;
  updateSchema: z.ZodTypeAny;
  searchFields: string[];
  filterFields?: string[];
  dateField?: string;
  codeField?: string;
  codePrefix?: string;
  include?: Record<string, unknown>;
  /** Lighter include for list (GET collection) queries — falls back to `include` if absent */
  listInclude?: Record<string, unknown>;
  writeRole?: "ADMIN" | "STAFF";
  sanitize?: (record: unknown) => unknown;
  beforeCreate?: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeUpdate?: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

type DbRecord = Record<string, unknown> & { id: string };

type ResourceDelegate = {
  count(args?: Record<string, unknown>): Promise<number>;
  findMany(args?: Record<string, unknown>): Promise<DbRecord[]>;
  findFirst(args?: Record<string, unknown>): Promise<DbRecord | null>;
  create(args: Record<string, unknown>): Promise<DbRecord>;
  update(args: Record<string, unknown>): Promise<DbRecord>;
};

const userSafeSelect = {
  id: true,
  username: true,
  displayName: true,
  mobile: true,
  email: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
};

function delegate(config: ResourceConfig) {
  return (prisma as unknown as Record<string, unknown>)[config.delegate] as unknown as ResourceDelegate;
}

function toInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function nextCode(config: ResourceConfig) {
  if (!config.codeField || !config.codePrefix) return undefined;
  const count = await delegate(config).count();
  return `${config.codePrefix}-${String(count + 1).padStart(6, "0")}`;
}

function listWhere(req: NextRequest, config: ResourceConfig) {
  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const where: Record<string, unknown> = { deletedAt: null };

  if (q) {
    where.OR = config.searchFields.map((field) => ({
      [field]: { contains: q, mode: "insensitive" },
    }));
  }

  for (const field of config.filterFields || []) {
    const value = params.get(field)?.trim();
    if (value) where[field] = value;
  }

  if (config.dateField) {
    const startDate = params.get("startDate")?.trim();
    const endDate = params.get("endDate")?.trim();
    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where[config.dateField] = dateFilter;
    }
  }

  return where;
}

async function audit(
  req: NextRequest,
  userId: string | undefined,
  entityType: string,
  entityId: string | undefined,
  action: string,
  oldValues?: unknown,
  newValues?: unknown,
) {
  await prisma.auditLog.create({
    data: {
      userId,
      entityType,
      entityId,
      action,
      oldValues: oldValues == null ? undefined : JSON.parse(JSON.stringify(oldValues)),
      newValues: newValues == null ? undefined : JSON.parse(JSON.stringify(newValues)),
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent"),
    },
  });
}

async function enforceRead(req: NextRequest) {
  return requireUser(req);
}

async function enforceWrite(req: NextRequest, config: ResourceConfig) {
  const user = await requireUser(req);
  requireRole(user, config.writeRole || "STAFF");
  return user;
}

export function collectionHandlers(config: ResourceConfig) {
  return {
    async GET(req: NextRequest) {
      try {
        await enforceRead(req);
        const page = toInt(req.nextUrl.searchParams.get("page"), 1);
        const rawPageSize = req.nextUrl.searchParams.get("pageSize");
        const pageSize = rawPageSize === "all" || rawPageSize === "-1" 
          ? 10000 
          : Math.min(toInt(rawPageSize, 20), 100);
        const where = listWhere(req, config);
        const [items, total] = await Promise.all([
          delegate(config).findMany({
            where,
            include: config.listInclude ?? config.include,
            select: config.delegate === "user" ? userSafeSelect : undefined,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          delegate(config).count({ where }),
        ]);

        const body = { items: items.map((item: unknown) => config.sanitize?.(item) || item), total, page, pageSize };
        return NextResponse.json(body, {
          headers: {
            "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
          },
        });
      } catch (error) {
        return errorResponse(error);
      }
    },

    async POST(req: NextRequest) {
      try {
        const user = await enforceWrite(req, config);
        const body = await readJson<Record<string, unknown>>(req);
        let data = config.createSchema.parse(body) as Record<string, unknown>;

        if (config.codeField && !data[config.codeField]) {
          data[config.codeField] = await nextCode(config);
        }

        data = config.beforeCreate ? await config.beforeCreate(data) : data;
        if (["customer", "supplier", "design", "stockItem"].includes(String(config.delegate))) {
          data.createdById = user.id;
          data.updatedById = user.id;
        }

        const record = await delegate(config).create({
          data,
          include: config.include,
          select: config.delegate === "user" ? userSafeSelect : undefined,
        });
        await audit(req, user.id, config.name, record.id, "CREATE", undefined, record);

        return created(config.sanitize?.(record) || record);
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}

export function entityHandlers(config: ResourceConfig) {
  return {
    async GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
      try {
        await enforceRead(req);
        const { id } = await ctx.params;
        const record = await delegate(config).findFirst({
          where: { id, deletedAt: null },
          include: config.include,
          select: config.delegate === "user" ? userSafeSelect : undefined,
        });

        if (!record) throw Object.assign(new Error(`${config.name} not found`), { status: 404 });
        return ok(config.sanitize?.(record) || record);
      } catch (error) {
        return errorResponse(error);
      }
    },

    async PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
      try {
        const user = await enforceWrite(req, config);
        const { id } = await ctx.params;
        const body = await readJson<Record<string, unknown>>(req);
        let data = config.updateSchema.parse(body) as Record<string, unknown>;
        data = config.beforeUpdate ? await config.beforeUpdate(data) : data;
        if (["customer", "supplier", "design", "stockItem"].includes(String(config.delegate))) {
          data.updatedById = user.id;
        }

        const oldRecord = await delegate(config).findFirst({ where: { id, deletedAt: null } });
        if (!oldRecord) throw Object.assign(new Error(`${config.name} not found`), { status: 404 });

        const record = await delegate(config).update({
          where: { id },
          data,
          include: config.include,
          select: config.delegate === "user" ? userSafeSelect : undefined,
        });
        await audit(req, user.id, config.name, id, "UPDATE", oldRecord, record);

        return ok(config.sanitize?.(record) || record);
      } catch (error) {
        return errorResponse(error);
      }
    },

    async DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
      try {
        const user = await enforceWrite(req, config);
        const { id } = await ctx.params;
        const oldRecord = await delegate(config).findFirst({ where: { id, deletedAt: null } });
        if (!oldRecord) throw Object.assign(new Error(`${config.name} not found`), { status: 404 });

        const record = await delegate(config).update({
          where: { id },
          data: { deletedAt: new Date(), status: config.delegate === "stockItem" ? "INACTIVE" : "INACTIVE" },
        });
        await audit(req, user.id, config.name, id, "DELETE", oldRecord, record);

        return ok({ ok: true });
      } catch (error) {
        return errorResponse(error);
      }
    },

    async PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
      try {
        const user = await enforceWrite(req, config);
        const { id } = await ctx.params;
        const body = statusPatchSchema.parse(await readJson<Record<string, unknown>>(req));
        const oldRecord = await delegate(config).findFirst({ where: { id, deletedAt: null } });
        if (!oldRecord) throw Object.assign(new Error(`${config.name} not found`), { status: 404 });

        const record = await delegate(config).update({
          where: { id },
          data: { status: body.status },
          include: config.include,
          select: config.delegate === "user" ? userSafeSelect : undefined,
        });
        await audit(req, user.id, config.name, id, "STATUS", oldRecord, record);

        return ok(config.sanitize?.(record) || record);
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}

const userHooks = {
  beforeCreate: async (data: Record<string, unknown>) => {
    const { password, ...rest } = data;
    return { ...rest, passwordHash: await hashPassword(String(password)) };
  },
  beforeUpdate: async (data: Record<string, unknown>) => {
    const { password, ...rest } = data;
    return password ? { ...rest, passwordHash: await hashPassword(String(password)) } : rest;
  },
};

export const resources = {
  customers: {
    name: "Customer",
    delegate: "customer",
    createSchema: customerCreateSchema,
    updateSchema: customerUpdateSchema,
    searchFields: ["code", "name", "company", "mobile", "gst", "pan", "city"],
    filterFields: ["status", "state", "city"],
    codeField: "code",
    codePrefix: "CUST",
  },
  suppliers: {
    name: "Supplier",
    delegate: "supplier",
    createSchema: supplierCreateSchema,
    updateSchema: supplierUpdateSchema,
    searchFields: ["code", "name", "company", "mobile", "gst", "pan", "city"],
    filterFields: ["status", "state", "city"],
    codeField: "code",
    codePrefix: "SUP",
  },
  categories: {
    name: "Category",
    delegate: "category",
    createSchema: categoryCreateSchema,
    updateSchema: categoryUpdateSchema,
    searchFields: ["code", "name", "description"],
    filterFields: ["status"],
    codeField: "code",
    codePrefix: "CAT",
    writeRole: "ADMIN",
  },
  subCategories: {
    name: "SubCategory",
    delegate: "subCategory",
    createSchema: subCategoryCreateSchema,
    updateSchema: subCategoryUpdateSchema,
    searchFields: ["code", "name", "description"],
    filterFields: ["status", "categoryId"],
    codeField: "code",
    codePrefix: "SUB",
    include: { category: true },
    writeRole: "ADMIN",
  },
  designs: {
    name: "Design",
    delegate: "design",
    createSchema: designCreateSchema,
    updateSchema: designUpdateSchema,
    searchFields: ["designNo", "metalQuality", "remarks"],
    filterFields: ["status", "categoryId", "subCategoryId", "metalQuality"],
    codeField: "designNo",
    codePrefix: "DES",
    include: { category: true, subCategory: true, images: true },
    sanitize: (record: unknown) => {
      const r = record as Record<string, unknown>;
      if (!Array.isArray(r.images)) return r;
      return {
        ...r,
        images: (r.images as Record<string, unknown>[]).map((img) => ({
          ...img,
          sizeBytes: img.sizeBytes != null ? Number(img.sizeBytes) : null,
        })),
      };
    },
  },
  stock: {
    name: "StockItem",
    delegate: "stockItem",
    createSchema: stockCreateSchema,
    updateSchema: stockUpdateSchema,
    searchFields: ["tagNo", "designNo", "metalQuality", "diamondQuality", "diamondColor"],
    filterFields: ["status", "metalQuality", "designId", "tagNo"],
    codeField: "tagNo",
    codePrefix: "TAG",
    include: { design: { include: { category: true, subCategory: true } }, category: true, subCategory: true },
    listInclude: { design: { select: { designNo: true } } },
  },
  sales: {
    name: "Sale",
    delegate: "sale",
    createSchema: saleCreateSchema,
    updateSchema: saleUpdateSchema,
    searchFields: ["invoiceNo", "metal", "invoiceType"],
    filterFields: ["status", "customerId", "invoiceType"],
    codeField: "invoiceNo",
    codePrefix: "INV",
    include: { customer: true },
  },
  users: {
    name: "User",
    delegate: "user",
    createSchema: userCreateSchema,
    updateSchema: userUpdateSchema,
    searchFields: ["username", "displayName", "mobile", "email"],
    filterFields: ["status", "role"],
    writeRole: "ADMIN",
    ...userHooks,
  },
  quotations: {
    name: "Quotation",
    delegate: "quotation",
    createSchema: quotationCreateSchema,
    updateSchema: quotationUpdateSchema,
    searchFields: ["customerCode", "customerName"],
    filterFields: ["status", "customerId"],
    include: { customer: true },
  },
  customerLedgerEntries: {
    name: "CustomerLedgerEntry",
    delegate: "customerLedgerEntry",
    createSchema: ledgerEntryCreateSchema,
    updateSchema: ledgerEntryUpdateSchema,
    searchFields: ["invoiceNo", "particular", "remarks"],
    filterFields: ["status", "customerId", "side", "saleId"],
    dateField: "date",
    include: { customer: true, sale: true },
  },
  supplierLedgerEntries: {
    name: "SupplierLedgerEntry",
    delegate: "supplierLedgerEntry",
    createSchema: supplierLedgerCreateSchema,
    updateSchema: supplierLedgerUpdateSchema,
    searchFields: ["invoiceNo", "particular", "remarks"],
    filterFields: ["status", "supplierId", "side"],
    dateField: "date",
    include: { supplier: true },
  },
} satisfies Record<string, ResourceConfig>;
