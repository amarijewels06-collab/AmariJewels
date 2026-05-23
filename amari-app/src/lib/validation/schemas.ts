import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

// Safely converts any value to a number, returning undefined for empty/NaN
const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
};

const text = (max = 255) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional()).optional();
const requiredText = (max = 255) => z.string().trim().min(1).max(max);
const decimal = z.preprocess(toOptionalNumber, z.number().nonnegative().optional()).optional();
const integer = z.preprocess(toOptionalNumber, z.number().int().nonnegative().optional()).optional();

export const recordStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const stockStatusSchema = z.enum(["IN_STOCK", "RESERVED", "SOLD", "INACTIVE"]);
export const userRoleSchema = z.enum(["ADMIN", "STAFF", "VIEWER"]);

export const mobileSchema = z
  .string()
  .trim()
  .regex(/^(\+91[- ]?)?[6-9]\d{9}$/, "Enter a valid Indian mobile number")
  .optional();

export const gstSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid GSTIN")
    .optional(),
).optional();

export const panSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN")
    .optional(),
).optional();

export function derivePanFromGst(gst?: string | null) {
  const normalized = gst?.trim().toUpperCase();
  if (!normalized || normalized.length !== 15) return undefined;
  return normalized.slice(2, 12);
}

const partyBaseSchema = z.object({
  code: text(30),
  name: text(150),
  company: text(180),
  mobile: z.preprocess(emptyToUndefined, mobileSchema).optional(),
  address: text(2000),
  city: text(100),
  state: text(100),
  country: z.preprocess(emptyToUndefined, z.string().trim().optional()).default("India").optional(),
  gst: gstSchema,
  pan: panSchema,
  remarks: text(2000),
  status: recordStatusSchema.default("ACTIVE"),
});

const withDerivedPan = <T extends { gst?: string; pan?: string }>(data: T) => ({
  ...data,
  pan: data.pan || derivePanFromGst(data.gst),
});

export const customerCreateSchema = partyBaseSchema.transform(withDerivedPan);
export const customerUpdateSchema = partyBaseSchema.partial().transform(withDerivedPan);
export const supplierCreateSchema = customerCreateSchema;
export const supplierUpdateSchema = customerUpdateSchema;

export const categoryCreateSchema = z.object({
  code: text(30),
  name: text(120),
  description: text(1000),
  status: recordStatusSchema.default("ACTIVE"),
});
export const categoryUpdateSchema = categoryCreateSchema.partial();

export const subCategoryCreateSchema = z.object({
  categoryId: text(80),
  code: text(30),
  name: text(120),
  description: text(1000),
  status: recordStatusSchema.default("ACTIVE"),
});
export const subCategoryUpdateSchema = subCategoryCreateSchema.partial();

const designBaseSchema = z.object({
  designNo: text(40),
  designDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  categoryId: text(80),
  subCategoryId: text(80),
  metalQuality: text(50),
  grossWeight: decimal,
  netWeight: decimal,
  diamondWeight: decimal,
  diamondPieces: integer,
  diamondSizes: z.array(z.string()).optional(),
  stoneWeight: decimal,
  stonePieces: integer,
  diamondColor: text(50),
  diamondQuality: text(50),
  remarks: text(2000),
  status: recordStatusSchema.default("ACTIVE"),
});

const validWeightOrder = (data: { grossWeight?: number; netWeight?: number }) =>
  data.grossWeight == null || data.netWeight == null || data.grossWeight >= data.netWeight;

export const designCreateSchema = designBaseSchema.refine(validWeightOrder, {
  message: "Gross weight should be greater than or equal to net weight",
  path: ["grossWeight"],
});
export const designUpdateSchema = designBaseSchema.partial().refine(validWeightOrder, {
  message: "Gross weight should be greater than or equal to net weight",
  path: ["grossWeight"],
});

const stockBaseSchema = z.object({
  tagNo: text(40),
  productName: text(255),
  designId: text(80),
  designNo: text(40),
  categoryId: text(80),
  subCategoryId: text(80),
  metalQuality: text(50),
  grossWeight: decimal,
  netWeight: decimal,
  pureWeight: decimal,
  diamondWeight: decimal,
  diamondQuality: text(50),
  diamondColor: text(50),
  diamondPieces: integer,
  stoneWeight: decimal,
  remarks: text(2000),
  status: stockStatusSchema.default("IN_STOCK"),
});

export const stockCreateSchema = stockBaseSchema.refine(validWeightOrder, {
  message: "Gross weight should be greater than or equal to net weight",
  path: ["grossWeight"],
});
export const stockUpdateSchema = stockBaseSchema.partial().refine(validWeightOrder, {
  message: "Gross weight should be greater than or equal to net weight",
  path: ["grossWeight"],
});

const saleBaseSchema = z.object({
  invoiceNo: text(50),
  customerId: text(80),
  customerName: text(150),
  date: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  invoiceType: text(80),
  selectedJob: text(100),
  stockType: text(50),
  purityRatio: decimal,
  wastage: decimal,
  metalRate: decimal,
  diamondRate: decimal,
  stoneRate: decimal,
  stoneRateOnPcs: z.boolean().optional().default(false),
  miscRate: decimal,
  discPercent: decimal,
  discAmt: decimal,
  metal: text(50),
  labourRate: decimal,
  items: z.array(z.any()).optional(),
  status: recordStatusSchema.default("ACTIVE"),
});

export const saleCreateSchema = saleBaseSchema;
export const saleUpdateSchema = saleBaseSchema.partial();

const quotationBaseSchema = z.object({
  customerId: text(80),
  customerCode: text(30),
  customerName: text(150),
  items: z.array(z.any()),
  totalGross: decimal,
  totalNet: decimal,
  totalPure: decimal,
  totalDiamond: decimal,
  itemCount: integer,
  status: recordStatusSchema.default("ACTIVE"),
});

export const quotationCreateSchema = quotationBaseSchema;
export const quotationUpdateSchema = quotationBaseSchema.partial();

export const ledgerSideSchema = z.enum(["DEBIT", "CREDIT"]);

const ledgerEntryBaseSchema = z.object({
  customerId: requiredText(80),
  saleId: text(80),
  date: z.preprocess(emptyToUndefined, z.coerce.date()),
  invoiceNo: text(50),
  particular: text(255),
  remarks: text(2000),
  side: ledgerSideSchema,
  goldGm: decimal,
  diamondCarat: decimal,
  stoneCarat: decimal,
  otherMetalsGm: decimal,
  totalAmount: decimal,
  status: recordStatusSchema.default("ACTIVE"),
});

export const ledgerEntryCreateSchema = ledgerEntryBaseSchema;
export const ledgerEntryUpdateSchema = ledgerEntryBaseSchema.partial();

const supplierLedgerBaseSchema = z.object({
  supplierId: requiredText(80),
  date: z.preprocess(emptyToUndefined, z.coerce.date()),
  invoiceNo: text(50),
  particular: text(255),
  remarks: text(2000),
  side: ledgerSideSchema,
  goldGm: decimal,
  diamondCarat: decimal,
  stoneCarat: decimal,
  otherMetalsGm: decimal,
  totalAmount: decimal,
  status: recordStatusSchema.default("ACTIVE"),
});

export const supplierLedgerCreateSchema = supplierLedgerBaseSchema;
export const supplierLedgerUpdateSchema = supplierLedgerBaseSchema.partial();

export const userCreateSchema = z.object({
  username: text(50),
  displayName: text(120),
  mobile: z.preprocess(emptyToUndefined, mobileSchema).optional(),
  email: z.preprocess(emptyToUndefined, z.string().email().max(180).optional()).optional(),
  password: z.preprocess(emptyToUndefined, z.string().min(8).max(100).optional()).optional(),
  role: userRoleSchema.default("STAFF"),
  status: recordStatusSchema.default("ACTIVE"),
});
export const userUpdateSchema = userCreateSchema.omit({ password: true }).partial().extend({
  password: z.preprocess(emptyToUndefined, z.string().min(8).max(100).optional()).optional(),
});

export const businessProfileSchema = z
  .object({
    businessName: requiredText(180),
    ownerName: text(150),
    mobile: z.preprocess(emptyToUndefined, mobileSchema).optional(),
    email: z.preprocess(emptyToUndefined, z.string().email().max(180).optional()).optional(),
    gst: gstSchema,
    pan: panSchema,
    address: text(2000),
    city: text(100),
    state: text(100),
    country: z.preprocess(emptyToUndefined, z.string().trim().optional()).default("India").optional(),
    logoObjectKey: text(1000),
  })
  .transform((data) => ({ ...data, pan: data.pan || derivePanFromGst(data.gst) }));

export const loginSchema = z.object({
  username: requiredText(50),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export const statusPatchSchema = z.object({
  status: z.union([recordStatusSchema, stockStatusSchema]),
});

export const imageMetadataSchema = z.object({
  objectKey: requiredText(1000),
  originalFilename: text(255),
  mimeType: text(120),
  sizeBytes: z.preprocess(emptyToUndefined, z.coerce.bigint().optional()),
  isPrimary: z.boolean().default(true),
});

export const presignUploadSchema = z.object({
  scope: z.enum(["designs", "profile"]),
  ownerCode: text(80),
  filename: requiredText(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.coerce.number().positive().max(5 * 1024 * 1024),
});
