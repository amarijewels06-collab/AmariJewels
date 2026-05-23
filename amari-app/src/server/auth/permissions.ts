import type { CurrentUser } from "./session";

const roleRank = {
  VIEWER: 1,
  STAFF: 2,
  ADMIN: 3,
} as const;

export function requireRole(user: CurrentUser, minimum: keyof typeof roleRank) {
  if (roleRank[user.role] < roleRank[minimum]) {
    throw Object.assign(new Error("You do not have permission for this action"), { status: 403 });
  }
}
