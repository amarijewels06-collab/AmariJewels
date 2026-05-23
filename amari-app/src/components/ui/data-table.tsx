"use client";

import type { ReactNode } from "react";
import { LayoutGrid, List, Search } from "lucide-react";
import { Input } from "./field";

export type Column<T> = {
  className?: string;
  header: ReactNode;
  key: string;
  render: (row: T) => ReactNode;
};

export type ViewMode = "list" | "grid";

type DataTableProps<T> = {
  columns: Column<T>[];
  empty: string;
  filters?: ReactNode;
  gridRender?: (row: T) => ReactNode;
  rows: T[];
  search: string;
  searchPlaceholder: string;
  setSearch: (value: string) => void;
  setViewMode?: (mode: ViewMode) => void;
  viewMode?: ViewMode;
};

export function DataTable<T>({
  columns,
  empty,
  filters,
  gridRender,
  rows,
  search,
  searchPlaceholder,
  setSearch,
  setViewMode,
  viewMode = "list",
}: DataTableProps<T>) {
  const showToggle = Boolean(gridRender && setViewMode);
  const isGrid = viewMode === "grid" && Boolean(gridRender);

  return (
    <div className="grid gap-4">
      {/* Search + filters + view toggle bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            className="w-full pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            value={search}
          />
        </div>
        <div className="flex items-center gap-2">
          {filters ? <div className="flex flex-wrap gap-2">{filters}</div> : null}
          {showToggle ? (
            <div
              aria-label="View mode"
              className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 shadow-sm"
              role="group"
            >
              <button
                aria-label="List view"
                aria-pressed={viewMode === "list"}
                className={[
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 focus:outline-none",
                  viewMode === "list"
                    ? "bg-white text-zinc-900 shadow"
                    : "text-zinc-500 hover:text-zinc-700",
                ].join(" ")}
                onClick={() => setViewMode?.("list")}
                type="button"
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
              <button
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
                className={[
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 focus:outline-none",
                  viewMode === "grid"
                    ? "bg-white text-zinc-900 shadow"
                    : "text-zinc-500 hover:text-zinc-700",
                ].join(" ")}
                onClick={() => setViewMode?.("grid")}
                type="button"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Grid
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Grid view */}
      {isGrid ? (
        rows.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-12 text-center text-sm text-zinc-500">
            {empty}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {rows.map((row, index) => (
              <div key={index}>{gridRender!(row)}</div>
            ))}
          </div>
        )
      ) : (
        /* List / table view */
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  {columns.map((column) => (
                    <th className={`px-4 py-3 font-semibold ${column.className ?? ""}`} key={column.key}>
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((row, index) => (
                  <tr className="align-top hover:bg-zinc-50/70" key={index}>
                    {columns.map((column) => (
                      <td className={`px-4 py-3 ${column.className ?? ""}`} key={column.key}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-sm text-zinc-500" colSpan={columns.length}>
                      {empty}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
