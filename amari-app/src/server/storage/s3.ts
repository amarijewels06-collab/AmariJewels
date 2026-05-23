import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const allowedPrefixes = ["designs/", "profile/"];

function normalizeEndpoint(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
}

export function storageConfig() {
  const bucket = process.env.IDRIVE_E2_BUCKET;
  if (!bucket) throw Object.assign(new Error("IDRIVE_E2_BUCKET is not configured"), { status: 500 });

  const endpoint = normalizeEndpoint(process.env.IDRIVE_E2_ENDPOINT);
  if (!endpoint) throw Object.assign(new Error("IDRIVE_E2_ENDPOINT is not configured"), { status: 500 });

  return {
    bucket,
    endpoint,
    region: process.env.IDRIVE_E2_REGION || "us-east-1",
    accessKeyId: process.env.IDRIVE_E2_ACCESS_KEY_ID,
    secretAccessKey: process.env.IDRIVE_E2_SECRET_ACCESS_KEY,
  };
}

// ── Singleton S3 client (avoids creating a new client per request) ────────────
let _s3: S3Client | null = null;

export function s3Client() {
  if (_s3) return _s3;

  const config = storageConfig();
  if (!config.accessKeyId || !config.secretAccessKey) {
    throw Object.assign(new Error("iDrive E2 credentials are not configured"), { status: 500 });
  }

  _s3 = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return _s3;
}

export function safeObjectKey(key: string) {
  const decoded = decodeURIComponent(key);
  if (
    decoded.startsWith("/") ||
    decoded.includes("..") ||
    decoded.includes("\\") ||
    !allowedPrefixes.some((prefix) => decoded.startsWith(prefix))
  ) {
    throw Object.assign(new Error("Invalid object key"), { status: 400 });
  }

  return decoded;
}

export function objectKeyForUpload(scope: "designs" | "profile", ownerCode: string | undefined, filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase() || "bin";
  const cleanOwner = ownerCode?.replace(/[^a-zA-Z0-9-_]/g, "-") || "general";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  return scope === "designs"
    ? `designs/${cleanOwner}/${stamp}-${randomUUID()}.${extension}`
    : `profile/${stamp}-${randomUUID()}.${extension}`;
}

export async function presignUploadUrl(key: string, contentType: string) {
  const config = storageConfig();
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: safeObjectKey(key),
    ContentType: contentType,
  });

  return getSignedUrl(s3Client(), command, { expiresIn: 60 * 5 });
}

// ── Presigned read-URL cache ──────────────────────────────────────────────────
// Presign with max TTL (7 days = 604 800s) and cache in-memory for 6 days
// so URLs are reused instead of re-signed on every request.
const PRESIGN_TTL_SECONDS = 604_800;                   // 7 days (S3 max with IAM creds)
const CACHE_TTL_MS = (PRESIGN_TTL_SECONDS - 86_400) * 1_000; // 6 days in ms (1-day safety buffer)
const MAX_CACHE_SIZE = 500;

const presignCache = new Map<string, { url: string; expiresAt: number }>();

function prunePresignCache() {
  if (presignCache.size <= MAX_CACHE_SIZE) return;
  const now = Date.now();
  for (const [k, v] of presignCache) {
    if (now > v.expiresAt) presignCache.delete(k);
  }
  // If still over limit, evict oldest entries
  if (presignCache.size > MAX_CACHE_SIZE) {
    const excess = presignCache.size - MAX_CACHE_SIZE;
    const keys = presignCache.keys();
    for (let i = 0; i < excess; i++) {
      const key = keys.next().value;
      if (key) presignCache.delete(key);
    }
  }
}

export async function presignReadUrl(key: string) {
  const cached = presignCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.url;

  const config = storageConfig();
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: safeObjectKey(key),
  });

  const url = await getSignedUrl(s3Client(), command, { expiresIn: PRESIGN_TTL_SECONDS });

  prunePresignCache();
  presignCache.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS });

  return url;
}
