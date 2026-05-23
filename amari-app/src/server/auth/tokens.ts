import jwt, { type SignOptions } from "jsonwebtoken";
import { randomUUID } from "node:crypto";

export type AuthTokenPayload = {
  sub: string;
  username: string;
  role: "ADMIN" | "STAFF" | "VIEWER";
  jti?: string;
};

const accessSecret = () => process.env.JWT_ACCESS_SECRET || "dev-access-secret";
const refreshSecret = () => process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";

export function signAccessToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, accessSecret(), {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || "1h") as SignOptions["expiresIn"],
  });
}

export function signRefreshToken(payload: Omit<AuthTokenPayload, "jti">) {
  const jti = randomUUID();
  const token = jwt.sign({ ...payload, jti }, refreshSecret(), {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || "30d") as SignOptions["expiresIn"],
  });

  return { token, jti };
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, accessSecret()) as AuthTokenPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, refreshSecret()) as AuthTokenPayload;
}

export function refreshExpiryDate() {
  const configured = process.env.JWT_REFRESH_EXPIRES_IN || "30d";
  const match = configured.match(/^(\d+)([dhm])$/);
  const amount = match ? Number(match[1]) : 30;
  const unit = match?.[2] || "d";
  const multiplier = unit === "h" ? 60 * 60 * 1000 : unit === "m" ? 60 * 1000 : 24 * 60 * 60 * 1000;

  return new Date(Date.now() + amount * multiplier);
}
