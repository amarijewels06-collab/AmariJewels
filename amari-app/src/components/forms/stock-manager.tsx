"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Edit3, Plus, Save, Trash2, Printer } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { DataTable, type Column } from "../ui/data-table";
import { Dialog } from "../ui/dialog";
import { FieldWrap, Input, Select, Textarea } from "../ui/field";
import { Loader } from "../ui/loader";
import { PageHeader } from "../ui/page-header";
import { deleteJson, normalizeStatus, readJson, writeJson } from "./api";

type StockItem = {
  category_id?: string;
  sub_category_id?: string;
  category_name?: string;
  sub_category_name?: string;
  design_no?: string;
  diamond_color?: string;
  diamond_pieces?: number;
  diamond_quality?: string;
  diamond_weight?: string;
  gross_weight: string;
  id?: string;
  metal_quality: string;
  net_weight: string;
  pure_weight?: string;
  remarks?: string;
  status: "IN_STOCK" | "RESERVED" | "SOLD" | "INACTIVE";
  stone_weight?: string;
  tag_no: string;
};

const emptyStock: StockItem = {
  gross_weight: "",
  metal_quality: "18KT",
  net_weight: "0.000",
  status: "IN_STOCK",
  stone_weight: "0.000",
  tag_no: "",
};

const stockStatuses = ["IN_STOCK", "RESERVED", "SOLD", "INACTIVE"] as const;
const metalQualities = ["24KT", "22KT", "18KT", "14KT", "10KT", "9KT", "925 Silver", "Platinum"];

const purityMapping: Record<string, number> = {
  "24KT": 1.0,
  "22KT": 0.916,
  "18KT": 0.76,
  "14KT": 0.6,
  "10KT": 0.42,
  "9KT": 0.4,
  "24K": 1.0,
  "22K": 0.916,
  "18K": 0.76,
};

type DesignLookupStatus = "idle" | "loading" | "found" | "not_found";

type CategoryOption = { id: string; name: string };

export function StockManager() {
  const [rows, setRows] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [metal, setMetal] = useState("ALL");
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [designLookupStatus, setDesignLookupStatus] = useState<DesignLookupStatus>("idle");
  const designLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [startPosition, setStartPosition] = useState(1);

  async function handleDownloadTags() {
    setPrinting(true);
    setError("");
    try {
      const selectedItems = rows.filter((row) => row.id && selectedStockIds.includes(row.id));
      const formattedItems = selectedItems.map((item) => ({
        design_no: item.design_no,
        tag_no: item.tag_no,
        gross_weight: item.gross_weight,
        net_weight: item.net_weight,
        metal_quality: item.metal_quality,
        diamond_weight: item.diamond_weight,
        diamond_pieces: item.diamond_pieces,
        diamond_color: item.diamond_color,
        diamond_quality: item.diamond_quality,
        stone_weight: item.stone_weight,
      }));

      const { generateTagPdf } = await import("@/lib/generate-tag-pdf");
      const doc = generateTagPdf(formattedItems, startPosition);

      doc.save(`Tags_${new Date().toISOString().slice(0, 10)}.pdf`);
      setIsPrintDialogOpen(false);
      setMessage(`Generated PDF for ${selectedItems.length} tags.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate tag PDF");
    } finally {
      setPrinting(false);
    }
  }

  async function handleBulkStatusUpdate(nextStatus: StockItem["status"]) {
    if (selectedStockIds.length === 0) return;
    setBulkUpdating(true);
    try {
      await writeJson("/api/stock/bulk-status", "PATCH", {
        ids: selectedStockIds,
        status: nextStatus,
      });
      setRows((current) =>
        current.map((item) =>
          item.id && selectedStockIds.includes(item.id)
            ? { ...item, status: nextStatus }
            : item
        )
      );
      setMessage(`Updated status to ${normalizeStatus(nextStatus)} for ${selectedStockIds.length} items.`);
      setSelectedStockIds([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update stock status in bulk.");
    } finally {
      setBulkUpdating(false);
    }
  }

  useEffect(() => {
    readJson<Record<string, unknown>>("/api/stock")
      .then((items) => setRows(items.map(normalizeStock)))
      .finally(() => setLoading(false));
    readJson<Record<string, unknown>>("/api/settings/categories?pageSize=100")
      .then((items) =>
        setCategories(
          items
            .filter((c) => c.id && c.name)
            .map((c) => ({ id: String(c.id), name: String(c.name) })),
        ),
      );
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = [row.tag_no, row.design_no, row.metal_quality, row.diamond_quality, row.diamond_color, row.category_name, row.sub_category_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!needle || haystack.includes(needle)) &&
        (status === "ALL" || row.status === status) &&
        (metal === "ALL" || row.metal_quality === metal)
      );
    });
  }, [metal, rows, search, status]);

  const nextTagNo = useMemo(() => {
    const numericTags = rows
      .map((row) => parseInt(row.tag_no, 10))
      .filter((num) => !isNaN(num));
    const maxTag = Math.max(100, ...numericTags);
    return (maxTag + 1).toString().padStart(4, "0");
  }, [rows]);

  function calculateWeights(item: StockItem): Partial<StockItem> {
    const gross = parseFloat(item.gross_weight) || 0;
    const diamondCarat = parseFloat(item.diamond_weight || "0") || 0;
    const stoneCarat = parseFloat(item.stone_weight || "0") || 0;
    const diamondGram = diamondCarat * 0.2;
    const stoneGram = stoneCarat * 0.2;
    const netWeight = Math.max(0, gross - diamondGram - stoneGram);
    const purity = purityMapping[item.metal_quality] || 0;
    const pureWeight = netWeight * purity;

    return {
      net_weight: netWeight > 0 ? netWeight.toFixed(3) : "0.000",
      pure_weight: pureWeight > 0 ? pureWeight.toFixed(3) : "0.000",
    };
  }

  const lookupDesignByNo = useCallback((designNo: string) => {
    if (designLookupTimer.current) clearTimeout(designLookupTimer.current);
    const trimmed = designNo.trim();
    if (!trimmed) {
      setDesignLookupStatus("idle");
      return;
    }
    setDesignLookupStatus("loading");
    designLookupTimer.current = setTimeout(async () => {
      try {
        const items = await readJson<Record<string, unknown>>(`/api/designs?q=${encodeURIComponent(trimmed)}&pageSize=100`);
        const match = items.find(
          (d) =>
            String(d.designNo ?? d.design_no ?? "").toLowerCase() === trimmed.toLowerCase(),
        );
        if (match) {
          setDesignLookupStatus("found");
          setEditing((current) => {
            if (!current) return current;
            const cat = match.category as { id?: string; name?: string } | null | undefined;
            const sub = match.subCategory as { id?: string; name?: string } | null | undefined;
            const next: StockItem = {
              ...current,
              design_no: trimmed,
              category_id: cat?.id ? String(cat.id) : current.category_id,
              sub_category_id: sub?.id ? String(sub.id) : current.sub_category_id,
              category_name: cat?.name ? String(cat.name) : (match.categoryName != null ? String(match.categoryName) : current.category_name),
              sub_category_name: sub?.name ? String(sub.name) : (match.subCategoryName != null ? String(match.subCategoryName) : current.sub_category_name),
              metal_quality: String(match.metalQuality ?? match.metal_quality ?? current.metal_quality),
              gross_weight: match.grossWeight != null ? String(match.grossWeight) : current.gross_weight,
              diamond_weight: match.diamondWeight != null ? String(match.diamondWeight) : current.diamond_weight,
              stone_weight: match.stoneWeight != null ? String(match.stoneWeight) : current.stone_weight,
              diamond_quality: match.diamondQuality != null ? String(match.diamondQuality) : current.diamond_quality,
              diamond_color: match.diamondColor != null ? String(match.diamondColor) : current.diamond_color,
              diamond_pieces: match.diamondPieces != null ? Number(match.diamondPieces) : current.diamond_pieces,
              remarks: current.remarks ?? (match.remarks != null ? String(match.remarks) : undefined),
            };
            const calculated = calculateWeights(next);
            return { ...next, ...calculated };
          });
        } else {
          setDesignLookupStatus("not_found");
        }
      } catch {
        setDesignLookupStatus("not_found");
      }
    }, 600);
  }, []);

  function updateForm(key: keyof StockItem, value: string) {
    setError("");
    if (key === "design_no") {
      setEditing((current) => (current ? { ...current, design_no: value } : current));
      lookupDesignByNo(value);
      return;
    }
    setEditing((current) => {
      if (!current) return current;
      let next = { ...current, [key]: value } as StockItem;
      if (["gross_weight", "diamond_weight", "stone_weight", "metal_quality"].includes(key)) {
        const calculated = calculateWeights(next);
        next = { ...next, ...calculated };
      }
      return next;
    });
  }

  function openStockForm(stockItem: StockItem) {
    setError("");
    setDesignLookupStatus("idle");
    const item = { ...stockItem };
    if (!item.id && !item.tag_no) {
      item.tag_no = nextTagNo;
    }
    setEditing(item);
  }

  function closeStockForm() {
    setError("");
    setEditing(null);
  }

  function validate(item: StockItem) {
    const gross = Number(item.gross_weight);
    const net = Number(item.net_weight);
    const diamond = Number(item.diamond_weight || 0);
    if (Number.isNaN(gross) || Number.isNaN(net) || gross < 0 || net < 0 || diamond < 0) {
      return "Weights must be valid non-negative numbers.";
    }
    if (gross < net) return "Gross weight should be greater than or equal to net weight.";
    if (item.diamond_pieces !== undefined && item.diamond_pieces < 0) return "Diamond pieces cannot be negative.";
    return "";
  }

  async function saveStock() {
    if (!editing) return;
    const validation = validate(editing);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    const method = editing.id ? "PUT" : "POST";
    const target = editing.id ? `/api/stock/${editing.id}` : "/api/stock";
    try {
      const saved = await writeJson(target, method, toStockPayload(editing));
      const nextRow = normalizeStock(saved?.data ?? saved ?? editing);
      setRows((current) => {
        if (editing.id) return current.map((row) => (row.id === editing.id ? { ...row, ...nextRow } : row));
        return [{ ...editing, ...nextRow, id: nextRow.id ?? crypto.randomUUID() }, ...current];
      });
      closeStockForm();
      setMessage("Stock item saved.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save stock item.");
    } finally {
      setSaving(false);
    }
  }

  async function setRowStatus(row: StockItem, nextStatus: StockItem["status"]) {
    if (!row.id) return;
    setRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: nextStatus } : item)));
    try {
      await writeJson(`/api/stock/${row.id}/status`, "PATCH", { status: nextStatus });
    } catch (error) {
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: row.status } : item)));
      setMessage(error instanceof Error ? error.message : "Unable to update stock status.");
    }
  }

  async function deleteStock(row: StockItem) {
    if (!row.id || !window.confirm(`Delete ${row.tag_no}?`)) return;
    try {
      await deleteJson(`/api/stock/${row.id}`);
      setRows((current) => current.filter((item) => item.id !== row.id));
      setSelectedStockIds((current) => current.filter((id) => id !== row.id));
      setMessage(`${row.tag_no} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete stock item.");
    }
  }

  const columns: Column<StockItem>[] = [
    {
      className: "w-10 text-center",
      header: (
        <input
          type="checkbox"
          checked={filtered.length > 0 && filtered.every((row) => row.id && selectedStockIds.includes(row.id))}
          onChange={(e) => {
            if (e.target.checked) {
              const allFilteredIds = filtered.map((row) => row.id).filter(Boolean) as string[];
              setSelectedStockIds(allFilteredIds);
            } else {
              setSelectedStockIds([]);
            }
          }}
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-0 cursor-pointer"
        />
      ),
      key: "select",
      render: (row) => (
        <input
          type="checkbox"
          checked={row.id ? selectedStockIds.includes(row.id) : false}
          onChange={() => {
            if (!row.id) return;
            setSelectedStockIds((prev) =>
              prev.includes(row.id!) ? prev.filter((id) => id !== row.id) : [...prev, row.id!]
            );
          }}
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-0 cursor-pointer"
        />
      ),
    },
    { header: "Tag", key: "tag", render: (row) => <span className="font-medium text-zinc-950">{row.tag_no}</span> },
    {
      header: "Category",
      key: "category",
      render: (row) => (
        <div className="grid gap-0.5">
          <span>{row.category_name || "-"}</span>
          {row.sub_category_name ? <span className="text-xs text-zinc-500">{row.sub_category_name}</span> : null}
        </div>
      ),
    },
    { header: "Design", key: "design", render: (row) => row.design_no || "-" },
    { header: "Metal", key: "metal", render: (row) => row.metal_quality },
    {
      header: "Weights",
      key: "weights",
      render: (row) => (
        <div className="grid gap-1 text-xs text-zinc-600">
          <span>G {row.gross_weight}g</span>
          <span>N {row.net_weight}g</span>
        </div>
      ),
    },
    {
      header: "Diamond",
      key: "diamond",
      render: (row) => (
        <div className="grid gap-1 text-xs text-zinc-600">
          <span>D {row.diamond_weight || "0"} ct</span>
          <span>S {row.stone_weight || "0"} ct</span>
          <span>{row.diamond_pieces || 0} pcs</span>
        </div>
      ),
    },
    {
      header: "Status",
      key: "status",
      render: (row) => (
        <Select
          aria-label="Change stock status"
          className="h-8"
          onChange={(event) => setRowStatus(row, event.target.value as StockItem["status"])}
          value={row.status}
        >
          {stockStatuses.map((item) => (
            <option key={item} value={item}>
              {normalizeStatus(item)}
            </option>
          ))}
        </Select>
      ),
    },
    {
      className: "text-right",
      header: "Actions",
      key: "actions",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button aria-label="Edit stock item" onClick={() => openStockForm(row)} size="icon" variant="ghost">
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button aria-label="Delete stock item" onClick={() => deleteStock(row)} size="icon" variant="ghost">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        actions={
          <div className="flex gap-2">
            <Button
              disabled={loading || selectedStockIds.length === 0}
              onClick={() => {
                setError("");
                setStartPosition(1);
                setIsPrintDialogOpen(true);
              }}
              variant="secondary"
            >
              <Printer className="h-4 w-4" />
              Tag Print ({selectedStockIds.length})
            </Button>
            <Button disabled={loading} onClick={() => openStockForm({ ...emptyStock })}>
              <Plus className="h-4 w-4" />
              Add Stock
            </Button>
          </div>
        }
        eyebrow="Inventory"
        title="Stock"
      />
      <section className="grid gap-4 p-4 sm:p-6 lg:p-8">
        {message ? <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">{message}</div> : null}
        {loading ? (
          <Loader label="Loading stock..." />
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              {stockStatuses.slice(0, 3).map((item) => (
                <div className="rounded-lg border border-zinc-200 bg-white p-4" key={item}>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{normalizeStatus(item)}</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">{rows.filter((row) => row.status === item).length}</p>
                </div>
              ))}
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total Weight</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-950">
                  {rows.reduce((sum, row) => sum + Number(row.net_weight || 0), 0).toFixed(3)}g
                </p>
              </div>
            </div>

            {selectedStockIds.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 shadow-sm backdrop-blur-sm transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white">
                    {selectedStockIds.length}
                  </div>
                  <span className="text-sm font-medium text-indigo-900">
                    {selectedStockIds.length === 1 ? "item" : "items"} selected
                  </span>
                  <span className="text-zinc-300">|</span>
                  <button
                    onClick={() => setSelectedStockIds([])}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                  >
                    Clear selection
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Bulk Update Status:</span>
                  {stockStatuses.map((item) => (
                    <Button
                      key={item}
                      disabled={bulkUpdating}
                      onClick={() => handleBulkStatusUpdate(item)}
                      size="sm"
                      variant="secondary"
                      className="bg-white hover:bg-zinc-50 border-zinc-200 text-xs px-2.5 h-8 font-semibold shadow-xs"
                    >
                      {normalizeStatus(item)}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            <DataTable
              columns={columns}
              empty="No stock items match the current filters."
              filters={
                <>
                  <Select aria-label="Filter by status" onChange={(event) => setStatus(event.target.value)} value={status}>
                    <option value="ALL">All status</option>
                    {stockStatuses.map((item) => (
                      <option key={item} value={item}>
                        {normalizeStatus(item)}
                      </option>
                    ))}
                  </Select>
                  <Select aria-label="Filter by metal" onChange={(event) => setMetal(event.target.value)} value={metal}>
                    <option value="ALL">All metals</option>
                    {metalQualities.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                </>
              }
              rows={filtered}
              search={search}
              searchPlaceholder="Search tag, design, metal, diamond quality..."
              setSearch={setSearch}
            />
          </>
        )}
      </section>

      <Dialog onClose={closeStockForm} open={Boolean(editing)} title={`${editing?.id ? "Edit" : "Add"} Stock Item`}>
        {editing ? (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveStock();
            }}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <FieldWrap label="Tag No">
                <Input disabled value={editing.tag_no} onChange={(event) => updateForm("tag_no", event.target.value)} />
              </FieldWrap>
              <FieldWrap
                label="Design No (Optional)"
                hint={
                  designLookupStatus === "loading" ? "🔍 Looking up design..."
                    : designLookupStatus === "found" ? "✅ Design found — fields auto-filled"
                      : undefined
                }
              >
                <Input
                  value={editing.design_no ?? ""}
                  onChange={(event) => updateForm("design_no", event.target.value)}
                  placeholder="Enter design no to auto-fill fields"
                />
              </FieldWrap>
              <FieldWrap label="Metal Quality">
                <Select value={editing.metal_quality} onChange={(event) => updateForm("metal_quality", event.target.value)}>
                  {metalQualities.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </FieldWrap>
              <FieldWrap hint="Auto-filled from design, or select" label="Category">
                <Select
                  value={editing.category_id ?? ""}
                  onChange={(event) => {
                    const selectedId = event.target.value;
                    const selectedCat = categories.find((c) => c.id === selectedId);
                    setEditing((current) =>
                      current
                        ? { ...current, category_id: selectedId || undefined, category_name: selectedCat?.name }
                        : current,
                    );
                  }}
                >
                  <option value="">— Select category —</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
              </FieldWrap>
              <FieldWrap label="Gross Weight">
                <Input min="0" step="0.001" type="number" value={editing.gross_weight} onChange={(event) => updateForm("gross_weight", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="Diamond Weight (Carat)">
                <Input min="0" step="0.001" type="number" value={editing.diamond_weight ?? ""} onChange={(event) => updateForm("diamond_weight", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="CS Weight (Carat)">
                <Input min="0" step="0.001" type="number" value={editing.stone_weight ?? ""} onChange={(event) => updateForm("stone_weight", event.target.value)} />
              </FieldWrap>
              {/* <FieldWrap hint="Auto calculated: Carat × 0.2" label="D/S Weight (Gram)">
                <Input disabled value={((Number(editing.diamond_weight || 0) + Number(editing.stone_weight || 0)) * 0.2).toFixed(3)} />
              </FieldWrap> */}
              <FieldWrap hint="Auto calculated: Gross − (D+S)(g)" label="Net Weight">
                <Input disabled value={editing.net_weight} />
              </FieldWrap>
              <FieldWrap hint="Auto calculated: Net × Purity %" label="Pure Gold Weight">
                <Input disabled value={editing.pure_weight ?? "0.000"} />
              </FieldWrap>
              <FieldWrap label="Diamond Quality">
                <Input value={editing.diamond_quality ?? ""} onChange={(event) => updateForm("diamond_quality", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="Diamond Colour">
                <Input value={editing.diamond_color ?? ""} onChange={(event) => updateForm("diamond_color", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="Diamond Pieces">
                <Input
                  min="0"
                  step="1"
                  type="number"
                  value={editing.diamond_pieces ?? ""}
                  onChange={(event) => {
                    setError("");
                    setEditing((current) =>
                      current ? { ...current, diamond_pieces: Number(event.target.value || 0) } : current,
                    );
                  }
                  }
                />
              </FieldWrap>
              <FieldWrap label="Status">
                <Select value={editing.status} onChange={(event) => updateForm("status", event.target.value)}>
                  {stockStatuses.map((item) => (
                    <option key={item} value={item}>
                      {normalizeStatus(item)}
                    </option>
                  ))}
                </Select>
              </FieldWrap>
            </div>
            <FieldWrap label="Remarks">
              <Textarea value={editing.remarks ?? ""} onChange={(event) => updateForm("remarks", event.target.value)} />
            </FieldWrap>
            {error ? <Badge tone="red">{error}</Badge> : null}
            <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
              <Button onClick={closeStockForm} variant="secondary">
                Cancel
              </Button>
              <Button isLoading={saving} type="submit">
                <Save className="h-4 w-4" />
                Save
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>

      <Dialog onClose={() => setIsPrintDialogOpen(false)} open={isPrintDialogOpen} title="Print Jewelry Tags">
        <div className="grid gap-6">
          <div className="space-y-1">
            <p className="text-sm text-zinc-600">
              Generating PDF tag sheet for custom 11 cm page width (18 tags per page). Side A and Side B are printed side-by-side with a tiny gap inside the left 5 cm width. The remaining page width is left empty.
            </p>
          </div>

          <FieldWrap label="Start Position" hint="Select the row (1 to 18) to start printing on the first page.">
            <Select
              value={startPosition}
              onChange={(event) => setStartPosition(Number(event.target.value))}
            >
              {Array.from({ length: 18 }, (_, i) => i + 1).map((pos) => (
                <option key={pos} value={pos}>
                  Row {pos}
                </option>
              ))}
            </Select>
          </FieldWrap>

          {/* Tag Preview */}
          {(() => {
            const previewItem = rows.filter((row) => row.id && selectedStockIds.includes(row.id))[0];
            if (!previewItem) return null;
            return (
              <div className="space-y-2 border-t border-zinc-100 pt-4">
                <label className="text-sm font-semibold text-zinc-700">Visual Tag Preview (First Item)</label>
                <div className="flex items-center justify-center py-6 bg-zinc-50 rounded-lg border border-zinc-200 overflow-x-auto">
                  {/* Dumbbell Tag Mock */}
                  <div className="flex items-center gap-2 bg-transparent select-none">
                    {/* Left Rectangle (Side A) */}
                    <div className="w-[140px] h-[54px] bg-white border border-zinc-300 rounded shadow-xs p-1.5 flex gap-1 text-[8px] text-zinc-950 font-mono leading-none">
                      {/* Col 1 */}
                      <div className="flex-1 flex flex-col justify-between overflow-hidden">
                        <div className="font-bold truncate">{previewItem.design_no || "DESIGN"}</div>
                        <div>GW {previewItem.gross_weight || "0.000"}</div>
                        <div>NW {previewItem.net_weight || "0.000"}</div>
                        <div className="font-bold truncate">{previewItem.metal_quality || "18KT"}</div>
                      </div>
                      {/* Divider */}
                      <div className="w-[1px] bg-zinc-200 self-stretch"></div>
                      {/* Col 2 */}
                      <div className="flex-1 flex flex-col justify-between overflow-hidden">
                        <div className="font-bold truncate">{previewItem.tag_no || "TAG_NO"}</div>
                        <div>
                          DW {previewItem.diamond_weight || "0.000"}
                          {previewItem.diamond_pieces ? `/${previewItem.diamond_pieces}` : ""}
                        </div>
                        <div>CW {previewItem.stone_weight || "0.000"}</div>
                        <div className="truncate">
                          {[previewItem.diamond_color, previewItem.diamond_quality].filter(Boolean).join("/") || "-"}
                        </div>
                      </div>
                    </div>
                    
                    {/* Middle Stem Spacer */}
                    <div className="w-[8px] h-[14px] bg-zinc-300 rounded-xs"></div>
                    
                    {/* Right Rectangle (Side B) */}
                    <div className="w-[140px] h-[54px] bg-white border border-zinc-300 rounded shadow-xs p-1.5 flex gap-1 text-[8px] text-zinc-950 font-mono leading-none">
                      {/* Col 1 */}
                      <div className="flex-1 flex flex-col justify-between overflow-hidden">
                        <div className="font-bold truncate">{previewItem.design_no || "DESIGN"}</div>
                        <div>GW {previewItem.gross_weight || "0.000"}</div>
                        <div>NW {previewItem.net_weight || "0.000"}</div>
                        <div className="font-bold truncate">{previewItem.metal_quality || "18KT"}</div>
                      </div>
                      {/* Divider */}
                      <div className="w-[1px] bg-zinc-200 self-stretch"></div>
                      {/* Col 2 */}
                      <div className="flex-1 flex flex-col justify-between overflow-hidden">
                        <div className="font-bold truncate">{previewItem.tag_no || "TAG_NO"}</div>
                        <div>
                          DW {previewItem.diamond_weight || "0.000"}
                          {previewItem.diamond_pieces ? `/${previewItem.diamond_pieces}` : ""}
                        </div>
                        <div>CW {previewItem.stone_weight || "0.000"}</div>
                        <div className="truncate">
                          {[previewItem.diamond_color, previewItem.diamond_quality].filter(Boolean).join("/") || "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {error ? <Badge tone="red">{error}</Badge> : null}

          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4 mt-2">
            <Button onClick={() => setIsPrintDialogOpen(false)} variant="secondary">
              Cancel
            </Button>
            <Button isLoading={printing} onClick={handleDownloadTags}>
              <Printer className="h-4 w-4" />
              Generate PDF ({selectedStockIds.length} tag{selectedStockIds.length !== 1 ? "s" : ""})
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function normalizeStock(item: Record<string, unknown>): StockItem {
  // Extract category info: prefer direct fields, then nested design relation
  const design = item.design as Record<string, unknown> | null | undefined;
  const catFromDesign = design?.category as Record<string, unknown> | null | undefined;
  const subFromDesign = design?.subCategory as Record<string, unknown> | null | undefined;
  const catDirect = item.category as Record<string, unknown> | null | undefined;
  const subDirect = item.subCategory as Record<string, unknown> | null | undefined;

  // categoryId: direct scalar from Prisma > direct relation id > design relation id
  const categoryId = String(item.categoryId ?? item.category_id ?? catDirect?.id ?? catFromDesign?.id ?? "");
  const subCategoryId = String(item.subCategoryId ?? item.sub_category_id ?? subDirect?.id ?? subFromDesign?.id ?? "");
  const categoryName = String(catDirect?.name ?? catFromDesign?.name ?? item.category_name ?? "");
  const subCategoryName = String(subDirect?.name ?? subFromDesign?.name ?? item.sub_category_name ?? "");

  return {
    category_id: categoryId || undefined,
    sub_category_id: subCategoryId || undefined,
    category_name: categoryName || undefined,
    sub_category_name: subCategoryName || undefined,
    design_no: String(item.design_no ?? item.designNo ?? ""),
    diamond_color: String(item.diamond_color ?? item.diamondColor ?? ""),
    diamond_pieces: Number(item.diamond_pieces ?? item.diamondPieces ?? 0),
    diamond_quality: String(item.diamond_quality ?? item.diamondQuality ?? ""),
    diamond_weight: String(item.diamond_weight ?? item.diamondWeight ?? ""),
    gross_weight: String(item.gross_weight ?? item.grossWeight ?? ""),
    id: item.id ? String(item.id) : undefined,
    metal_quality: String(item.metal_quality ?? item.metalQuality ?? ""),
    net_weight: String(item.net_weight ?? item.netWeight ?? ""),
    pure_weight: String(item.pure_weight || item.pureWeight || "0.000"),
    remarks: item.remarks ? String(item.remarks) : undefined,
    status: String(item.status || "IN_STOCK") as StockItem["status"],
    stone_weight: String(item.stone_weight || item.stoneWeight || "0.000"),
    tag_no: String(item.tag_no || item.tagNo || ""),
  };
}

function toStockPayload(item: StockItem) {
  return {
    designNo: item.design_no || undefined,
    categoryId: item.category_id || undefined,
    subCategoryId: item.sub_category_id || undefined,
    diamondColor: item.diamond_color,
    diamondPieces: item.diamond_pieces,
    diamondQuality: item.diamond_quality,
    diamondWeight: item.diamond_weight,
    grossWeight: item.gross_weight,
    metalQuality: item.metal_quality,
    netWeight: item.net_weight,
    pureWeight: item.pure_weight,
    remarks: item.remarks?.trim() || undefined,
    status: item.status,
    stoneWeight: item.stone_weight,
    tagNo: item.tag_no,
  };
}


