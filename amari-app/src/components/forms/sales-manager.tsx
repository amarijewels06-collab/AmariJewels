"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Search, X, Printer, Edit2, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { DataTable, type Column } from "../ui/data-table";
import { Dialog } from "../ui/dialog";
import { FieldWrap, Input, Select } from "../ui/field";
import { Loader } from "../ui/loader";
import { PageHeader } from "../ui/page-header";
import { readJson, writeJson, deleteJson } from "./api";
import { useAppData } from "@/lib/app-data-context";

type SaleItem = {
  stock_id?: string;  // UUID of the stock record (for API calls)
  tag_no: string;
  design_no: string;
  metal_quality: string;
  gross_weight: string;
  net_weight: string;
  pure_weight: string;
  diamond_weight: string;
  diamond_color: string;
  diamond_quality: string;
  diamond_pieces: string;
  diamond_rate: string;
  stone_weight: string;
  cs_rate: string;
  labour_rate: string;
  ex_charge: string;
};

type Sale = {
  id?: string;
  invoice_no: string;
  customer_id: string;
  customer_name?: string;
  date: string;
  invoice_type: string;
  tax_type: string;
  // Add Job
  selected_job: string;
  stock_type: "Company" | "Customer" | "Memo" | "Sample";
  // Sold Items (Invoice level defaults if any, but now we use items array)
  items: SaleItem[];
  purity_ratio: string;
  wastage: string;
  metal_rate: string;
  diamond_rate: string;
  stone_rate: string;
  stone_rate_on_pcs: boolean;
  misc_rate: string;
  disc_percent: string;
  disc_amt: string;
  metal: string;
  labour_rate: string;
  cs_rate: string;
  ex_charge: string;
};

const emptySale: Sale = {
  invoice_no: "",
  customer_id: "",
  date: new Date().toISOString().slice(0, 10),
  invoice_type: "Labour Invoice",
  tax_type: "Select Tax Type",
  selected_job: "",
  stock_type: "Company",
  items: [],
  purity_ratio: "",
  wastage: "",
  metal_rate: "",
  diamond_rate: "",
  stone_rate: "",
  stone_rate_on_pcs: false,
  misc_rate: "",
  disc_percent: "",
  disc_amt: "",
  metal: "Gold",
  labour_rate: "",
  cs_rate: "",
  ex_charge: "",
};

export function SalesManager() {
  const { customers: rawCustomers } = useAppData();
  // Map shared context customers to the shape this component needs
  const customers = rawCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    address: c.address,
    mobile: c.mobile,
    city: c.city,
  }));

  const [rows, setRows] = useState<Sale[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [bulkInputs, setBulkInputs] = useState({
    diamond_rate: "",
    cs_rate: "",
    labour_rate: "",
    ex_charge: "",
  });

  useEffect(() => {
    readJson<Record<string, unknown>>("/api/sales?pageSize=100")
      .then((saleRes) => {
        const saleItems = (saleRes as any)?.items ?? saleRes;
        setRows(Array.isArray(saleItems) ? saleItems.map(normalizeSale) : []);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = [row.invoice_no, row.customer_name].filter(Boolean).join(" ").toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }, [rows, search]);

  function updateForm(key: keyof Sale, value: any) {
    setEditing((current) => (current ? { ...current, [key]: value } : current));
  }

  function onCustomerSelect(id: string) {
    const customer = customers.find((c) => c.id === id);
    setEditing((current) => {
      if (!current) return current;
      return {
        ...current,
        customer_id: id,
        customer_name: customer ? `${customer.name} - ${customer.code}` : "",
      };
    });
  }

  function updateItem(index: number, key: keyof SaleItem, value: string) {
    setEditing((current) => {
      if (!current) return current;
      const newItems = [...current.items];
      newItems[index] = { ...newItems[index], [key]: value };
      return { ...current, items: newItems };
    });
  }

  function onBulkUpdate(key: keyof typeof bulkInputs, value: string) {
    setBulkInputs(prev => ({ ...prev, [key]: value }));
    setEditing(current => {
      if (!current) return current;
      const newItems = [...current.items];
      selectedRows.forEach(index => {
        if (newItems[index]) {
          newItems[index] = { ...newItems[index], [key]: value };
        }
      });
      return { ...current, items: newItems };
    });
  }

  function toggleRowSelection(index: number) {
    setSelectedRows(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  }

  function toggleSelectAll() {
    if (!editing) return;
    if (selectedRows.length === editing.items.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(editing.items.map((_, i) => i));
    }
  }

  function removeItem(index: number) {
    setEditing((current) => {
      if (!current) return current;
      const newItems = [...current.items];
      newItems.splice(index, 1);
      return { ...current, items: newItems };
    });
  }

  function onAddTag() {
    const tagNo = editing?.selected_job?.trim();
    if (!tagNo) return;

    // Prevent duplicate tags
    const alreadyAdded = editing?.items.some(
      (i) => i.tag_no.trim().toLowerCase() === tagNo.toLowerCase()
    );
    if (alreadyAdded) {
      alert(`Tag "${tagNo}" has already been added to this sale.`);
      return;
    }

    readJson<any>(`/api/stock?tagNo=${encodeURIComponent(tagNo)}`)
      .then((result) => {
        // Find the exact matching item from the response
        let item: any = null;
        if (Array.isArray(result)) {
          item = result.find(
            (r: any) =>
              (r.tag_no || r.tagNo || "").toLowerCase() === tagNo.toLowerCase()
          );
        } else if (result && ((result as any).tag_no || (result as any).tagNo || "").toLowerCase() === tagNo.toLowerCase()) {
          item = result;
        }

        if (!item) {
          alert("Tag not found in stock.");
          return;
        }

        // Block adding a tag that is already SOLD
        const itemStatus = (item.status || "").toUpperCase();
        if (itemStatus === "SOLD") {
          alert(`Tag "${tagNo}" is already SOLD and cannot be added to a new sale.`);
          return;
        }

        const purityMapping: Record<string, number> = {
          "24KT": 1.0, "22KT": 0.916, "18KT": 0.76, "14KT": 0.6, "10KT": 0.42, "9KT": 0.4,
          "24K": 1.0, "22K": 0.916, "18K": 0.76,
        };

        const newItem: SaleItem = {
          stock_id: item.id || item._id || undefined, // UUID for API calls
          tag_no: tagNo, // always use what the user typed
          design_no: item.design_no || item.designNo || "",
          metal_quality: item.metal_quality || item.metalQuality || "18KT",
          gross_weight: String(item.gross_weight || item.grossWeight || "0"),
          net_weight: String(item.net_weight || item.netWeight || "0"),
          pure_weight: String(item.pure_weight || item.pureWeight || "0"),
          diamond_weight: String(item.diamond_weight || item.diamondWeight || "0"),
          diamond_color: item.diamond_color || item.diamondColor || "",
          diamond_quality: item.diamond_quality || item.diamondQuality || "",
          diamond_pieces: String(item.diamond_pieces || item.diamondPieces || "0"),
          diamond_rate: "",
          stone_weight: String(item.stone_weight || item.stoneWeight || "0"),
          cs_rate: "",
          labour_rate: "",
          ex_charge: "",
        };

        setEditing((current) => {
          if (!current) return current;
          return {
            ...current,
            selected_job: "", // Clear after adding
            items: [...current.items, newItem],
            purity_ratio: String(purityMapping[item.metal_quality] || purityMapping[item.metalQuality] || current.purity_ratio),
            metal: item.metal_quality || item.metalQuality || current.metal,
          };
        });
      })
      .catch((err) => {
        console.error("Error fetching tag:", err);
        alert("Error fetching tag data.");
      });
  }

  function openSaleForm(sale: Sale) {
    setEditing(sale);
  }

  function closeSaleForm() {
    setEditing(null);
    setSelectedRows([]);
    setBulkInputs({
      diamond_rate: "",
      cs_rate: "",
      labour_rate: "",
      ex_charge: "",
    });
  }

  async function saveSale() {
    if (!editing) return;

    if (!editing.customer_id && !editing.customer_name?.trim()) {
      alert("Customer ID/Name is required.");
      return;
    }

    setSaving(true);
    try {
      // Map frontend snake_case to backend camelCase
      const payload = {
        invoiceNo: editing.invoice_no,
        customerId: editing.customer_id,
        customerName: editing.customer_name,
        date: editing.date,
        invoiceType: editing.invoice_type,
        selectedJob: editing.selected_job,
        stockType: editing.stock_type,
        purityRatio: editing.purity_ratio,
        wastage: editing.wastage,
        metalRate: editing.metal_rate,
        diamondRate: editing.diamond_rate,
        stoneRate: editing.stone_rate,
        stoneRateOnPcs: editing.stone_rate_on_pcs,
        miscRate: editing.misc_rate,
        discPercent: editing.disc_percent,
        discAmt: editing.disc_amt,
        metal: editing.metal,
        labourRate: editing.labour_rate,
        items: editing.items,
      };

      // Save the sale — capture response to get server-generated invoiceNo
      const saved = await writeJson(editing.id ? `/api/sales/${editing.id}` : "/api/sales", editing.id ? "PUT" : "POST", payload);
      const savedSale = normalizeSale(saved ?? editing);

      // If we are editing, check if any items were removed and restock them
      if (editing.id) {
        const originalSale = rows.find((r) => r.id === editing.id);
        const originalStockIds = originalSale
          ? (originalSale.items || []).map((item) => item.stock_id).filter(Boolean) as string[]
          : [];
        const newStockIds = editing.items
          .map((item) => item.stock_id)
          .filter(Boolean) as string[];
        const removedStockIds = originalStockIds.filter((id) => !newStockIds.includes(id));

        if (removedStockIds.length > 0) {
          await writeJson("/api/stock/bulk-status", "PATCH", {
            ids: removedStockIds,
            status: "IN_STOCK",
          });
        }
      }

      // Mark each tag in the sale as SOLD in stock using bulk API
      const stockIds = editing.items
        .map((item) => item.stock_id)
        .filter(Boolean) as string[];

      if (stockIds.length > 0) {
        await writeJson("/api/stock/bulk-status", "PATCH", {
          ids: stockIds,
          status: "SOLD",
        });
      }

      // ── Auto-post DEBIT entry to Customer Ledger ──
      if (savedSale.customer_id) {
        const totalAmount = (savedSale.items || []).reduce((sum: number, item: SaleItem) => {
          return (
            sum +
            Number(item.diamond_weight || 0) * Number(item.diamond_rate || 0) +
            Number(item.stone_weight || 0) * Number(item.cs_rate || 0) +
            Number(item.labour_rate || 0) * Number(item.net_weight || 0) +
            Number(item.ex_charge || 0)
          );
        }, 0);

        const totalGold = (savedSale.items || []).reduce(
          (sum: number, item: SaleItem) => sum + (Number(item.pure_weight || 0)), 0
        );

        // Convert INV-XXXXXX → SI-XXXXXX for ledger
        const ledgerInvoiceNo = savedSale.invoice_no
          ? savedSale.invoice_no.replace(/^INV-/, "SI-")
          : undefined;

        const ledgerPayload = {
          customerId: savedSale.customer_id,
          saleId: savedSale.id,
          date: savedSale.date,
          invoiceNo: ledgerInvoiceNo,
          particular: `Sales Invoice ${ledgerInvoiceNo || "DRAFT"}`,
          side: "DEBIT",
          goldGm: totalGold || undefined,
          totalAmount: totalAmount || undefined,
        };

        try {
          if (editing.id) {
            // Update existing ledger entry linked to this sale
            const existingEntries = await readJson<any>(
              `/api/accounts/customer-ledger?pageSize=1&saleId=${savedSale.id}`
            );
            const existing = Array.isArray(existingEntries) ? existingEntries[0] : null;
            if (existing?.id) {
              await writeJson(`/api/accounts/customer-ledger/${existing.id}`, "PUT", ledgerPayload);
            } else {
              await writeJson("/api/accounts/customer-ledger", "POST", ledgerPayload);
            }
          } else {
            await writeJson("/api/accounts/customer-ledger", "POST", ledgerPayload);
          }
        } catch (ledgerErr) {
          console.warn("Failed to auto-post ledger entry:", ledgerErr);
        }
      }

      // Update list with server-confirmed data (includes real invoiceNo)
      setRows((current) => {
        if (editing.id) {
          return current.map((r) => (r.id === editing.id ? savedSale : r));
        }
        return [savedSale, ...current];
      });
      closeSaleForm();
      setMessage("Sale saved successfully.");
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSale(sale: Sale) {
    if (!sale.id) return;
    if (!confirm(`Delete invoice ${sale.invoice_no || "DRAFT"}? This will restock all items.`)) return;

    try {
      // Soft-delete the sale
      await deleteJson(`/api/sales/${sale.id}`);

      // Restock all items from this sale
      const stockIds = (sale.items || [])
        .map((item) => item.stock_id)
        .filter(Boolean) as string[];

      if (stockIds.length > 0) {
        await writeJson("/api/stock/bulk-status", "PATCH", {
          ids: stockIds,
          status: "IN_STOCK",
        });
      }

      // Remove linked ledger entry
      try {
        const ledgerEntries = await readJson<any>(
          `/api/accounts/customer-ledger?pageSize=1&saleId=${sale.id}`
        );
        const ledgerEntry = Array.isArray(ledgerEntries) ? ledgerEntries[0] : null;
        if (ledgerEntry?.id) {
          await deleteJson(`/api/accounts/customer-ledger/${ledgerEntry.id}`);
        }
      } catch {
        // Non-critical — continue
      }

      setRows((current) => current.filter((r) => r.id !== sale.id));
      setMessage(`Invoice ${sale.invoice_no || "DRAFT"} deleted and items restocked.`);
    } catch (error) {
      console.error(error);
      alert("Failed to delete sale.");
    }
  }

  async function printSale(sale: Sale) {
    const customer = customers.find(c => c.id === sale.customer_id);
    const { generateSaleInvoicePdf } = await import("@/lib/generate-sale-pdf");
    const doc = await generateSaleInvoicePdf(sale, customer);
    doc.save(`${sale.invoice_no || 'sales_invoice'}.pdf`);
  }

  const columns: Column<Sale>[] = [
    { header: "Invoice No", key: "invoice_no", render: (row) => <span className="font-medium">{row.invoice_no || "DRAFT"}</span> },
    { header: "Customer", key: "customer", render: (row) => row.customer_name || row.customer_id || "-" },
    { header: "Date", key: "date", render: (row) => row.date },
    { header: "Type", key: "type", render: (row) => row.invoice_type },
    {
      header: "Amount",
      key: "amount",
      render: (row) => {
        const total = (row.items || []).reduce((sum: number, item: SaleItem) => {
          return (
            sum +
            Number(item.diamond_weight || 0) * Number(item.diamond_rate || 0) +
            Number(item.stone_weight || 0) * Number(item.cs_rate || 0) +
            Number(item.labour_rate || 0) * Number(item.net_weight || 0) +
            Number(item.ex_charge || 0)
          );
        }, 0);
        return total > 0 ? total.toFixed(2) : "0.00";
      },
    },
    {
      header: "Action",
      key: "action",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => openSaleForm(row)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50" onClick={() => printSale(row)}>
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteSale(row)}>
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
          <Button onClick={() => openSaleForm({ ...emptySale })}>
            <Plus className="h-4 w-4" />
            Add Sales
          </Button>
        }
        eyebrow="Transactions"
        title="Sales"
      />

      <section className="grid gap-4 p-4 sm:p-6 lg:p-8">
        {message ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        {loading ? (
          <Loader label="Loading sales..." />
        ) : (
          <DataTable
            columns={columns}
            empty="No sales records found."
            rows={filtered}
            search={search}
            searchPlaceholder="Search invoice or customer..."
            setSearch={setSearch}
          />
        )}
      </section>

      <Dialog
        onClose={closeSaleForm}
        open={Boolean(editing)}
        title="Sales"
        className="!sm:max-w-7xl"
      >
        {editing ? (
          <div className="flex flex-col gap-6">

            {/* Invoice Details Section */}
            <div className="overflow-hidden rounded-sm border border-zinc-200 shadow-sm">
              <div className="bg-[#5f6368] px-4 py-2 text-xs font-bold text-white uppercase tracking-wider">
                Invoice Details :
              </div>
              <div className="grid gap-x-4 gap-y-4 p-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                <FieldWrap label="Customer">
                  <Select value={editing.customer_id} onChange={(e) => onCustomerSelect(e.target.value)} className="h-9 text-xs w-full">
                    <option value="">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </FieldWrap>
                <div className="sm:col-span-2">
                  <FieldWrap label="Customer ID/Name">
                    <Input value={editing.customer_name ?? ""} onChange={(e) => updateForm("customer_name", e.target.value)} className="h-9 text-xs w-full" />
                  </FieldWrap>
                </div>
                <FieldWrap label="Date">
                  <Input type="date" value={editing.date} onChange={(e) => updateForm("date", e.target.value)} className="h-9 text-xs w-full" />
                </FieldWrap>
                <FieldWrap label="Invoice Type">
                  <Select value={editing.invoice_type} onChange={(e) => updateForm("invoice_type", e.target.value)} className="h-9 text-xs w-full">
                    <option value="Labour Invoice">Labour Invoice</option>
                    <option value="Sales Invoice">Sales Invoice</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="Tax Type">
                  <Select value={editing.tax_type} onChange={(e) => updateForm("tax_type", e.target.value)} className="h-9 text-xs w-full">
                    <option>Select Tax Type</option>
                  </Select>
                </FieldWrap>

              </div>
            </div>

            {/* Add Tag Section */}
            <div className="overflow-hidden rounded-sm border border-zinc-200 shadow-sm">
              <div className="bg-[#5f6368] px-4 py-2 text-xs font-bold text-white uppercase tracking-wider">
                Add Tag
              </div>
              <div className="flex flex-col gap-6 p-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <FieldWrap label="Select Tag">
                      <Input value={editing.selected_job} onChange={(e) => updateForm("selected_job", e.target.value)} className="h-9 text-xs w-full" />
                    </FieldWrap>
                  </div>
                  <Button variant="secondary" onClick={onAddTag} className="h-9 text-xs px-4 border-zinc-300">Add Tag</Button>
                </div>
              </div>
            </div>

            {/* Sold Items Section - Table Layout from Reference Image */}
            <div className="overflow-hidden rounded-sm border border-zinc-200 shadow-sm">
              <div className="bg-[#5f6368] px-4 py-2 text-xs font-bold text-white uppercase tracking-wider flex justify-between items-center">
                <span>Sold Items & Pricing</span>
                {editing.items.length > 0 && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded">Items: {editing.items.length}</span>}
              </div>
              
              {/* Bulk Update Controls */}
              {selectedRows.length > 1 && (
                <div className="bg-zinc-100 p-3 border-b border-zinc-200 flex flex-wrap gap-4 items-end animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase w-full mb-1">Bulk Update ({selectedRows.length} rows selected)</div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-zinc-600">Diamond Price</label>
                    <Input 
                      value={bulkInputs.diamond_rate} 
                      onChange={(e) => onBulkUpdate("diamond_rate", e.target.value)} 
                      className="h-8 text-xs w-28 bg-white" 
                      placeholder="Enter Price"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-zinc-600">CS Rate</label>
                    <Input 
                      value={bulkInputs.cs_rate} 
                      onChange={(e) => onBulkUpdate("cs_rate", e.target.value)} 
                      className="h-8 text-xs w-28 bg-white" 
                      placeholder="Enter Rate"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-zinc-600">Labour Rate</label>
                    <Input 
                      value={bulkInputs.labour_rate} 
                      onChange={(e) => onBulkUpdate("labour_rate", e.target.value)} 
                      className="h-8 text-xs w-28 bg-white" 
                      placeholder="Enter Rate"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-zinc-600">EX Charge</label>
                    <Input 
                      value={bulkInputs.ex_charge} 
                      onChange={(e) => onBulkUpdate("ex_charge", e.target.value)} 
                      className="h-8 text-xs w-28 bg-white" 
                      placeholder="Enter Charge"
                    />
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse">
                  <thead className="bg-[#f8f9fa] border-b border-zinc-200">
                    <tr className="divide-x divide-zinc-200">
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap w-8">
                        <input 
                          type="checkbox" 
                          className="h-3 w-3 rounded border-zinc-300 text-zinc-900 focus:ring-0"
                          checked={editing.items.length > 0 && selectedRows.length === editing.items.length}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Tag No.</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Design no.</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Matal KT</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Gross Wt</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Net Wt</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">pure Gold</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Diamond wt</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Diamond Color</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Diamond quality</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Diamond pcs</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Diamond Rate</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Total Diamond Amount</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">CS Wt</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Cs Rate</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Cs Amount</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Labour Rate</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Total Labour Amount</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Ex Charge</th>
                      <th className="px-2 py-2 font-bold text-emerald-700 uppercase text-center whitespace-nowrap bg-emerald-50">Total Amount</th>
                      <th className="px-2 py-2 font-bold text-zinc-600 uppercase text-center whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editing.items.length === 0 ? (
                      <tr>
                        <td colSpan={21} className="p-8 text-center text-zinc-400 italic">No items added yet. Enter a tag above to add items.</td>
                      </tr>
                    ) : (
                      editing.items.map((item, idx) => (
                        <tr key={idx} className={`divide-x divide-zinc-200 border-b border-zinc-100 hover:bg-zinc-50/50 ${selectedRows.includes(idx) ? "bg-blue-50/30" : ""}`}>
                          <td className="p-1 text-center">
                            <input 
                              type="checkbox" 
                              className="h-3 w-3 rounded border-zinc-300 text-zinc-900 focus:ring-0"
                              checked={selectedRows.includes(idx)}
                              onChange={() => toggleRowSelection(idx)}
                            />
                          </td>
                          <td className="p-1 text-center">
                            <Input value={item.tag_no} onChange={(e) => updateItem(idx, "tag_no", e.target.value)} className="h-7 text-[10px] w-20 text-center border-none shadow-none focus:ring-0 bg-transparent" />
                          </td>
                          <td className="p-1 text-center">
                            <span className="font-medium">{item.design_no || "—"}</span>
                          </td>
                          <td className="p-1 text-center font-bold">
                            {item.metal_quality || "—"}
                          </td>
                          <td className="p-1 text-center">
                            {item.gross_weight || "0.000"}
                          </td>
                          <td className="p-1 text-center">
                            {item.net_weight || "0.000"}
                          </td>
                          <td className="p-1 text-center">
                            {item.pure_weight || "0.000"}
                          </td>
                          <td className="p-1 text-center">
                            {item.diamond_weight || "0.000"}
                          </td>
                          <td className="p-1 text-center">
                            {item.diamond_color || "—"}
                          </td>
                          <td className="p-1 text-center">
                            {item.diamond_quality || "—"}
                          </td>
                          <td className="p-1 text-center">
                            {item.diamond_pieces || "0"}
                          </td>
                          <td className="p-1">
                            <Input value={item.diamond_rate} onChange={(e) => updateItem(idx, "diamond_rate", e.target.value)} className="h-7 text-[10px] w-24 text-center" placeholder="Rate" />
                          </td>
                          <td className="p-1 text-center font-bold text-zinc-900">
                            {(Number(item.diamond_weight || 0) * Number(item.diamond_rate || 0)).toFixed(2)}
                          </td>
                          <td className="p-1 text-center">
                            {item.stone_weight || "0.000"}
                          </td>
                          <td className="p-1">
                            <Input value={item.cs_rate} onChange={(e) => updateItem(idx, "cs_rate", e.target.value)} className="h-7 text-[10px] w-20 text-center" placeholder="Rate" />
                          </td>
                          <td className="p-1 text-center font-bold text-zinc-900">
                            {(Number(item.stone_weight || 0) * Number(item.cs_rate || 0)).toFixed(2)}
                          </td>
                          <td className="p-1">
                            <Input value={item.labour_rate} onChange={(e) => updateItem(idx, "labour_rate", e.target.value)} className="h-7 text-[10px] w-20 text-center" placeholder="Rate" />
                          </td>
                          <td className="p-1 text-center font-bold text-zinc-900">
                            {(Number(item.labour_rate || 0) * Number(item.net_weight || 0)).toFixed(2)}
                          </td>
                          <td className="p-1">
                            <Input value={item.ex_charge} onChange={(e) => updateItem(idx, "ex_charge", e.target.value)} className="h-7 text-[10px] w-20 text-center" placeholder="Charge" />
                          </td>
                          <td className="p-1 text-center font-bold text-emerald-700 bg-emerald-50/30">
                            {(
                              Number(item.diamond_weight || 0) * Number(item.diamond_rate || 0) +
                              Number(item.stone_weight || 0) * Number(item.cs_rate || 0) +
                              Number(item.labour_rate || 0) * Number(item.net_weight || 0) +
                              Number(item.ex_charge || 0)
                            ).toFixed(2)}
                          </td>
                          <td className="p-1 text-center">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeItem(idx)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
            </div>


            <div className="flex justify-between gap-2 border-t border-zinc-200 pt-6">
              <Button onClick={closeSaleForm} className="bg-[#2563eb] text-white hover:bg-[#1d4ed8] h-10 px-6 font-bold text-xs uppercase tracking-wider rounded-sm">
                GO TO LIST
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={closeSaleForm} className="h-10 px-6 text-xs font-bold uppercase tracking-wider border-zinc-300">
                  Cancel
                </Button>
                <Button isLoading={saving} onClick={saveSale} className="h-10 px-8 text-xs font-bold uppercase tracking-wider">
                  <Save className="mr-2 h-4 w-4" />
                  Save Sale
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

function normalizeSale(item: any): Sale {
  const customer = item.customer as { id?: string; name?: string; code?: string } | undefined;
  return {
    ...emptySale,
    id: item.id || item._id,
    invoice_no: item.invoice_no || item.invoiceNo || "",
    customer_id: item.customer_id || item.customerId || customer?.id || "",
    customer_name: item.customer_name || (customer ? `${customer.name || ""} - ${customer.code || ""}` : ""),
    date: item.date
      ? String(item.date).slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    invoice_type: item.invoice_type || item.invoiceType || "Labour Invoice",
    tax_type: item.tax_type || item.taxType || "Select Tax Type",
    selected_job: item.selected_job || item.selectedJob || "",
    stock_type: item.stock_type || item.stockType || "Company",
    items: Array.isArray(item.items) ? item.items : [],
    purity_ratio: String(item.purity_ratio ?? item.purityRatio ?? ""),
    wastage: String(item.wastage ?? ""),
    metal_rate: String(item.metal_rate ?? item.metalRate ?? ""),
    diamond_rate: String(item.diamond_rate ?? item.diamondRate ?? ""),
    stone_rate: String(item.stone_rate ?? item.stoneRate ?? ""),
    stone_rate_on_pcs: item.stone_rate_on_pcs || item.stoneRateOnPcs || false,
    misc_rate: String(item.misc_rate ?? item.miscRate ?? ""),
    disc_percent: String(item.disc_percent ?? item.discPercent ?? ""),
    disc_amt: String(item.disc_amt ?? item.discAmt ?? ""),
    metal: item.metal || "Gold",
    labour_rate: String(item.labour_rate ?? item.labourRate ?? ""),
    cs_rate: String(item.cs_rate ?? item.csRate ?? ""),
    ex_charge: String(item.ex_charge ?? item.exCharge ?? ""),
  };
}
