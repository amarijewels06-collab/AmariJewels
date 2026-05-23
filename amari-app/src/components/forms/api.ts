export type ApiState<T> = {
  data: T[];
  error?: string;
  loading: boolean;
};

/** Redirect to login on session timeout (401 Unauthorized). */
function handleUnauthorized(response: Response) {
  if (response.status === 401) {
    window.location.href = "/login";
    // Throw to stop further processing in the caller
    throw new Error("Session expired. Redirecting to login...");
  }
}

export async function readJson<T>(endpoint: string): Promise<T[]> {
  try {
    const response = await fetch(endpoint, { credentials: "include" });
    handleUnauthorized(response);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const payload = await response.json();
    if (Array.isArray(payload)) return payload as T[];
    if (Array.isArray(payload.data)) return payload.data as T[];
    if (Array.isArray(payload.items)) return payload.items as T[];
    if (payload?.data && typeof payload.data === "object") return [payload.data] as T[];
    if (payload && typeof payload === "object" && !payload.error) return [payload] as T[];
    return [];
  } catch {
    return [];
  }
}

export async function writeJson<T>(endpoint: string, method: "POST" | "PUT" | "PATCH", body: T) {
  const response = await fetch(endpoint, {
    body: JSON.stringify(body),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method,
  });

  handleUnauthorized(response);
  if (!response.ok) throw await apiError(response);
  return response.json().catch(() => null);
}

export async function deleteJson(endpoint: string) {
  const response = await fetch(endpoint, {
    credentials: "include",
    method: "DELETE",
  });

  handleUnauthorized(response);
  if (!response.ok) throw await apiError(response);
  return response.json().catch(() => null);
}

async function apiError(response: Response) {
  const payload = await response.json().catch(() => null);
  const issue = Array.isArray(payload?.issues) ? payload.issues[0]?.message : undefined;
  return new Error(issue || payload?.error || `${response.status} ${response.statusText}`);
}

export function panFromGst(gst: string) {
  const normalized = gst.toUpperCase().replace(/\s/g, "");
  return normalized.length >= 12 ? normalized.slice(2, 12) : "";
}

export function normalizeStatus(status: string) {
  return status.replace(/_/g, " ");
}
