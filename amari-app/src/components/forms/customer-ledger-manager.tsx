"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Plus,
  Save,
  Edit2,
  Trash2,
  Users,
  CreditCard,
  Wallet,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { FieldWrap, Input, Select, Textarea } from "../ui/field";
import { Loader } from "../ui/loader";
import { PageHeader } from "../ui/page-header";
import { readJson, writeJson, deleteJson } from "./api";
import { useAppData } from "@/lib/app-data-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type LedgerEntry = {
  id?: string;
  customer_id: string;
  customer_name?: string;
  sale_id?: string;
  date: string;
  invoice_no: string;
  particular: string;
  remarks: string;
  side: "DEBIT" | "CREDIT";
  gold_gm: string;
  diamond_carat: string;
  stone_carat: string;
  other_metals_gm: string;
  total_amount: string;
};

const emptyEntry = (side: "DEBIT" | "CREDIT"): LedgerEntry => ({
  customer_id: "",
  date: new Date().toISOString().slice(0, 10),
  invoice_no: "",
  particular: "",
  remarks: "",
  side,
  gold_gm: "",
  diamond_carat: "",
  stone_carat: "",
  other_metals_gm: "",
  total_amount: "",
});

// ─── Tab definitions ──────────────────────────────────────────────────────────

const accountTabs = [
  { key: "customer-ledger", label: "Customer Ledger", icon: BookOpen, href: "/accounts/customer-ledger" },
  { key: "supplier-ledger", label: "Supplier Ledger", icon: Users, href: "/accounts/supplier-ledger" },
  { key: "customer-balance", label: "Customer Balance", icon: Wallet, href: "/accounts/customer-balance" },
] as const;

// ─── Main component ──────────────────────────────────────────────────────────

export function CustomerLedgerManager() {
  const pathname = usePathname();
  const router = useRouter();
  const { customers: rawCustomers } = useAppData();
  const customers = rawCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
  }));

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("ALL");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfInvoiceNo, setPdfInvoiceNo] = useState("");
  const [pdfDocRef, setPdfDocRef] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  // Fetch ledger entries when date range changes
  useEffect(() => {
    setLoading(true);
    let url = "/api/accounts/customer-ledger?pageSize=500";
    if (appliedStartDate) url += `&startDate=${appliedStartDate}`;
    if (appliedEndDate) url += `&endDate=${appliedEndDate}`;

    readJson<Record<string, unknown>>(url)
      .then((rows) => setEntries(rows.map(normalizeEntry)))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [appliedStartDate, appliedEndDate]);

  const handleSearch = () => {
    setAppliedStartDate(startDateInput);
    setAppliedEndDate(endDateInput);
  };

  const handleClear = () => {
    setStartDateInput("");
    setEndDateInput("");
    setAppliedStartDate("");
    setAppliedEndDate("");
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const cust = customers.find((c) => c.id === selectedCustomerId);
      const customerName = cust ? `${cust.name} (${cust.code})` : "All Customers";
      const dateRange =
        appliedStartDate || appliedEndDate
          ? `${appliedStartDate || "Start"} to ${appliedEndDate || "End"}`
          : "All Dates";

      const { generateCustomerLedgerPdf } = await import("@/lib/generate-ledger-pdf");
      const doc = generateCustomerLedgerPdf({
        debitEntries,
        creditEntries,
        debitTotals,
        creditTotals,
        customerName,
        dateRange,
      });
      doc.save(`Customer_Ledger_${customerName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
    } catch (err) {
      console.error("Failed to export PDF", err);
      alert("Failed to export PDF.");
    } finally {
      setExporting(false);
    }
  };

  // Filter by customer
  const filtered = useMemo(() => {
    if (selectedCustomerId === "ALL") return entries;
    return entries.filter((e) => e.customer_id === selectedCustomerId);
  }, [entries, selectedCustomerId]);

  // Split into debit and credit
  const debitEntries = useMemo(() => filtered.filter((e) => e.side === "DEBIT"), [filtered]);
  const creditEntries = useMemo(() => filtered.filter((e) => e.side === "CREDIT"), [filtered]);

  // Calculate totals
  const debitTotals = useMemo(() => calcTotals(debitEntries), [debitEntries]);
  const creditTotals = useMemo(() => calcTotals(creditEntries), [creditEntries]);

  async function openNew(side: "DEBIT" | "CREDIT") {
    const entry = emptyEntry(side);
    if (selectedCustomerId !== "ALL") {
      entry.customer_id = selectedCustomerId;
      const cust = customers.find((c) => c.id === selectedCustomerId);
      entry.customer_name = cust ? `${cust.name} - ${cust.code}` : "";
    }
    // Auto-generate RC-XXXXXX for manual entries
    if (!entry.sale_id) {
      const rcNumbers = entries
        .map((e) => e.invoice_no)
        .filter((inv) => inv.startsWith("RC-"))
        .map((inv) => Number(inv.replace("RC-", "")))
        .filter((n) => !isNaN(n));
      const nextNum = rcNumbers.length > 0 ? Math.max(...rcNumbers) + 1 : 1;
      entry.invoice_no = `RC-${String(nextNum).padStart(6, "0")}`;
    }
    setEditing(entry);
  }

  function openEdit(entry: LedgerEntry) {
    setEditing({ ...entry });
  }

  function closeForm() {
    setEditing(null);
  }

  function updateForm(key: keyof LedgerEntry, value: string) {
    setEditing((current) => (current ? { ...current, [key]: value } : current));
  }

  function onCustomerChange(id: string) {
    const cust = customers.find((c) => c.id === id);
    setEditing((current) => {
      if (!current) return current;
      return {
        ...current,
        customer_id: id,
        customer_name: cust ? `${cust.name} - ${cust.code}` : "",
      };
    });
  }

  async function saveEntry() {
    if (!editing) return;
    if (!editing.customer_id) {
      alert("Please select a customer.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customerId: editing.customer_id,
        saleId: editing.sale_id || undefined,
        date: editing.date,
        invoiceNo: editing.invoice_no || undefined,
        particular: editing.particular || undefined,
        remarks: editing.remarks || undefined,
        side: editing.side,
        goldGm: editing.gold_gm || undefined,
        diamondCarat: editing.diamond_carat || undefined,
        stoneCarat: editing.stone_carat || undefined,
        otherMetalsGm: editing.other_metals_gm || undefined,
        totalAmount: editing.total_amount || undefined,
      };

      const saved = await writeJson(
        editing.id ? `/api/accounts/customer-ledger/${editing.id}` : "/api/accounts/customer-ledger",
        editing.id ? "PUT" : "POST",
        payload
      );

      const normalized = normalizeEntry(saved ?? editing);

      setEntries((current) => {
        if (editing.id) {
          return current.map((e) => (e.id === editing.id ? normalized : e));
        }
        return [normalized, ...current];
      });
      closeForm();
      setMessage("Ledger entry saved.");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error(error);
      alert("Failed to save entry.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entry: LedgerEntry) {
    if (!entry.id) return;
    if (!confirm(`Delete this ${entry.side.toLowerCase()} entry?`)) return;
    try {
      await deleteJson(`/api/accounts/customer-ledger/${entry.id}`);
      setEntries((current) => current.filter((e) => e.id !== entry.id));
      setMessage("Entry deleted.");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      alert("Failed to delete entry.");
    }
  }

  async function viewInvoice(saleId: string, invoiceNo: string) {
    setPdfLoading(true);
    setPdfInvoiceNo(invoiceNo);
    try {
      const res = await fetch(`/api/sales/${saleId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sale");
      const raw = (await res.json()) as Record<string, any>;
      const sale = {
        id: String(raw.id),
        invoice_no: String(raw.invoice_no ?? raw.invoiceNo ?? ""),
        customer_id: String(raw.customer_id ?? raw.customerId ?? ""),
        customer_name: String(raw.customer_name ?? raw.customerName ?? raw.customer?.name ?? ""),
        date: String(raw.date ?? "").slice(0, 10),
        items: Array.isArray(raw.items)
          ? raw.items.map((i: any) => ({
              tag_no: String(i.tag_no ?? i.tagNo ?? ""),
              design_no: String(i.design_no ?? i.designNo ?? ""),
              metal_quality: String(i.metal_quality ?? i.metalQuality ?? ""),
              gross_weight: String(i.gross_weight ?? i.grossWeight ?? ""),
              net_weight: String(i.net_weight ?? i.netWeight ?? ""),
              pure_weight: String(i.pure_weight ?? i.pureWeight ?? ""),
              diamond_weight: String(i.diamond_weight ?? i.diamondWeight ?? ""),
              diamond_color: String(i.diamond_color ?? i.diamondColor ?? ""),
              diamond_quality: String(i.diamond_quality ?? i.diamondQuality ?? ""),
              diamond_pieces: String(i.diamond_pieces ?? i.diamondPieces ?? ""),
              diamond_rate: String(i.diamond_rate ?? i.diamondRate ?? ""),
              stone_weight: String(i.stone_weight ?? i.stoneWeight ?? ""),
              cs_rate: String(i.cs_rate ?? i.csRate ?? ""),
              labour_rate: String(i.labour_rate ?? i.labourRate ?? ""),
              ex_charge: String(i.ex_charge ?? i.exCharge ?? ""),
            }))
          : [],
      };

      const cust = rawCustomers.find((c) => c.id === sale.customer_id);
      const { generateSaleInvoicePdf } = await import("@/lib/generate-sale-pdf");
      const doc = await generateSaleInvoicePdf(sale, cust ? { mobile: cust.mobile, address: cust.address, city: cust.city } : null);

      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setPdfDocRef(doc);
    } catch (err) {
      console.error("Failed to generate invoice PDF", err);
      alert("Failed to load invoice.");
      setPdfInvoiceNo("");
    } finally {
      setPdfLoading(false);
    }
  }

  // Maximum rows to align both sides
  const maxRows = Math.max(debitEntries.length, creditEntries.length, 1);

  return (
    <>
      <PageHeader
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleExportPdf} isLoading={exporting}>
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
            <Button variant="secondary" onClick={() => openNew("CREDIT")}>
              <Plus className="h-4 w-4" />
              Add Credit
            </Button>
            <Button onClick={() => openNew("DEBIT")}>
              <Plus className="h-4 w-4" />
              Add Debit
            </Button>
          </div>
        }
        eyebrow="Account"
        title="Customer Ledger"
      />

      {/* Tab Bar — same style as Design Manager */}
      <div className="border-b border-zinc-200 bg-white px-4 sm:px-6 lg:px-8">
        <nav className="-mb-px flex gap-6 overflow-x-auto whitespace-nowrap scrollbar-none">
          {accountTabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <button
                key={tab.key}
                onClick={() => router.push(tab.href)}
                className={[
                  "flex-shrink-0 flex items-center gap-2 border-b-2 pb-3 pt-3 text-sm font-medium transition-colors",
                  active
                    ? "border-zinc-950 text-zinc-950"
                    : "border-transparent text-zinc-500 hover:text-zinc-800",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <section className="p-4 sm:p-6 lg:p-8">
        {message && (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {/* Filters Panel */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="mb-6 flex flex-wrap items-center gap-4 bg-zinc-50 p-4 rounded-lg border border-zinc-200"
        >
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 whitespace-nowrap">Customer:</label>
            <Select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="h-9 text-sm w-64 bg-white"
            >
              <option value="ALL">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 whitespace-nowrap">From Date:</label>
            <Input
              type="date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              className="h-9 text-sm w-40 bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 whitespace-nowrap">To Date:</label>
            <Input
              type="date"
              value={endDateInput}
              onChange={(e) => setEndDateInput(e.target.value)}
              className="h-9 text-sm w-40 bg-white"
            />
          </div>

          <Button type="submit" className="h-9 px-4 text-xs">
            Search
          </Button>

          {(startDateInput || endDateInput || appliedStartDate || appliedEndDate) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-9 text-zinc-500 hover:text-zinc-800"
            >
              Clear Dates
            </Button>
          )}
        </form>

        {loading ? (
          <Loader label="Loading ledger..." />
        ) : (
          <>
          {/* Desktop view: side-by-side tables */}
          <div className="hidden lg:block overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  {/* Side headers */}
                  <tr>
                    <th
                      colSpan={10}
                      className="bg-amber-600 text-white text-center py-2 text-xs font-bold uppercase tracking-wider border-r border-amber-400"
                    >
                      Debit
                    </th>
                    <th
                      colSpan={10}
                      className="bg-emerald-600 text-white text-center py-2 text-xs font-bold uppercase tracking-wider"
                    >
                      Credit
                    </th>
                  </tr>
                  {/* Column headers */}
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    {/* Debit columns */}
                    <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Date</th>
                    <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Invoice No</th>
                    <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Particular</th>
                    <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Remarks</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Gold (gm)</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Diamond (ct)</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Stone (ct)</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Other (gm)</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Amount</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r-2 border-zinc-300">Action</th>
                    {/* Credit columns */}
                    <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Date</th>
                    <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Invoice No</th>
                    <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Particular</th>
                    <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Remarks</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Gold (gm)</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Diamond (ct)</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Stone (ct)</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Other (gm)</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Amount</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {maxRows === 0 || (debitEntries.length === 0 && creditEntries.length === 0) ? (
                    <tr>
                      <td colSpan={20} className="p-8 text-center text-zinc-400 italic">
                        No ledger entries found. Add a debit or credit entry to get started.
                      </td>
                    </tr>
                  ) : (
                    Array.from({ length: maxRows }).map((_, idx) => {
                      const dr = debitEntries[idx];
                      const cr = creditEntries[idx];
                      return (
                        <tr
                          key={idx}
                          className="border-b border-zinc-100 hover:bg-zinc-50/50"
                        >
                          {/* Debit side */}
                          {dr ? (
                            <>
                              <td className="px-2 py-1.5 whitespace-nowrap border-r border-zinc-100">{dr.date}</td>
                              <td className="px-2 py-1.5 whitespace-nowrap border-r border-zinc-100 font-medium text-amber-700">
                                {dr.sale_id && dr.invoice_no?.startsWith("SI-") ? (
                                  <button
                                    onClick={() => viewInvoice(dr.sale_id!, dr.invoice_no)}
                                    className="underline decoration-amber-300 hover:decoration-amber-600 cursor-pointer"
                                  >
                                    {dr.invoice_no}
                                  </button>
                                ) : (dr.invoice_no || "—")}
                              </td>
                              <td className="px-2 py-1.5 border-r border-zinc-100 max-w-[140px] truncate">{dr.particular || "—"}</td>
                              <td className="px-2 py-1.5 border-r border-zinc-100 max-w-[100px] truncate text-zinc-500">{dr.remarks || "—"}</td>
                              <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(dr.gold_gm)}</td>
                              <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(dr.diamond_carat)}</td>
                              <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(dr.stone_carat)}</td>
                              <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(dr.other_metals_gm)}</td>
                              <td className="px-2 py-1.5 text-center border-r border-zinc-100 font-bold">{fmtAmt(dr.total_amount)}</td>
                              <td className="px-1 py-1.5 text-center border-r-2 border-zinc-200">
                                <div className="flex justify-center gap-0.5">
                                  {!dr.sale_id && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-600 hover:text-amber-800 hover:bg-amber-50" onClick={() => openEdit(dr)}>
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {!dr.sale_id && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteEntry(dr)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </>
                          ) : (
                            <td colSpan={10} className="border-r-2 border-zinc-200" />
                          )}

                          {/* Credit side */}
                          {cr ? (
                            <>
                              <td className="px-2 py-1.5 whitespace-nowrap border-r border-zinc-100">{cr.date}</td>
                              <td className="px-2 py-1.5 whitespace-nowrap border-r border-zinc-100 font-medium text-emerald-700">
                                {cr.sale_id && cr.invoice_no?.startsWith("SI-") ? (
                                  <button
                                    onClick={() => viewInvoice(cr.sale_id!, cr.invoice_no)}
                                    className="underline decoration-emerald-300 hover:decoration-emerald-600 cursor-pointer"
                                  >
                                    {cr.invoice_no}
                                  </button>
                                ) : (cr.invoice_no || "—")}
                              </td>
                              <td className="px-2 py-1.5 border-r border-zinc-100 max-w-[140px] truncate">{cr.particular || "—"}</td>
                              <td className="px-2 py-1.5 border-r border-zinc-100 max-w-[100px] truncate text-zinc-500">{cr.remarks || "—"}</td>
                              <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(cr.gold_gm)}</td>
                              <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(cr.diamond_carat)}</td>
                              <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(cr.stone_carat)}</td>
                              <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(cr.other_metals_gm)}</td>
                              <td className="px-2 py-1.5 text-center border-r border-zinc-100 font-bold">{fmtAmt(cr.total_amount)}</td>
                              <td className="px-1 py-1.5 text-center">
                                <div className="flex justify-center gap-0.5">
                                  {!cr.sale_id && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50" onClick={() => openEdit(cr)}>
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {!cr.sale_id && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteEntry(cr)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </>
                          ) : (
                            <td colSpan={10} />
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Totals footer */}
                {(debitEntries.length > 0 || creditEntries.length > 0) && (
                  <tfoot>
                    <tr className="bg-zinc-100 border-t-2 border-zinc-300 font-bold text-[11px]">
                      {/* Debit totals */}
                      <td colSpan={4} className="px-2 py-2 text-right uppercase tracking-wider text-zinc-600 border-r border-zinc-200">
                        Debit Total
                      </td>
                      <td className="px-2 py-2 text-center border-r border-zinc-200">{debitTotals.gold.toFixed(3)}</td>
                      <td className="px-2 py-2 text-center border-r border-zinc-200">{debitTotals.diamond.toFixed(3)}</td>
                      <td className="px-2 py-2 text-center border-r border-zinc-200">{debitTotals.stone.toFixed(3)}</td>
                      <td className="px-2 py-2 text-center border-r border-zinc-200">{debitTotals.otherMetals.toFixed(3)}</td>
                      <td className="px-2 py-2 text-center border-r border-zinc-200 text-amber-700">{debitTotals.amount.toFixed(2)}</td>
                      <td className="border-r-2 border-zinc-300" />
                      {/* Credit totals */}
                      <td colSpan={4} className="px-2 py-2 text-right uppercase tracking-wider text-zinc-600 border-r border-zinc-200">
                        Credit Total
                      </td>
                      <td className="px-2 py-2 text-center border-r border-zinc-200">{creditTotals.gold.toFixed(3)}</td>
                      <td className="px-2 py-2 text-center border-r border-zinc-200">{creditTotals.diamond.toFixed(3)}</td>
                      <td className="px-2 py-2 text-center border-r border-zinc-200">{creditTotals.stone.toFixed(3)}</td>
                      <td className="px-2 py-2 text-center border-r border-zinc-200">{creditTotals.otherMetals.toFixed(3)}</td>
                      <td className="px-2 py-2 text-center text-emerald-700">{creditTotals.amount.toFixed(2)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Mobile view: sequential stacked tables */}
          <div className="block lg:hidden space-y-6">
            {/* Debit Table */}
            <div className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
              <div className="bg-amber-600 text-white text-center py-2 text-xs font-bold uppercase tracking-wider">
                Debit Entries
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Date</th>
                      <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Invoice No</th>
                      <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Particular</th>
                      <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Remarks</th>
                      <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Gold (gm)</th>
                      <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Diamond (ct)</th>
                      <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Stone (ct)</th>
                      <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Other (gm)</th>
                      <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Amount</th>
                      <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {debitEntries.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-6 text-center text-zinc-400 italic">No debit entries found.</td>
                      </tr>
                    ) : (
                      debitEntries.map((dr, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/50">
                          <td className="px-2 py-1.5 whitespace-nowrap border-r border-zinc-100">{dr.date}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap border-r border-zinc-100 font-medium text-amber-700">
                            {dr.sale_id && dr.invoice_no?.startsWith("SI-") ? (
                              <button
                                onClick={() => viewInvoice(dr.sale_id!, dr.invoice_no)}
                                className="underline decoration-amber-300 hover:decoration-amber-600 cursor-pointer"
                              >
                                {dr.invoice_no}
                              </button>
                            ) : (dr.invoice_no || "—")}
                          </td>
                          <td className="px-2 py-1.5 border-r border-zinc-100 max-w-[140px] truncate">{dr.particular || "—"}</td>
                          <td className="px-2 py-1.5 border-r border-zinc-100 max-w-[100px] truncate text-zinc-500">{dr.remarks || "—"}</td>
                          <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(dr.gold_gm)}</td>
                          <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(dr.diamond_carat)}</td>
                          <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(dr.stone_carat)}</td>
                          <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(dr.other_metals_gm)}</td>
                          <td className="px-2 py-1.5 text-center border-r border-zinc-100 font-bold">{fmtAmt(dr.total_amount)}</td>
                          <td className="px-1 py-1.5 text-center">
                            <div className="flex justify-center gap-0.5">
                              {!dr.sale_id && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-600 hover:text-amber-800 hover:bg-amber-50" onClick={() => openEdit(dr)}>
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                              )}
                              {!dr.sale_id && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteEntry(dr)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {debitEntries.length > 0 && (
                    <tfoot>
                      <tr className="bg-zinc-100 border-t-2 border-zinc-300 font-bold text-[11px]">
                        <td colSpan={4} className="px-2 py-2 text-right uppercase tracking-wider text-zinc-600 border-r border-zinc-200">Debit Total</td>
                        <td className="px-2 py-2 text-center border-r border-zinc-200">{debitTotals.gold.toFixed(3)}</td>
                        <td className="px-2 py-2 text-center border-r border-zinc-200">{debitTotals.diamond.toFixed(3)}</td>
                        <td className="px-2 py-2 text-center border-r border-zinc-200">{debitTotals.stone.toFixed(3)}</td>
                        <td className="px-2 py-2 text-center border-r border-zinc-200">{debitTotals.otherMetals.toFixed(3)}</td>
                        <td className="px-2 py-2 text-center border-r border-zinc-200 text-amber-700">{debitTotals.amount.toFixed(2)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Credit Table */}
            <div className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
              <div className="bg-emerald-600 text-white text-center py-2 text-xs font-bold uppercase tracking-wider">
                Credit Entries
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Date</th>
                      <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Invoice No</th>
                      <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Particular</th>
                      <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Remarks</th>
                      <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Gold (gm)</th>
                      <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Diamond (ct)</th>
                      <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Stone (ct)</th>
                      <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Other (gm)</th>
                      <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Amount</th>
                      <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {creditEntries.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-6 text-center text-zinc-400 italic">No credit entries found.</td>
                      </tr>
                    ) : (
                      creditEntries.map((cr, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/50">
                          <td className="px-2 py-1.5 whitespace-nowrap border-r border-zinc-100">{cr.date}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap border-r border-zinc-100 font-medium text-emerald-700">
                            {cr.sale_id && cr.invoice_no?.startsWith("SI-") ? (
                              <button
                                onClick={() => viewInvoice(cr.sale_id!, cr.invoice_no)}
                                className="underline decoration-emerald-300 hover:decoration-emerald-600 cursor-pointer"
                              >
                                {cr.invoice_no}
                              </button>
                            ) : (cr.invoice_no || "—")}
                          </td>
                          <td className="px-2 py-1.5 border-r border-zinc-100 max-w-[140px] truncate">{cr.particular || "—"}</td>
                          <td className="px-2 py-1.5 border-r border-zinc-100 max-w-[100px] truncate text-zinc-500">{cr.remarks || "—"}</td>
                          <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(cr.gold_gm)}</td>
                          <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(cr.diamond_carat)}</td>
                          <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(cr.stone_carat)}</td>
                          <td className="px-2 py-1.5 text-center border-r border-zinc-100">{fmtNum(cr.other_metals_gm)}</td>
                          <td className="px-2 py-1.5 text-center border-r border-zinc-100 font-bold">{fmtAmt(cr.total_amount)}</td>
                          <td className="px-1 py-1.5 text-center">
                            <div className="flex justify-center gap-0.5">
                              {!cr.sale_id && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50" onClick={() => openEdit(cr)}>
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                              )}
                              {!cr.sale_id && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteEntry(cr)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {creditEntries.length > 0 && (
                    <tfoot>
                      <tr className="bg-zinc-100 border-t-2 border-zinc-300 font-bold text-[11px]">
                        <td colSpan={4} className="px-2 py-2 text-right uppercase tracking-wider text-zinc-600 border-r border-zinc-200">Credit Total</td>
                        <td className="px-2 py-2 text-center border-r border-zinc-200">{creditTotals.gold.toFixed(3)}</td>
                        <td className="px-2 py-2 text-center border-r border-zinc-200">{creditTotals.diamond.toFixed(3)}</td>
                        <td className="px-2 py-2 text-center border-r border-zinc-200">{creditTotals.stone.toFixed(3)}</td>
                        <td className="px-2 py-2 text-center border-r border-zinc-200">{creditTotals.otherMetals.toFixed(3)}</td>
                        <td className="px-2 py-2 text-center text-emerald-700">{creditTotals.amount.toFixed(2)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          {/* Balance summary — vertical layout */}
          {(debitEntries.length > 0 || creditEntries.length > 0) && (
            <div className="mt-4 w-full max-w-xs rounded-md border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-zinc-800 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">
                Balance (Dr − Cr)
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    { label: "Gold (gm)", val: debitTotals.gold - creditTotals.gold, fmt: 3 },
                    { label: "Diamond (ct)", val: debitTotals.diamond - creditTotals.diamond, fmt: 3 },
                    { label: "Stone (ct)", val: debitTotals.stone - creditTotals.stone, fmt: 3 },
                    { label: "Other Metals (gm)", val: debitTotals.otherMetals - creditTotals.otherMetals, fmt: 3 },
                    { label: "Total Amount (₹)", val: debitTotals.amount - creditTotals.amount, fmt: 2 },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-zinc-100 last:border-b-0">
                      <td className="px-4 py-2 text-xs font-medium text-zinc-600">{row.label}</td>
                      <td className={`px-4 py-2 text-xs font-bold text-right ${balColor(row.val)}`}>
                        {row.val.toFixed(row.fmt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </>
        )}
      </section>

      {/* ── Add/Edit Dialog ── */}
      <Dialog
        onClose={closeForm}
        open={Boolean(editing)}
        title={editing?.id ? `Edit ${editing.side === "DEBIT" ? "Debit" : "Credit"} Entry` : `New ${editing?.side === "DEBIT" ? "Debit" : "Credit"} Entry`}
      >
        {editing && (
          <div className="flex flex-col gap-5">
            {/* Side selector */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-600">Side:</label>
              <Select
                value={editing.side}
                onChange={(e) => updateForm("side", e.target.value)}
                className={`h-9 text-xs font-bold w-40 ${
                  editing.side === "DEBIT"
                    ? "text-amber-700 border-amber-300"
                    : "text-emerald-700 border-emerald-300"
                }`}
              >
                <option value="DEBIT">DEBIT</option>
                <option value="CREDIT">CREDIT</option>
              </Select>
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <FieldWrap label="Customer *">
                <Select
                  value={editing.customer_id}
                  onChange={(e) => onCustomerChange(e.target.value)}
                  className="h-9 text-xs w-full"
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </Select>
              </FieldWrap>
              <FieldWrap label="Date *">
                <Input
                  type="date"
                  value={editing.date}
                  onChange={(e) => updateForm("date", e.target.value)}
                  className="h-9 text-xs w-full"
                />
              </FieldWrap>
              <FieldWrap label="Invoice No">
                <Input
                  value={editing.invoice_no}
                  onChange={(e) => updateForm("invoice_no", e.target.value)}
                  className="h-9 text-xs w-full"
                  placeholder={editing.side === "DEBIT" ? "SI-000001" : "RC-000001"}
                  readOnly={!editing.id && !editing.sale_id}
                />
              </FieldWrap>
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <FieldWrap label="Particular">
                <Input
                  value={editing.particular}
                  onChange={(e) => updateForm("particular", e.target.value)}
                  className="h-9 text-xs w-full"
                  placeholder="e.g. Sales Invoice, Cash Receipt..."
                />
              </FieldWrap>
              <FieldWrap label="Remarks">
                <Input
                  value={editing.remarks}
                  onChange={(e) => updateForm("remarks", e.target.value)}
                  className="h-9 text-xs w-full"
                  placeholder="Optional remarks"
                />
              </FieldWrap>
            </div>

            {/* Quantities */}
            <div className="overflow-hidden rounded-sm border border-zinc-200">
              <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider text-white ${
                editing.side === "DEBIT" ? "bg-amber-600" : "bg-emerald-600"
              }`}>
                Quantities & Amount
              </div>
              <div className="grid gap-4 p-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                <FieldWrap label="Gold (gm)">
                  <Input
                    type="number"
                    step="0.001"
                    value={editing.gold_gm}
                    onChange={(e) => updateForm("gold_gm", e.target.value)}
                    className="h-9 text-xs w-full"
                    placeholder="0.000"
                  />
                </FieldWrap>
                <FieldWrap label="Diamond (carat)">
                  <Input
                    type="number"
                    step="0.001"
                    value={editing.diamond_carat}
                    onChange={(e) => updateForm("diamond_carat", e.target.value)}
                    className="h-9 text-xs w-full"
                    placeholder="0.000"
                  />
                </FieldWrap>
                <FieldWrap label="Stone (carat)">
                  <Input
                    type="number"
                    step="0.001"
                    value={editing.stone_carat}
                    onChange={(e) => updateForm("stone_carat", e.target.value)}
                    className="h-9 text-xs w-full"
                    placeholder="0.000"
                  />
                </FieldWrap>
                <FieldWrap label="Other Metals (gm)">
                  <Input
                    type="number"
                    step="0.001"
                    value={editing.other_metals_gm}
                    onChange={(e) => updateForm("other_metals_gm", e.target.value)}
                    className="h-9 text-xs w-full"
                    placeholder="0.000"
                  />
                </FieldWrap>
                <FieldWrap label="Total Amount (₹)">
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.total_amount}
                    onChange={(e) => updateForm("total_amount", e.target.value)}
                    className="h-9 text-xs w-full font-bold"
                    placeholder="0.00"
                  />
                </FieldWrap>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
              <Button variant="secondary" onClick={closeForm} className="h-9 px-6 text-xs">
                Cancel
              </Button>
              <Button isLoading={saving} onClick={saveEntry} className="h-9 px-8 text-xs">
                <Save className="mr-2 h-4 w-4" />
                {editing.id ? "Update" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── PDF Viewer Modal ── */}
      {(pdfUrl || pdfLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="relative flex flex-col bg-white rounded-lg shadow-2xl w-[95vw] h-[90vh] max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
              <h2 className="text-sm font-semibold text-zinc-800">
                {pdfInvoiceNo ? `Invoice: ${pdfInvoiceNo}` : "Sales Invoice"}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => pdfDocRef?.save(`${pdfInvoiceNo || "invoice"}.pdf`)}
                  disabled={!pdfDocRef}
                  className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  onClick={() => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); setPdfUrl(null); setPdfDocRef(null); setPdfInvoiceNo(""); }}
                  className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* Body */}
            <div className="flex-1 p-2">
              {pdfLoading ? (
                <div className="flex h-full items-center justify-center gap-2 text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Generating invoice…</span>
                </div>
              ) : pdfUrl ? (
                <iframe src={pdfUrl} className="w-full h-full rounded border border-zinc-200" title="Invoice PDF" />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeEntry(item: any): LedgerEntry {
  const customer = item.customer as { id?: string; name?: string; code?: string } | undefined;
  return {
    id: item.id || item._id,
    customer_id: item.customer_id || item.customerId || customer?.id || "",
    customer_name: item.customer_name || (customer ? `${customer.name || ""} - ${customer.code || ""}` : ""),
    sale_id: item.sale_id || item.saleId || undefined,
    date: item.date ? String(item.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    invoice_no: item.invoice_no || item.invoiceNo || "",
    particular: item.particular || "",
    remarks: item.remarks || "",
    side: item.side || "DEBIT",
    gold_gm: String(item.gold_gm ?? item.goldGm ?? ""),
    diamond_carat: String(item.diamond_carat ?? item.diamondCarat ?? ""),
    stone_carat: String(item.stone_carat ?? item.stoneCarat ?? ""),
    other_metals_gm: String(item.other_metals_gm ?? item.otherMetalsGm ?? ""),
    total_amount: String(item.total_amount ?? item.totalAmount ?? ""),
  };
}

function calcTotals(entries: LedgerEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      gold: acc.gold + (Number(e.gold_gm) || 0),
      diamond: acc.diamond + (Number(e.diamond_carat) || 0),
      stone: acc.stone + (Number(e.stone_carat) || 0),
      otherMetals: acc.otherMetals + (Number(e.other_metals_gm) || 0),
      amount: acc.amount + (Number(e.total_amount) || 0),
    }),
    { gold: 0, diamond: 0, stone: 0, otherMetals: 0, amount: 0 }
  );
}

function fmtNum(val: string): string {
  const n = Number(val);
  return n ? n.toFixed(3) : "—";
}

function fmtAmt(val: string): string {
  const n = Number(val);
  return n ? n.toFixed(2) : "—";
}

function balColor(val: number): string {
  if (val > 0) return "text-amber-700";
  if (val < 0) return "text-red-600";
  return "text-zinc-600";
}
