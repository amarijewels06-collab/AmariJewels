"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Users, Wallet, Download } from "lucide-react";
import { Button } from "../ui/button";
import { Loader } from "../ui/loader";
import { PageHeader } from "../ui/page-header";
import { readJson } from "./api";
import { useAppData } from "@/lib/app-data-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type LedgerRow = {
  customer_id: string;
  side: "DEBIT" | "CREDIT";
  gold_gm: string;
  diamond_carat: string;
  stone_carat: string;
  other_metals_gm: string;
  total_amount: string;
};

type Totals = { gold: number; diamond: number; stone: number; otherMetals: number; amount: number };
const zeroTotals = (): Totals => ({ gold: 0, diamond: 0, stone: 0, otherMetals: 0, amount: 0 });

type CustomerBalance = {
  id: string;
  name: string;
  code: string;
  mobile: string;
  net: Totals; // positive = debit-heavy, negative = credit-heavy
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const accountTabs = [
  { key: "customer-ledger", label: "Customer Ledger", icon: BookOpen, href: "/accounts/customer-ledger" },
  { key: "supplier-ledger", label: "Supplier Ledger", icon: Users, href: "/accounts/supplier-ledger" },
  { key: "customer-balance", label: "Customer Balance", icon: Wallet, href: "/accounts/customer-balance" },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomerBalanceManager() {
  const pathname = usePathname();
  const router = useRouter();
  const { customers: rawCustomers } = useAppData();
  const customers = rawCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    mobile: c.mobile || "",
  }));

  const [entries, setEntries] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    readJson<Record<string, unknown>>("/api/accounts/customer-ledger?pageSize=500")
      .then((rows) =>
        setEntries(
          rows.map((r: any) => ({
            customer_id: r.customer_id || r.customerId || "",
            side: r.side || "DEBIT",
            gold_gm: String(r.gold_gm ?? r.goldGm ?? ""),
            diamond_carat: String(r.diamond_carat ?? r.diamondCarat ?? ""),
            stone_carat: String(r.stone_carat ?? r.stoneCarat ?? ""),
            other_metals_gm: String(r.other_metals_gm ?? r.otherMetalsGm ?? ""),
            total_amount: String(r.total_amount ?? r.totalAmount ?? ""),
          }))
        )
      )
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  // Net balance per customer (Dr − Cr)
  const balances: CustomerBalance[] = useMemo(() => {
    const map = new Map<string, { debit: Totals; credit: Totals }>();

    for (const e of entries) {
      if (!e.customer_id) continue;
      if (!map.has(e.customer_id)) map.set(e.customer_id, { debit: zeroTotals(), credit: zeroTotals() });
      const bucket = map.get(e.customer_id)!;
      const t = e.side === "DEBIT" ? bucket.debit : bucket.credit;
      t.gold += Number(e.gold_gm) || 0;
      t.diamond += Number(e.diamond_carat) || 0;
      t.stone += Number(e.stone_carat) || 0;
      t.otherMetals += Number(e.other_metals_gm) || 0;
      t.amount += Number(e.total_amount) || 0;
    }

    return customers
      .filter((c) => map.has(c.id))
      .map((c) => {
        const b = map.get(c.id)!;
        return {
          ...c,
          net: {
            gold: b.debit.gold - b.credit.gold,
            diamond: b.debit.diamond - b.credit.diamond,
            stone: b.debit.stone - b.credit.stone,
            otherMetals: b.debit.otherMetals - b.credit.otherMetals,
            amount: b.debit.amount - b.credit.amount,
          },
        };
      });
  }, [entries, customers]);

  // Grand net totals
  const grandNet = useMemo(
    () =>
      balances.reduce(
        (acc, b) => ({
          gold: acc.gold + b.net.gold,
          diamond: acc.diamond + b.net.diamond,
          stone: acc.stone + b.net.stone,
          otherMetals: acc.otherMetals + b.net.otherMetals,
          amount: acc.amount + b.net.amount,
        }),
        zeroTotals()
      ),
    [balances]
  );

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { generateCustomerBalancePdf } = await import("@/lib/generate-ledger-pdf");
      const doc = generateCustomerBalancePdf({
        balances,
        grandNet,
      });
      doc.save("Customer_Balance_Report.pdf");
    } catch (err) {
      console.error("Failed to export PDF", err);
      alert("Failed to export PDF.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        actions={
          <Button variant="secondary" onClick={handleExportPdf} isLoading={exporting}>
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
        }
        eyebrow="Account"
        title="Customer Balance"
      />

      {/* Tab bar */}
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
                  active ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-500 hover:text-zinc-800",
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
        {loading ? (
          <Loader label="Calculating balances..." />
        ) : balances.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-zinc-200 bg-white py-16 text-zinc-400">
            <Wallet className="h-10 w-10 mb-3" />
            <p className="text-sm">No customer balances yet.</p>
            <p className="text-xs mt-1">Add ledger entries to see balances here.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  {/* Group headers */}
                  <tr>
                    <th colSpan={3} className="bg-zinc-700 text-white text-center py-2 text-xs font-bold uppercase tracking-wider border-r border-zinc-500">
                      Customer
                    </th>
                    <th colSpan={5} className="bg-amber-600 text-white text-center py-2 text-xs font-bold uppercase tracking-wider border-r border-amber-400">
                      Debit
                    </th>
                    <th colSpan={5} className="bg-emerald-600 text-white text-center py-2 text-xs font-bold uppercase tracking-wider">
                      Credit
                    </th>
                  </tr>
                  {/* Sub-headers */}
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Code</th>
                    <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Name</th>
                    <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase whitespace-nowrap border-r-2 border-zinc-300">Mobile</th>
                    {/* Debit cols */}
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Gold</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Diamond</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Stone</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Other</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r-2 border-zinc-300">Amount</th>
                    {/* Credit cols */}
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Gold</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Diamond</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Stone</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap border-r border-zinc-200">Other</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-600 uppercase whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => (
                    <tr key={b.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                      {/* Customer */}
                      <td className="px-2 py-1.5 whitespace-nowrap border-r border-zinc-100 font-medium text-zinc-700">{b.code}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap border-r border-zinc-100">{b.name}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap border-r-2 border-zinc-200 text-zinc-500">{b.mobile || "—"}</td>
                      {/* Debit — show value only if net is positive */}
                      <td className="px-2 py-1.5 text-center border-r border-zinc-100 text-amber-700">{side(b.net.gold, "dr", 3)}</td>
                      <td className="px-2 py-1.5 text-center border-r border-zinc-100 text-amber-700">{side(b.net.diamond, "dr", 3)}</td>
                      <td className="px-2 py-1.5 text-center border-r border-zinc-100 text-amber-700">{side(b.net.stone, "dr", 3)}</td>
                      <td className="px-2 py-1.5 text-center border-r border-zinc-100 text-amber-700">{side(b.net.otherMetals, "dr", 3)}</td>
                      <td className="px-2 py-1.5 text-center border-r-2 border-zinc-200 font-bold text-amber-700">{side(b.net.amount, "dr", 2)}</td>
                      {/* Credit — show value only if net is negative */}
                      <td className="px-2 py-1.5 text-center border-r border-zinc-100 text-emerald-700">{side(b.net.gold, "cr", 3)}</td>
                      <td className="px-2 py-1.5 text-center border-r border-zinc-100 text-emerald-700">{side(b.net.diamond, "cr", 3)}</td>
                      <td className="px-2 py-1.5 text-center border-r border-zinc-100 text-emerald-700">{side(b.net.stone, "cr", 3)}</td>
                      <td className="px-2 py-1.5 text-center border-r border-zinc-100 text-emerald-700">{side(b.net.otherMetals, "cr", 3)}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-emerald-700">{side(b.net.amount, "cr", 2)}</td>
                    </tr>
                  ))}
                </tbody>

                {/* Grand totals */}
                <tfoot>
                  <tr className="bg-zinc-100 border-t-2 border-zinc-300 font-bold text-[11px]">
                    <td colSpan={3} className="px-2 py-2 text-right uppercase tracking-wider text-zinc-600 border-r-2 border-zinc-300">
                      Grand Total
                    </td>
                    {/* Debit grand */}
                    <td className="px-2 py-2 text-center border-r border-zinc-200 text-amber-700">{side(grandNet.gold, "dr", 3)}</td>
                    <td className="px-2 py-2 text-center border-r border-zinc-200 text-amber-700">{side(grandNet.diamond, "dr", 3)}</td>
                    <td className="px-2 py-2 text-center border-r border-zinc-200 text-amber-700">{side(grandNet.stone, "dr", 3)}</td>
                    <td className="px-2 py-2 text-center border-r border-zinc-200 text-amber-700">{side(grandNet.otherMetals, "dr", 3)}</td>
                    <td className="px-2 py-2 text-center border-r-2 border-zinc-300 text-amber-700">{side(grandNet.amount, "dr", 2)}</td>
                    {/* Credit grand */}
                    <td className="px-2 py-2 text-center border-r border-zinc-200 text-emerald-700">{side(grandNet.gold, "cr", 3)}</td>
                    <td className="px-2 py-2 text-center border-r border-zinc-200 text-emerald-700">{side(grandNet.diamond, "cr", 3)}</td>
                    <td className="px-2 py-2 text-center border-r border-zinc-200 text-emerald-700">{side(grandNet.stone, "cr", 3)}</td>
                    <td className="px-2 py-2 text-center border-r border-zinc-200 text-emerald-700">{side(grandNet.otherMetals, "cr", 3)}</td>
                    <td className="px-2 py-2 text-center text-emerald-700">{side(grandNet.amount, "cr", 2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Show the net value on the correct side: positive → debit, negative → credit (as absolute) */
function side(net: number, col: "dr" | "cr", decimals: number): string {
  if (col === "dr") return net > 0 ? net.toFixed(decimals) : "—";
  return net < 0 ? Math.abs(net).toFixed(decimals) : "—";
}
