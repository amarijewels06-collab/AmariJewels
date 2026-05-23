"use client";

import { Gem, Package, PaintBucket, Truck, Users } from "lucide-react";
import { Badge, statusTone } from "../ui/badge";
import { Loader } from "../ui/loader";
import { PageHeader } from "../ui/page-header";
import { useAppData } from "@/lib/app-data-context";

export function DashboardClient() {
  const { customers, suppliers, stock, designs, loading } = useAppData();

  const widgets = [
    { accent: "bg-emerald-500", icon: Users, label: "Customers", value: customers.length },
    { accent: "bg-sky-500", icon: Truck, label: "Suppliers", value: suppliers.length },
    { accent: "bg-amber-500", icon: Package, label: "Stock Items", value: stock.length },
    { accent: "bg-rose-500", icon: PaintBucket, label: "Designs", value: designs.length },
  ];

  return (
    <>
      <PageHeader eyebrow="Today" title="Dashboard" />
      <section className="grid gap-5 p-4 sm:p-6 lg:p-8">
        {loading ? (
          <Loader label="Loading dashboard..." />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {widgets.map((item) => {
                const Icon = item.icon;
                return (
                  <div className="rounded-lg border border-zinc-200 bg-white p-5" key={item.label}>
                    <div className="flex items-center justify-between">
                      <span className={`h-2 w-10 rounded-full ${item.accent}`} />
                      <Icon className="h-5 w-5 text-zinc-400" />
                    </div>
                    <p className="mt-5 text-sm font-medium text-zinc-500">{item.label}</p>
                    <p className="mt-1 text-3xl font-semibold text-zinc-950">{item.value}</p>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <section className="rounded-lg border border-zinc-200 bg-white">
                <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
                  <h2 className="text-base font-semibold text-zinc-950">Stock Position</h2>
                  <Gem className="h-5 w-5 text-zinc-400" />
                </header>
                <div className="grid gap-3 p-5 sm:grid-cols-3">
                  {["IN_STOCK", "RESERVED", "SOLD"].map((status) => (
                    <div className="rounded-lg bg-zinc-50 p-4" key={status}>
                      <Badge tone={statusTone(status)}>{status.replace(/_/g, " ")}</Badge>
                      <p className="mt-3 text-2xl font-semibold text-zinc-950">
                        {stock.filter((item) => item.status === status).length}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-zinc-200 bg-white">
                <header className="border-b border-zinc-200 px-5 py-4">
                  <h2 className="text-base font-semibold text-zinc-950">Recent Designs</h2>
                </header>
                <div className="divide-y divide-zinc-100">
                  {designs.slice(0, 4).map((design) => (
                    <div className="flex items-center justify-between gap-4 px-5 py-4" key={design.id ?? design.design_no}>
                      <div>
                        <p className="font-medium text-zinc-950">{design.design_no}</p>
                        <p className="text-sm text-zinc-500">
                          {design.category_name || design.category_id} - {design.metal_quality}
                        </p>
                      </div>
                      <Badge tone={statusTone(design.status)}>{design.status}</Badge>
                    </div>
                  ))}
                  {designs.length === 0 ? <p className="px-5 py-8 text-sm text-zinc-500">No recent designs.</p> : null}
                </div>
              </section>
            </div>
          </>
        )}
      </section>
    </>
  );
}
