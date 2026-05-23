"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Save, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { Badge, statusTone } from "../ui/badge";
import { Button } from "../ui/button";
import { DataTable, type Column } from "../ui/data-table";
import { Dialog } from "../ui/dialog";
import { FieldWrap, Input, Select, Textarea } from "../ui/field";
import { Loader } from "../ui/loader";
import { PageHeader } from "../ui/page-header";
import { deleteJson, normalizeStatus, panFromGst, readJson, writeJson } from "./api";
import { useAppData } from "@/lib/app-data-context";

type Party = {
  address?: string;
  city?: string;
  code: string;
  company?: string;
  country?: string;
  gst?: string;
  id?: string;
  mobile: string;
  name: string;
  pan?: string;
  remarks?: string;
  state?: string;
  status: "ACTIVE" | "INACTIVE";
};

type PartyManagerProps = {
  endpoint: string;
  kind: "customers" | "suppliers";
  title: string;
};

const emptyParty: Party = {
  code: "",
  country: "India",
  mobile: "",
  name: "",
  status: "ACTIVE",
};

const indianStates = [
  // States
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  // Union Territories
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

export function PartyManager({ endpoint, kind, title }: PartyManagerProps) {
  const { refresh } = useAppData();
  const [rows, setRows] = useState<Party[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [state, setState] = useState("ALL");
  const [editing, setEditing] = useState<Party | null>(null);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    readJson<Record<string, unknown>>(endpoint)
      .then((items) => setRows(items.map(normalizeParty)))
      .finally(() => setLoading(false));
  }, [endpoint]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      const searchable = [
        row.code,
        row.name,
        row.company,
        row.mobile,
        row.gst,
        row.pan,
        row.city,
        row.state,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!needle || searchable.includes(needle)) &&
        (status === "ALL" || row.status === status) &&
        (state === "ALL" || row.state === state)
      );
    });
  }, [rows, search, state, status]);

  function updateForm(key: keyof Party, value: string) {
    setFormError("");
    setEditing((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      if (key === "gst") {
        next.gst = value.toUpperCase().replace(/\s/g, "");
        const pan = panFromGst(next.gst);
        if (pan) next.pan = pan;
      }
      if (key === "pan") next.pan = value.toUpperCase().replace(/\s/g, "");
      return next;
    });
  }

  function openPartyForm(party: Party) {
    setFormError("");
    setEditing(party);
  }

  function closePartyForm() {
    setFormError("");
    setEditing(null);
  }

  async function saveParty() {
    if (!editing) return;
    setSaving(true);
    const method = editing.id ? "PUT" : "POST";
    const target = editing.id ? `${endpoint}/${editing.id}` : endpoint;
    try {
      const payload = { ...editing, remarks: editing.remarks?.trim() || undefined };
      const saved = await writeJson(target, method, payload);
      const nextRow = normalizeParty(saved?.data ?? saved ?? editing);
      setRows((current) => {
        if (editing.id) return current.map((row) => (row.id === editing.id ? { ...row, ...nextRow } : row));
        return [{ ...editing, ...nextRow, id: nextRow.id ?? crypto.randomUUID() }, ...current];
      });
      closePartyForm();
      setMessage(`${title.slice(0, -1)} saved.`);
      refresh(kind);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save record.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(row: Party) {
    if (!row.id) return;
    const nextStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: nextStatus } : item)));
    try {
      await writeJson(`${endpoint}/${row.id}/status`, "PATCH", { status: nextStatus });
    } catch (error) {
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: row.status } : item)));
      setMessage(error instanceof Error ? error.message : "Unable to update status.");
    }
  }

  async function deleteParty(row: Party) {
    if (!row.id || !window.confirm(`Delete ${row.name}?`)) return;
    try {
      await deleteJson(`${endpoint}/${row.id}`);
      setRows((current) => current.filter((item) => item.id !== row.id));
      setMessage(`${row.name} deleted.`);
      refresh(kind);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete record.");
    }
  }

  const columns: Column<Party>[] = [
    {
      header: "Code",
      key: "code",
      render: (row) => <span className="font-medium text-zinc-950">{row.code}</span>,
    },
    {
      header: kind === "customers" ? "Customer" : "Supplier",
      key: "party",
      render: (row) => (
        <div>
          <p className="font-medium text-zinc-950">{row.name}</p>
          <p className="text-xs text-zinc-500">{row.company || "Individual"}</p>
        </div>
      ),
    },
    { header: "Mobile", key: "mobile", render: (row) => row.mobile },
    {
      header: "GST / PAN",
      key: "tax",
      render: (row) => (
        <div className="grid gap-1 text-xs text-zinc-600">
          <span>{row.gst || "No GST"}</span>
          <span>{row.pan || "No PAN"}</span>
        </div>
      ),
    },
    { header: "City", key: "city", render: (row) => row.city || "-" },
    {
      header: "Status",
      key: "status",
      render: (row) => <Badge tone={statusTone(row.status)}>{normalizeStatus(row.status)}</Badge>,
    },
    {
      className: "text-right",
      header: "Actions",
      key: "actions",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button aria-label="Edit record" onClick={() => openPartyForm(row)} size="icon" variant="ghost">
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button aria-label="Toggle status" onClick={() => toggleStatus(row)} size="icon" variant="ghost">
            {row.status === "ACTIVE" ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          </Button>
          <Button aria-label="Delete record" onClick={() => deleteParty(row)} size="icon" variant="ghost">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const states = Array.from(new Set(rows.map((row) => row.state).filter(Boolean))) as string[];

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => openPartyForm({ ...emptyParty })}>
            <Plus className="h-4 w-4" />
            Add {kind === "customers" ? "Customer" : "Supplier"}
          </Button>
        }
        eyebrow="Master Data"
        title={title}
      />
      <section className="p-4 sm:p-6 lg:p-8">
        {message ? <div className="mb-4 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">{message}</div> : null}
        {loading ? (
          <Loader label={`Loading ${kind}...`} />
        ) : (
          <DataTable
            columns={columns}
            empty={`No ${kind} match the current filters.`}
            filters={
              <>
                <Select aria-label="Filter by status" onChange={(event) => setStatus(event.target.value)} value={status}>
                  <option value="ALL">All status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
                <Select aria-label="Filter by state" onChange={(event) => setState(event.target.value)} value={state}>
                  <option value="ALL">All states</option>
                  {[...new Set([...indianStates, ...states])].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </>
            }
            rows={filtered}
            search={search}
            searchPlaceholder="Search code, name, company, mobile, GST, PAN, city..."
            setSearch={setSearch}
          />
        )}
      </section>

      <Dialog
        onClose={closePartyForm}
        open={Boolean(editing)}
        title={`${editing?.id ? "Edit" : "Add"} ${kind === "customers" ? "Customer" : "Supplier"}`}
      >
        {editing ? (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveParty();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FieldWrap label="Code">
                <Input value={editing.code} onChange={(event) => updateForm("code", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="Name">
                <Input value={editing.name} onChange={(event) => updateForm("name", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="Company">
                <Input value={editing.company ?? ""} onChange={(event) => updateForm("company", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="Mobile">
                <Input value={editing.mobile} onChange={(event) => updateForm("mobile", event.target.value)} />
              </FieldWrap>
              <FieldWrap hint="PAN auto-fills from characters 3 to 12 when GSTIN is complete." label="GSTIN">
                <Input maxLength={15} value={editing.gst ?? ""} onChange={(event) => updateForm("gst", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="PAN">
                <Input maxLength={10} value={editing.pan ?? ""} onChange={(event) => updateForm("pan", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="City">
                <Input value={editing.city ?? ""} onChange={(event) => updateForm("city", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="State">
                <Select value={editing.state ?? ""} onChange={(event) => updateForm("state", event.target.value)}>
                  <option value="">Select state</option>
                  {indianStates.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </FieldWrap>
              <FieldWrap label="Country">
                <Input value={editing.country ?? "India"} onChange={(event) => updateForm("country", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="Status">
                <Select value={editing.status} onChange={(event) => updateForm("status", event.target.value)}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </FieldWrap>
            </div>
            <FieldWrap label="Address">
              <Textarea value={editing.address ?? ""} onChange={(event) => updateForm("address", event.target.value)} />
            </FieldWrap>
            <FieldWrap label="Remarks">
              <Textarea value={editing.remarks ?? ""} onChange={(event) => updateForm("remarks", event.target.value)} />
            </FieldWrap>
            {formError ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</div>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
              <Button onClick={closePartyForm} variant="secondary">
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
    </>
  );
}

export function normalizeParty(item: Record<string, unknown>): Party {
  return {
    address: item.address ? String(item.address) : undefined,
    city: item.city ? String(item.city) : undefined,
    code: String(item.code ?? ""),
    company: item.company ? String(item.company) : undefined,
    country: String(item.country ?? "India"),
    gst: item.gst ? String(item.gst) : undefined,
    id: item.id ? String(item.id) : undefined,
    mobile: String(item.mobile ?? ""),
    name: String(item.name ?? ""),
    pan: item.pan ? String(item.pan) : undefined,
    remarks: item.remarks ? String(item.remarks) : undefined,
    state: item.state ? String(item.state) : undefined,
    status: String(item.status ?? "ACTIVE") as Party["status"],
  };
}
