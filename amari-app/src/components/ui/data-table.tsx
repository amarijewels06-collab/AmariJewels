"use client";

import { type ReactNode, useState, useEffect } from "react";
import { LayoutGrid, List, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "./field";
import { Button } from "./button";

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
  pagination?: boolean;
  itemsPerPage?: number;
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
  pagination = false,
  itemsPerPage = 20,
}: DataTableProps<T>) {
  const showToggle = Boolean(gridRender && setViewMode);
  const isGrid = viewMode === "grid" && Boolean(gridRender);

  const [currentPage, setCurrentPage] = useState(1);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.ceil(rows.length / itemsPerPage);
  
  const displayRows = pagination 
    ? rows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : rows;

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
        displayRows.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-12 text-center text-sm text-zinc-500">
            {empty}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {displayRows.map((row, index) => (
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
                {displayRows.map((row, index) => (
                  <tr className="align-top hover:bg-zinc-50/70" key={index}>
                    {columns.map((column) => (
                      <td className={`px-4 py-3 ${column.className ?? ""}`} key={column.key}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
                {displayRows.length === 0 ? (
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

      {/* Pagination Controls */}
      {pagination && totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-zinc-200 pt-4 px-2">
          <p className="text-sm text-zinc-500">
            Showing <span className="font-medium text-zinc-900">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
            <span className="font-medium text-zinc-900">
              {Math.min(currentPage * itemsPerPage, rows.length)}
            </span>{" "}
            of <span className="font-medium text-zinc-900">{rows.length}</span> results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
