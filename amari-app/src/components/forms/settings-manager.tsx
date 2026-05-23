"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit3, KeyRound, Plus, Save, Trash2 } from "lucide-react";
import { Badge, statusTone } from "../ui/badge";
import { Button } from "../ui/button";
import { DataTable, type Column } from "../ui/data-table";
import { Dialog } from "../ui/dialog";
import { FieldWrap, Input, Select, Textarea } from "../ui/field";
import { Loader } from "../ui/loader";
import { PageHeader } from "../ui/page-header";
import { deleteJson, readJson, writeJson } from "./api";

type Category = {
  code: string;
  description?: string;
  id?: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};

type SubCategory = Category & {
  category_id: string;
  category_name?: string;
};

type User = {
  display_name: string;
  email?: string;
  id?: string;
  mobile?: string;
  password?: string;
  role: "ADMIN" | "STAFF" | "VIEWER";
  status: "ACTIVE" | "INACTIVE";
  username: string;
};

type Tab = "categories" | "subCategories" | "users";

export function SettingsManager() {
  const [tab, setTab] = useState<Tab>("categories");
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubCategory, setEditingSubCategory] = useState<SubCategory | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [categoryError, setCategoryError] = useState("");
  const [subCategoryError, setSubCategoryError] = useState("");
  const [userError, setUserError] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      readJson<Record<string, unknown>>("/api/settings/categories"),
      readJson<Record<string, unknown>>("/api/settings/sub-categories"),
      readJson<Record<string, unknown>>("/api/settings/users"),
    ])
      .then(([categoryRows, subCategoryRows, userRows]) => {
        setCategories(categoryRows.map(normalizeCategory));
        setSubCategories(subCategoryRows.map(normalizeSubCategory));
        setUsers(userRows.map(normalizeUser));
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredCategories = useMemo(
    () => categories.filter((item) => [item.code, item.name, item.description].join(" ").toLowerCase().includes(search.toLowerCase())),
    [categories, search],
  );
  const filteredSubCategories = useMemo(
    () =>
      subCategories.filter((item) =>
        [item.code, item.name, item.description, item.category_name].join(" ").toLowerCase().includes(search.toLowerCase()),
      ),
    [search, subCategories],
  );
  const filteredUsers = useMemo(
    () => users.filter((item) => [item.username, item.display_name, item.mobile, item.email, item.role].join(" ").toLowerCase().includes(search.toLowerCase())),
    [search, users],
  );

  function openCategoryForm(category: Category) {
    setCategoryError("");
    setEditingCategory(category);
  }

  function closeCategoryForm() {
    setCategoryError("");
    setEditingCategory(null);
  }

  function openSubCategoryForm(subCategory: SubCategory) {
    setSubCategoryError("");
    setEditingSubCategory(subCategory);
  }

  function closeSubCategoryForm() {
    setSubCategoryError("");
    setEditingSubCategory(null);
  }

  function openUserForm(user: User) {
    setUserError("");
    setEditingUser(user);
  }

  function closeUserForm() {
    setUserError("");
    setEditingUser(null);
  }

  async function saveCategory() {
    if (!editingCategory) return;
    const endpoint = editingCategory.id ? `/api/settings/categories/${editingCategory.id}` : "/api/settings/categories";
    const method = editingCategory.id ? "PUT" : "POST";
    const saved = await writeJson(endpoint, method, editingCategory).catch((error) => {
      setCategoryError(error instanceof Error ? error.message : "Unable to save category.");
      return null;
    });
    if (!saved) return;
    const nextCategory = normalizeCategory(saved?.data ?? saved ?? editingCategory);
    setCategories((current) =>
      editingCategory.id
        ? current.map((item) => (item.id === editingCategory.id ? { ...editingCategory, ...nextCategory } : item))
        : [{ ...editingCategory, ...nextCategory, id: nextCategory.id ?? crypto.randomUUID() }, ...current],
    );
    closeCategoryForm();
    setMessage("Category saved.");
  }

  async function saveSubCategory() {
    if (!editingSubCategory) return;
    const categoryName = categories.find((item) => item.id === editingSubCategory.category_id)?.name;
    const payload = { ...editingSubCategory, category_name: categoryName };
    const endpoint = payload.id ? `/api/settings/sub-categories/${payload.id}` : "/api/settings/sub-categories";
    const method = payload.id ? "PUT" : "POST";
    const saved = await writeJson(endpoint, method, toSubCategoryPayload(payload)).catch((error) => {
      setSubCategoryError(error instanceof Error ? error.message : "Unable to save sub category.");
      return null;
    });
    if (!saved) return;
    const nextSubCategory = normalizeSubCategory(saved?.data ?? saved ?? payload);
    setSubCategories((current) =>
      payload.id
        ? current.map((item) => (item.id === payload.id ? { ...payload, ...nextSubCategory } : item))
        : [{ ...payload, ...nextSubCategory, id: nextSubCategory.id ?? crypto.randomUUID() }, ...current],
    );
    closeSubCategoryForm();
    setMessage("Sub category saved.");
  }

  async function saveUser() {
    if (!editingUser) return;
    const endpoint = editingUser.id ? `/api/settings/users/${editingUser.id}` : "/api/settings/users";
    const method = editingUser.id ? "PUT" : "POST";
    const saved = await writeJson(endpoint, method, toUserPayload(editingUser)).catch((error) => {
      setUserError(error instanceof Error ? error.message : "Unable to save user.");
      return null;
    });
    if (!saved) return;
    const nextUser = normalizeUser(saved?.data ?? saved ?? editingUser);
    setUsers((current) =>
      editingUser.id
        ? current.map((item) => (item.id === editingUser.id ? { ...editingUser, ...nextUser } : item))
        : [{ ...editingUser, ...nextUser, id: nextUser.id ?? crypto.randomUUID() }, ...current],
    );
    closeUserForm();
    setMessage("User saved.");
  }

  async function deleteCategory(row: Category) {
    if (!row.id || !window.confirm(`Delete ${row.name}?`)) return;
    try {
      await deleteJson(`/api/settings/categories/${row.id}`);
      setCategories((current) => current.filter((item) => item.id !== row.id));
      setMessage(`${row.name} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete category.");
    }
  }

  async function deleteSubCategory(row: SubCategory) {
    if (!row.id || !window.confirm(`Delete ${row.name}?`)) return;
    try {
      await deleteJson(`/api/settings/sub-categories/${row.id}`);
      setSubCategories((current) => current.filter((item) => item.id !== row.id));
      setMessage(`${row.name} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete sub category.");
    }
  }

  async function deleteUser(row: User) {
    if (!row.id || !window.confirm(`Delete ${row.username}?`)) return;
    try {
      await deleteJson(`/api/settings/users/${row.id}`);
      setUsers((current) => current.filter((item) => item.id !== row.id));
      setMessage(`${row.username} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete user.");
    }
  }

  const categoryColumns: Column<Category>[] = [
    { header: "Code", key: "code", render: (row) => <span className="font-medium text-zinc-950">{row.code}</span> },
    { header: "Name", key: "name", render: (row) => row.name },
    { header: "Description", key: "description", render: (row) => row.description || "-" },
    { header: "Status", key: "status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    {
      className: "text-right",
      header: "Actions",
      key: "actions",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button aria-label="Edit category" onClick={() => openCategoryForm(row)} size="icon" variant="ghost">
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button aria-label="Delete category" onClick={() => deleteCategory(row)} size="icon" variant="ghost">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const subCategoryColumns: Column<SubCategory>[] = [
    { header: "Code", key: "code", render: (row) => <span className="font-medium text-zinc-950">{row.code}</span> },
    { header: "Name", key: "name", render: (row) => row.name },
    { header: "Category", key: "category", render: (row) => row.category_name || row.category_id },
    { header: "Status", key: "status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    {
      className: "text-right",
      header: "Actions",
      key: "actions",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button aria-label="Edit sub category" onClick={() => openSubCategoryForm(row)} size="icon" variant="ghost">
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button aria-label="Delete sub category" onClick={() => deleteSubCategory(row)} size="icon" variant="ghost">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const userColumns: Column<User>[] = [
    { header: "Username", key: "username", render: (row) => <span className="font-medium text-zinc-950">{row.username}</span> },
    { header: "Display Name", key: "display", render: (row) => row.display_name },
    { header: "Contact", key: "contact", render: (row) => <span className="text-xs text-zinc-600">{row.email || row.mobile || "-"}</span> },
    { header: "Role", key: "role", render: (row) => <Badge tone="blue">{row.role}</Badge> },
    { header: "Status", key: "status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    {
      className: "text-right",
      header: "Actions",
      key: "actions",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button aria-label="Edit user" onClick={() => openUserForm(row)} size="icon" variant="ghost">
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button
            aria-label="Reset password"
            onClick={() => {
              const password = window.prompt("Enter a new password with at least 8 characters");
              if (row.id && password) {
                writeJson(`/api/settings/users/${row.id}/reset-password`, "POST", { password }).catch(() => null);
              }
            }}
            size="icon"
            variant="ghost"
          >
            <KeyRound className="h-4 w-4" />
          </Button>
          <Button aria-label="Delete user" onClick={() => deleteUser(row)} size="icon" variant="ghost">
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
          <Button
            onClick={() => {
              if (tab === "categories") openCategoryForm({ code: "", name: "", status: "ACTIVE" });
              if (tab === "subCategories") openSubCategoryForm({ category_id: categories[0]?.id ?? "", code: "", name: "", status: "ACTIVE" });
              if (tab === "users") openUserForm({ display_name: "", role: "STAFF", status: "ACTIVE", username: "" });
            }}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        }
        eyebrow="Administration"
        title="Settings"
      />
      <section className="grid gap-4 p-4 sm:p-6 lg:p-8">
        {message ? <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">{message}</div> : null}
        <div className="flex w-full gap-2 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-1 scrollbar-none">
          {[
            ["categories", "Categories"],
            ["subCategories", "Sub Categories"],
            ["users", "Users"],
          ].map(([key, label]) => (
            <button
              className={[
                "flex-shrink-0 h-9 rounded-md px-3 text-sm font-medium transition",
                tab === key ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100",
              ].join(" ")}
              key={key}
              onClick={() => {
                setTab(key as Tab);
                setSearch("");
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <Loader label="Loading settings..." />
        ) : (
          <>
            {tab === "categories" ? (
              <DataTable columns={categoryColumns} empty="No categories found." rows={filteredCategories} search={search} searchPlaceholder="Search category code, name, description..." setSearch={setSearch} />
            ) : null}
            {tab === "subCategories" ? (
              <DataTable columns={subCategoryColumns} empty="No sub categories found." rows={filteredSubCategories} search={search} searchPlaceholder="Search sub category code, name, category..." setSearch={setSearch} />
            ) : null}
            {tab === "users" ? (
              <DataTable columns={userColumns} empty="No users found." rows={filteredUsers} search={search} searchPlaceholder="Search username, display name, role, contact..." setSearch={setSearch} />
            ) : null}
          </>
        )}
      </section>

      <Dialog onClose={closeCategoryForm} open={Boolean(editingCategory)} title={`${editingCategory?.id ? "Edit" : "Add"} Category`}>
        {editingCategory ? (
          <MasterForm
            error={categoryError}
            item={editingCategory}
            onCancel={closeCategoryForm}
            onChange={(item) => {
              setCategoryError("");
              setEditingCategory(item);
            }}
            onSave={saveCategory}
          />
        ) : null}
      </Dialog>
      <Dialog onClose={closeSubCategoryForm} open={Boolean(editingSubCategory)} title={`${editingSubCategory?.id ? "Edit" : "Add"} Sub Category`}>
        {editingSubCategory ? (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveSubCategory();
            }}
          >
            <FieldWrap label="Category">
              <Select
                value={editingSubCategory.category_id}
                onChange={(event) => {
                  setSubCategoryError("");
                  setEditingSubCategory({ ...editingSubCategory, category_id: event.target.value });
                }}
              >
                {categories.length === 0 ? <option value="">No categories</option> : null}
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </FieldWrap>
            <MasterFields
              item={editingSubCategory}
              onChange={(item) => {
                setSubCategoryError("");
                setEditingSubCategory({ ...editingSubCategory, ...item });
              }}
            />
            <FormError message={subCategoryError} />
            <SaveActions onCancel={closeSubCategoryForm} />
          </form>
        ) : null}
      </Dialog>
      <Dialog onClose={closeUserForm} open={Boolean(editingUser)} title={`${editingUser?.id ? "Edit" : "Add"} User`}>
        {editingUser ? (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveUser();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FieldWrap label="Username">
                <Input
                  value={editingUser.username}
                  onChange={(event) => {
                    setUserError("");
                    setEditingUser({ ...editingUser, username: event.target.value });
                  }}
                />
              </FieldWrap>
              <FieldWrap label="Display Name">
                <Input
                  value={editingUser.display_name}
                  onChange={(event) => {
                    setUserError("");
                    setEditingUser({ ...editingUser, display_name: event.target.value });
                  }}
                />
              </FieldWrap>
              <FieldWrap label="Mobile">
                <Input
                  value={editingUser.mobile ?? ""}
                  onChange={(event) => {
                    setUserError("");
                    setEditingUser({ ...editingUser, mobile: event.target.value });
                  }}
                />
              </FieldWrap>
              <FieldWrap label="Email">
                <Input
                  type="email"
                  value={editingUser.email ?? ""}
                  onChange={(event) => {
                    setUserError("");
                    setEditingUser({ ...editingUser, email: event.target.value });
                  }}
                />
              </FieldWrap>
              {!editingUser.id ? (
                <FieldWrap label="Initial Password">
                  <Input
                    minLength={8}
                    type="password"
                    value={editingUser.password ?? ""}
                    onChange={(event) => {
                      setUserError("");
                      setEditingUser({ ...editingUser, password: event.target.value });
                    }}
                  />
                </FieldWrap>
              ) : null}
              <FieldWrap label="Role">
                <Select
                  value={editingUser.role}
                  onChange={(event) => {
                    setUserError("");
                    setEditingUser({ ...editingUser, role: event.target.value as User["role"] });
                  }}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="STAFF">Staff</option>
                  <option value="VIEWER">Viewer</option>
                </Select>
              </FieldWrap>
              <FieldWrap label="Status">
                <Select
                  value={editingUser.status}
                  onChange={(event) => {
                    setUserError("");
                    setEditingUser({ ...editingUser, status: event.target.value as User["status"] });
                  }}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </FieldWrap>
            </div>
            <FormError message={userError} />
            <SaveActions onCancel={closeUserForm} />
          </form>
        ) : null}
      </Dialog>
    </>
  );
}

function normalizeCategory(item: Record<string, unknown>): Category {
  return {
    code: String(item.code ?? ""),
    description: item.description ? String(item.description) : undefined,
    id: item.id ? String(item.id) : undefined,
    name: String(item.name ?? ""),
    status: String(item.status ?? "ACTIVE") as Category["status"],
  };
}

function MasterForm({
  error,
  item,
  onCancel,
  onChange,
  onSave,
}: {
  error?: string;
  item: Category;
  onCancel: () => void;
  onChange: (item: Category) => void;
  onSave: () => void;
}) {
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <MasterFields item={item} onChange={onChange} />
      <FormError message={error} />
      <SaveActions onCancel={onCancel} />
    </form>
  );
}

function FormError({ message }: { message?: string }) {
  return message ? (
    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</div>
  ) : null;
}

function MasterFields({ item, onChange }: { item: Category; onChange: (item: Category) => void }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldWrap label="Code">
          <Input value={item.code} onChange={(event) => onChange({ ...item, code: event.target.value.toUpperCase() })} />
        </FieldWrap>
        <FieldWrap label="Name">
          <Input value={item.name} onChange={(event) => onChange({ ...item, name: event.target.value })} />
        </FieldWrap>
        <FieldWrap label="Status">
          <Select value={item.status} onChange={(event) => onChange({ ...item, status: event.target.value as Category["status"] })}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </FieldWrap>
      </div>
      <FieldWrap label="Description">
        <Textarea value={item.description ?? ""} onChange={(event) => onChange({ ...item, description: event.target.value })} />
      </FieldWrap>
    </>
  );
}

function SaveActions({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
      <Button onClick={onCancel} variant="secondary">
        Cancel
      </Button>
      <Button type="submit">
        <Save className="h-4 w-4" />
        Save
      </Button>
    </div>
  );
}

function normalizeSubCategory(item: Record<string, unknown>): SubCategory {
  const category = item.category as { id?: string; name?: string } | undefined;
  return {
    category_id: String(item.category_id ?? item.categoryId ?? category?.id ?? ""),
    category_name: String(item.category_name ?? category?.name ?? ""),
    code: String(item.code ?? ""),
    description: item.description ? String(item.description) : undefined,
    id: item.id ? String(item.id) : undefined,
    name: String(item.name ?? ""),
    status: String(item.status ?? "ACTIVE") as SubCategory["status"],
  };
}

function toSubCategoryPayload(item: SubCategory) {
  return {
    categoryId: item.category_id,
    code: item.code,
    description: item.description,
    name: item.name,
    status: item.status,
  };
}

function normalizeUser(item: Record<string, unknown>): User {
  return {
    display_name: String(item.display_name ?? item.displayName ?? ""),
    email: item.email ? String(item.email) : undefined,
    id: item.id ? String(item.id) : undefined,
    mobile: item.mobile ? String(item.mobile) : undefined,
    role: String(item.role ?? "STAFF") as User["role"],
    status: String(item.status ?? "ACTIVE") as User["status"],
    username: String(item.username ?? ""),
  };
}

function toUserPayload(item: User) {
  return {
    displayName: item.display_name,
    email: item.email,
    mobile: item.mobile,
    password: item.password,
    role: item.role,
    status: item.status,
    username: item.username,
  };
}
