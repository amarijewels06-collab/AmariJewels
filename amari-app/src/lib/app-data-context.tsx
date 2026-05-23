"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { readJson } from "@/components/forms/api";
import { normalizeParty } from "@/components/forms/party-manager";
import { normalizeDesign } from "@/components/forms/design-manager";
import { normalizeStock } from "@/components/forms/stock-manager";

// ─── Customer type (shared minimal shape) ────────────────────────────────────
export type SharedCustomer = {
  id: string;
  name: string;
  code: string;
  company?: string;
  mobile?: string;
  address?: string;
  city?: string;
  state?: string;
  gst?: string;
  pan?: string;
};

// ─── Context shape ────────────────────────────────────────────────────────────
type AppData = {
  customers: SharedCustomer[];
  suppliers: ReturnType<typeof normalizeParty>[];
  stock: ReturnType<typeof normalizeStock>[];
  designs: ReturnType<typeof normalizeDesign>[];
  loading: boolean;
  /** Call to force a re-fetch of one or all collections */
  refresh: (target?: "customers" | "suppliers" | "stock" | "designs") => void;
};

const AppDataContext = createContext<AppData>({
  customers: [],
  suppliers: [],
  stock: [],
  designs: [],
  loading: true,
  refresh: () => {},
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function toCustomer(raw: Record<string, unknown>): SharedCustomer {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    code: String(raw.code ?? ""),
    company: raw.company ? String(raw.company) : undefined,
    mobile: raw.mobile ? String(raw.mobile) : undefined,
    address: raw.address ? String(raw.address) : undefined,
    city: raw.city ? String(raw.city) : undefined,
    state: raw.state ? String(raw.state) : undefined,
    gst: raw.gst ? String(raw.gst) : undefined,
    pan: raw.pan ? String(raw.pan) : undefined,
  };
}

// ─── Collection names ─────────────────────────────────────────────────────────
type CollectionName = "customers" | "suppliers" | "stock" | "designs";

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppDataProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<SharedCustomer[]>([]);
  const [suppliers, setSuppliers] = useState<ReturnType<typeof normalizeParty>[]>([]);
  const [stock, setStock] = useState<ReturnType<typeof normalizeStock>[]>([]);
  const [designs, setDesigns] = useState<ReturnType<typeof normalizeDesign>[]>([]);
  const [loading, setLoading] = useState(false);

  // Track which collections have been loaded so we don't re-fetch on every render
  const loaded = useRef<Set<CollectionName>>(new Set());
  const inflight = useRef<Set<CollectionName>>(new Set());

  const fetchCollection = useCallback(async (name: CollectionName) => {
    if (inflight.current.has(name)) return; // already fetching
    inflight.current.add(name);
    try {
      switch (name) {
        case "customers":
          await readJson<Record<string, unknown>>("/api/customers?pageSize=500").then((rows) =>
            setCustomers(rows.map(toCustomer))
          );
          break;
        case "suppliers":
          await readJson<Record<string, unknown>>("/api/suppliers?pageSize=500").then((rows) =>
            setSuppliers(rows.map(normalizeParty))
          );
          break;
        case "stock":
          await readJson<Record<string, unknown>>("/api/stock?pageSize=500").then((rows) =>
            setStock(rows.map(normalizeStock))
          );
          break;
        case "designs":
          await readJson<Record<string, unknown>>("/api/designs?pageSize=500").then((rows) =>
            setDesigns(rows.map(normalizeDesign))
          );
          break;
      }
      loaded.current.add(name);
    } finally {
      inflight.current.delete(name);
    }
  }, []);

  // On mount, fetch only customers (most pages need them).
  // Other collections are loaded lazily on first access via the `refresh` function,
  // or eagerly by pages that call `refresh("stock")` etc.
  useEffect(() => {
    setLoading(true);
    fetchCollection("customers").finally(() => setLoading(false));
  }, [fetchCollection]);

  const refresh = useCallback(
    (target?: CollectionName) => {
      if (target) {
        // Force re-fetch one collection
        loaded.current.delete(target);
        fetchCollection(target);
      } else {
        // Refresh all — mark all dirty and re-fetch
        loaded.current.clear();
        const all: CollectionName[] = ["customers", "suppliers", "stock", "designs"];
        Promise.allSettled(all.map(fetchCollection));
      }
    },
    [fetchCollection],
  );

  // Lazy-load accessor: if a collection hasn't been loaded yet, trigger the fetch
  // This ensures components that read stock/suppliers/designs auto-trigger the load
  const ensureLoaded = useCallback(
    (name: CollectionName) => {
      if (!loaded.current.has(name) && !inflight.current.has(name)) {
        fetchCollection(name);
      }
    },
    [fetchCollection],
  );

  // Lazy-load: trigger fetch after mount if the collection hasn't been loaded yet
  useEffect(() => { ensureLoaded("suppliers"); }, [ensureLoaded]);
  useEffect(() => { ensureLoaded("stock"); }, [ensureLoaded]);
  useEffect(() => { ensureLoaded("designs"); }, [ensureLoaded]);

  return (
    <AppDataContext.Provider value={{ customers, suppliers, stock, designs, loading, refresh }}>
      {children}
    </AppDataContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAppData() {
  return useContext(AppDataContext);
}
