"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit3, ImagePlus, Plus, Save, Trash2, ShoppingCart, FileDown, PlusCircle, MinusCircle, FileText, Upload, AlertCircle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { Badge, statusTone } from "../ui/badge";
import { Button } from "../ui/button";
import { DataTable, type Column, type ViewMode } from "../ui/data-table";
import { Dialog } from "../ui/dialog";
import { FieldWrap, Input, Select, Textarea } from "../ui/field";
import { Loader } from "../ui/loader";
import { PageHeader } from "../ui/page-header";
import { deleteJson, readJson, writeJson } from "./api";
import { useAppData } from "@/lib/app-data-context";

type Design = {
  category_id: string;
  category_name?: string;
  design_date: string;
  design_no: string;
  diamond_pieces?: number;
  diamond_sizes?: { size: string; quantity: number }[];
  diamond_weight?: string;
  gross_weight?: string;
  id?: string;
  image_url?: string;
  metal_quality: string;
  net_weight?: string;
  pure_weight?: string;
  remarks?: string;
  status: "ACTIVE" | "INACTIVE";
  stone_pieces?: number;
  stone_weight?: string;
  sub_category_id?: string;
  sub_category_name?: string;
  diamond_color?: string;
  diamond_quality?: string;
};

type Customer = {
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

type Quotation = {
  id: string;
  created_at: string;
  items: Design[];
  total_gross: number;
  total_net: number;
  total_pure: number;
  total_diamond: number;
  item_count: number;
  customer?: Customer;
};

const QUOTATIONS_KEY = "amari_quotations";

function loadQuotations(): Quotation[] {
  try {
    const raw = localStorage.getItem(QUOTATIONS_KEY);
    return raw ? (JSON.parse(raw) as Quotation[]) : [];
  } catch {
    return [];
  }
}

function saveQuotations(list: Quotation[]) {
  try {
    localStorage.setItem(QUOTATIONS_KEY, JSON.stringify(list));
  } catch {
    // storage full — ignore
  }
}

const emptyDesign = (categoryId: string): Design => ({
  category_id: categoryId,
  design_date: new Date().toISOString().slice(0, 10),
  design_no: "",
  metal_quality: "18KT",
  status: "ACTIVE",
  diamond_color: "",
  diamond_quality: "",
  diamond_sizes: [],
});

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

export function DesignManager() {
  const [rows, setRows] = useState<Design[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [editing, setEditing] = useState<Design | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [subCategories, setSubCategories] = useState<{ category_id: string; id: string; name: string }[]>([]);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [cart, setCart] = useState<Design[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedCartIds, setSelectedCartIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"designs" | "quotations">("designs");
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [redownloading, setRedownloading] = useState<string | null>(null);
  const { customers: rawCustomers } = useAppData();
  // Map shared context customers to the full Customer shape used by this component
  const customers: Customer[] = rawCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    company: c.company,
    mobile: c.mobile,
    address: c.address,
    city: c.city,
    state: c.state,
    gst: c.gst,
    pan: c.pan,
  }));

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  // Excel import state variables
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      readJson<Record<string, unknown>>("/api/designs"),
      readJson<Record<string, unknown>>("/api/settings/categories"),
      readJson<Record<string, unknown>>("/api/settings/sub-categories"),
    ])
      .then(([designRows, categoryRows, subCategoryRows]) => {
        setRows(designRows.map(normalizeDesign));
        setCategories(categoryRows.map(normalizeCategoryOption).filter((item) => item.id && item.name));
        setSubCategories(subCategoryRows.map(normalizeSubCategoryOption).filter((item) => item.id && item.name));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    setQuotations(loadQuotations());
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseExcelFile(e.dataTransfer.files[0]);
    }
  };

  async function downloadTemplate() {
    try {
      const XLSX = await import("xlsx");
      const headers = [
        "Design No", "Date", "Category", "Sub Category", "Metal Quality", "Gross Weight", 
        "Diamond Weight", "Diamond Pieces", "CS Weight", "CS Pieces", "Diamond Sizes", 
        "Diamond Color", "Diamond Quality", "Remarks", "Status"
      ];
      const sampleRows = [
        {
          "Design No": "DES-001001",
          "Date": "2026-05-23",
          "Category": "Rings",
          "Sub Category": "Diamond Rings",
          "Metal Quality": "18KT",
          "Gross Weight": 4.85,
          "Diamond Weight": 0.85,
          "Diamond Pieces": 12,
          "CS Weight": 0.0,
          "CS Pieces": 0,
          "Diamond Sizes": "1.1:8, 1.2:4",
          "Diamond Color": "G-H",
          "Diamond Quality": "VS-SI",
          "Remarks": "Gorgeous diamond ring",
          "Status": "ACTIVE"
        },
        {
          "Design No": "DES-001002",
          "Date": "2026-05-23",
          "Category": "Bangles",
          "Sub Category": "Gold Bangles",
          "Metal Quality": "22KT",
          "Gross Weight": 18.5,
          "Diamond Weight": 0.0,
          "Diamond Pieces": 0,
          "CS Weight": 1.25,
          "CS Pieces": 4,
          "Diamond Sizes": "",
          "Diamond Color": "",
          "Diamond Quality": "",
          "Remarks": "Traditional heavy bangle",
          "Status": "ACTIVE"
        }
      ];
      
      const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Designs");
      XLSX.writeFile(wb, "Designs_Import_Template.xlsx");
    } catch (err) {
      console.error("Failed to generate Excel template:", err);
    }
  }

  async function parseExcelFile(file: File) {
    setImportError("");
    setParsing(true);
    try {
      const XLSX = await import("xlsx");
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary", cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });
          
          const mapped = rawRows.map((row, index) => {
            const getVal = (possibleNames: string[]) => {
              const foundKey = Object.keys(row).find(k => 
                possibleNames.some(p => k.trim().toLowerCase().replace(/[^a-z0-9]/g, "") === p.trim().toLowerCase().replace(/[^a-z0-9]/g, ""))
              );
              return foundKey ? String(row[foundKey]).trim() : "";
            };

            const designNo = getVal(["designno", "designnumber"]);
            let designDate = getVal(["date", "designdate"]);
            if (!designDate && row.Date instanceof Date) {
              designDate = row.Date.toISOString().slice(0, 10);
            } else if (designDate) {
              const d = new Date(designDate);
              if (!isNaN(d.getTime())) {
                designDate = d.toISOString().slice(0, 10);
              }
            } else {
              designDate = new Date().toISOString().slice(0, 10);
            }

            const categoryName = getVal(["category", "categoryname"]);
            const subCategoryName = getVal(["subcategory", "subcategoryname"]);
            const metalQuality = getVal(["metalquality", "karat", "metal"]) || "18KT";
            const grossWeight = parseFloat(getVal(["grossweight", "grosswt"])) || 0;
            const diamondWeight = parseFloat(getVal(["diamondweight", "diamondwt"])) || 0;
            const diamondPieces = parseInt(getVal(["diamondpieces", "diamondpcs"])) || 0;
            const stoneWeight = parseFloat(getVal(["csweight", "stoneweight", "cswt", "stonewt"])) || 0;
            const stonePieces = parseInt(getVal(["cspieces", "stonepieces", "cspcs", "stonepcs"])) || 0;
            const diamondColor = getVal(["diamondcolor", "color"]);
            const diamondQuality = getVal(["diamondquality", "quality"]);
            const remarks = getVal(["remarks", "remark", "notes"]);
            const status = (getVal(["status"]) || "ACTIVE").toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";

            const sizesStr = getVal(["diamondsizes", "sizes"]);
            const diamondSizes = sizesStr 
              ? sizesStr.split(",").map(item => {
                  const parts = item.trim().split(":");
                  const size = parts[0]?.trim() || "";
                  const quantity = parseInt(parts[1]?.trim() || "0") || 0;
                  return { size, quantity };
                }).filter(s => s.size !== "")
              : [];

            const diamondGram = diamondWeight * 0.2;
            const stoneGram = stoneWeight * 0.2;
            const netWeight = Math.max(0, grossWeight - diamondGram - stoneGram);

            const purity = purityMapping[metalQuality] || 0;
            const pureWeight = netWeight * purity;

            const errors: string[] = [];
            const warnings: string[] = [];

            if (!categoryName) {
              errors.push("Category is required");
            }
            if (grossWeight <= 0) {
              errors.push("Gross weight must be greater than 0");
            }
            if (grossWeight < (diamondGram + stoneGram)) {
              errors.push("Gross weight cannot be less than combined diamond & stone weight");
            }

            const catExists = categories.some(c => c.name.toLowerCase() === categoryName.toLowerCase());
            if (categoryName && !catExists) {
              warnings.push(`Category '${categoryName}' is new and will be created`);
            }

            if (categoryName && subCategoryName) {
              const subExists = subCategories.some(s => 
                s.name.toLowerCase() === subCategoryName.toLowerCase() &&
                categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase())?.id === s.category_id
              );
              if (!subExists) {
                warnings.push(`Sub-category '${subCategoryName}' is new and will be created`);
              }
            }

            const designExists = rows.some(r => r.design_no.toLowerCase() === designNo.toLowerCase());
            if (designNo && designExists) {
              warnings.push(`Design '${designNo}' already exists and will be updated`);
            }

            return {
              rowNum: index + 2,
              designNo,
              designDate,
              categoryName,
              subCategoryName,
              metalQuality,
              grossWeight: grossWeight.toFixed(3),
              diamondWeight: diamondWeight.toFixed(3),
              diamondPieces,
              diamondSizes,
              stoneWeight: stoneWeight.toFixed(3),
              stonePieces,
              diamondColor,
              diamondQuality,
              remarks,
              status,
              netWeight: netWeight.toFixed(3),
              pureWeight: pureWeight.toFixed(3),
              errors,
              warnings
            };
          });

          setParsedRows(mapped);
        } catch (err) {
          setImportError("Error processing excel contents. Make sure it has a valid structure.");
          console.error(err);
        } finally {
          setParsing(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      setImportError("Failed to load Excel parsing engine.");
      console.error(err);
      setParsing(false);
    }
  }

  async function executeImport() {
    if (parsedRows.length === 0 || parsedRows.some(row => row.errors.length > 0)) {
      return;
    }
    setImporting(true);
    setImportError("");
    try {
      const payload = parsedRows.map(row => ({
        designNo: row.designNo,
        designDate: row.designDate,
        categoryName: row.categoryName,
        subCategoryName: row.subCategoryName,
        metalQuality: row.metalQuality,
        grossWeight: row.grossWeight,
        diamondWeight: row.diamondWeight,
        diamondPieces: row.diamondPieces,
        diamondSizes: row.diamondSizes,
        stoneWeight: row.stoneWeight,
        stonePieces: row.stonePieces,
        diamondColor: row.diamondColor,
        diamondQuality: row.diamondQuality,
        remarks: row.remarks,
        status: row.status,
      }));

      const res = await writeJson<any>("/api/designs/import", "POST", payload);
      if (res?.success) {
        setImportSummary(res);
      } else {
        setImportError(res?.error || "Import failed");
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "An error occurred during import");
    } finally {
      setImporting(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = [row.design_no, row.category_name, row.sub_category_name, row.metal_quality].filter(Boolean).join(" ").toLowerCase();
      return (
        (!needle || haystack.includes(needle)) &&
        (category === "ALL" || row.category_id === category) &&
        (status === "ALL" || row.status === status)
      );
    });
  }, [category, rows, search, status]);

  function calculateWeights(item: Design): Partial<Design> {
    const gross = parseFloat(item.gross_weight || "0") || 0;
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

  function toggleCart(design: Design) {
    const isRemoving = cart.some((d) => d.id === design.id);
    if (isRemoving) {
      setCart((current) => current.filter((d) => d.id !== design.id));
      setSelectedCartIds((current) => current.filter((id) => id !== design.id));
    } else {
      const calculated = calculateWeights(design);
      setCart((current) => [...current, { ...design, ...calculated }]);
      // New items start as unselected as per user request
    }
  }

  function updateCartItem(id: string, key: keyof Design, value: string) {
    setCart((current) =>
      current.map((item) => {
        if (item.id === id) {
          let next = { ...item, [key]: value } as Design;
          if (["gross_weight", "diamond_weight", "metal_quality"].includes(key)) {
            next = { ...next, ...calculateWeights(next) };
          }
          return next;
        }
        return item;
      })
    );
  }

  function toggleCartSelection(id: string) {
    setSelectedCartIds((current) =>
      current.includes(id) ? current.filter((i) => i !== id) : [...current, id]
    );
  }

  function toggleAllCartSelection() {
    if (cart.length > 0 && selectedCartIds.length === cart.length) {
      setSelectedCartIds([]);
    } else {
      setSelectedCartIds(cart.map((item) => item.id!));
    }
  }

  function updateSelectedKarat(karat: string) {
    if (selectedCartIds.length === 0) return;
    setCart((current) =>
      current.map((item) => {
        if (selectedCartIds.includes(item.id!)) {
          let next = { ...item, metal_quality: karat } as Design;
          next = { ...next, ...calculateWeights(next) };
          return next;
        }
        return item;
      })
    );
  }

  async function exportPdf() {
    if (cart.length === 0) return;
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF();

      const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? null;

      // ── Header ──
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Design Quotation", 14, 18);

      const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text(`Date: ${today}`, 14, 25);
      doc.setTextColor(0);

      // ── Customer block (top-left, like postcard) ──
      let tableStartY = 32;
      if (selectedCustomer) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("To:", 14, 33);
        doc.setFont("helvetica", "normal");

        const lines: string[] = [];
        lines.push(selectedCustomer.name + (selectedCustomer.code ? ` (${selectedCustomer.code})` : ""));
        if (selectedCustomer.company) lines.push(selectedCustomer.company);
        if (selectedCustomer.mobile) lines.push(`Mobile: ${selectedCustomer.mobile}`);
        if (selectedCustomer.address) lines.push(selectedCustomer.address);
        if (selectedCustomer.city || selectedCustomer.state)
          lines.push([selectedCustomer.city, selectedCustomer.state].filter(Boolean).join(", "));
        if (selectedCustomer.gst) lines.push(`GSTIN: ${selectedCustomer.gst}`);
        if (selectedCustomer.pan) lines.push(`PAN: ${selectedCustomer.pan}`);

        lines.forEach((line, i) => doc.text(line, 20, 40 + i * 5));
        tableStartY = 44 + lines.length * 5;
      }

      const totalGross = cart.reduce((sum, item) => sum + (parseFloat(item.gross_weight || "0") || 0), 0);
      const totalNet = cart.reduce((sum, item) => sum + (parseFloat(item.net_weight || "0") || 0), 0);
      const totalPure = cart.reduce((sum, item) => sum + (parseFloat(item.pure_weight || "0") || 0), 0);
      const totalDiamond = cart.reduce((sum, item) => sum + (parseFloat(item.diamond_weight || "0") || 0), 0);

      const body = cart.map(item => [
        item.design_no,
        item.metal_quality,
        parseFloat(item.gross_weight || "0").toFixed(3),
        parseFloat(item.net_weight || "0").toFixed(3),
        parseFloat(item.pure_weight || "0").toFixed(3),
        parseFloat(item.diamond_weight || "0").toFixed(3),
        (item.diamond_sizes || []).map(s => `${s.size} (${s.quantity})`).join(", ") || "-"
      ]);

      body.push([
        "TOTAL", "-",
        totalGross.toFixed(3),
        totalNet.toFixed(3),
        totalPure.toFixed(3),
        totalDiamond.toFixed(3),
        "-"
      ]);

      autoTable(doc, {
        startY: tableStartY,
        head: [["Design No", "Karat", "Gross (g)", "Net (g)", "Pure (g)", "Diamond (ct)", "Diamond Sizes"]],
        body,
        theme: "grid",
        headStyles: { fillColor: [24, 24, 27] },
        willDrawCell: function (data) {
          if (data.row.index === body.length - 1) {
            doc.setFont("helvetica", "bold");
            data.cell.styles.fillColor = [244, 244, 245];
          }
        }
      });

      doc.save("Quotation.pdf");
      setIsCartOpen(false);

      // --- Save quotation record ---
      const record: Quotation = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        items: cart.map((item) => ({ ...item })),
        total_gross: totalGross,
        total_net: totalNet,
        total_pure: totalPure,
        total_diamond: totalDiamond,
        item_count: cart.length,
        customer: selectedCustomer ?? undefined,
      };
      setQuotations((prev) => {
        const updated = [record, ...prev];
        saveQuotations(updated);
        return updated;
      });
    } catch (error) {
      console.error("Failed to generate PDF", error);
    } finally {
      setExporting(false);
    }
  }

  async function redownloadQuotation(q: Quotation) {
    setRedownloading(q.id);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF();

      const dateStr = new Date(q.created_at).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      });

      // ── Header ──
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Design Quotation", 14, 18);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text(`Date: ${dateStr}`, 14, 25);
      doc.setTextColor(0);

      // ── Customer block (top-left) ──
      let tableStartY = 32;
      if (q.customer) {
        const cust = q.customer;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("To:", 14, 33);
        doc.setFont("helvetica", "normal");

        const lines: string[] = [];
        lines.push(cust.name + (cust.code ? ` (${cust.code})` : ""));
        if (cust.company) lines.push(cust.company);
        if (cust.mobile) lines.push(`Mobile: ${cust.mobile}`);
        if (cust.address) lines.push(cust.address);
        if (cust.city || cust.state)
          lines.push([cust.city, cust.state].filter(Boolean).join(", "));
        if (cust.gst) lines.push(`GSTIN: ${cust.gst}`);
        if (cust.pan) lines.push(`PAN: ${cust.pan}`);

        lines.forEach((line, i) => doc.text(line, 20, 40 + i * 5));
        tableStartY = 44 + lines.length * 5;
      }

      const body = q.items.map((item) => [
        item.design_no,
        item.metal_quality,
        parseFloat(item.gross_weight || "0").toFixed(3),
        parseFloat(item.net_weight || "0").toFixed(3),
        parseFloat(item.pure_weight || "0").toFixed(3),
        parseFloat(item.diamond_weight || "0").toFixed(3),
        (item.diamond_sizes || []).map((s) => `${s.size} (${s.quantity})`).join(", ") || "-",
      ]);

      body.push([
        "TOTAL", "-",
        q.total_gross.toFixed(3),
        q.total_net.toFixed(3),
        q.total_pure.toFixed(3),
        q.total_diamond.toFixed(3),
        "-",
      ]);

      autoTable(doc, {
        startY: tableStartY,
        head: [["Design No", "Karat", "Gross (g)", "Net (g)", "Pure (g)", "Diamond (ct)", "Diamond Sizes"]],
        body,
        theme: "grid",
        headStyles: { fillColor: [24, 24, 27] },
        willDrawCell: function (data) {
          if (data.row.index === body.length - 1) {
            doc.setFont("helvetica", "bold");
            data.cell.styles.fillColor = [244, 244, 245];
          }
        },
      });

      doc.save(`Quotation_${dateStr.replace(/ /g, "_")}.pdf`);
    } catch (err) {
      console.error("Re-download failed", err);
    } finally {
      setRedownloading(null);
    }
  }

  function deleteQuotation(id: string) {
    if (!window.confirm("Delete this quotation record?")) return;
    setQuotations((prev) => {
      const updated = prev.filter((q) => q.id !== id);
      saveQuotations(updated);
      return updated;
    });
  }

  function openCartForEdit(q: Quotation) {
    setCart(q.items.map((item) => ({ ...item })));
    setSelectedCartIds([]);
    setSelectedCustomerId(q.customer?.id ?? "");
    setIsCartOpen(true);
  }

  function updateForm(key: keyof Design, value: any) {
    setFormError("");
    setEditing((current) => {
      if (!current) return current;
      let next = { ...current, [key]: value } as Design;
      if (key === "category_id") next.sub_category_id = "";
      if (["gross_weight", "diamond_weight", "stone_weight", "metal_quality"].includes(key)) {
        const calculated = calculateWeights(next);
        next = { ...next, ...calculated };
      }
      return next;
    });
  }

  function selectImage(file: File | null) {
    setFormError("");
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) return;
    setSelectedFile(file);
    setEditing((current) => (current ? { ...current, image_url: URL.createObjectURL(file) } : current));
  }

  function openDesignForm(design: Design) {
    setFormError("");
    setSelectedFile(null);
    const calculated = calculateWeights(design);
    setEditing({ ...design, ...calculated });
  }

  function closeDesignForm() {
    setFormError("");
    setSelectedFile(null);
    setEditing(null);
  }

  async function uploadImage(design: Design, file: File) {
    if (!design.id) return design.image_url;
    const presign = await writeJson("/api/storage/presign-upload", "POST", {
      contentType: file.type,
      filename: file.name,
      ownerCode: design.design_no || "draft",
      scope: "designs",
      sizeBytes: file.size,
    });
    if (!presign?.uploadUrl || !presign?.objectKey) return design.image_url;

    await fetch(presign.uploadUrl, {
      body: file,
      headers: presign.headers ?? { "Content-Type": file.type },
      method: "PUT",
    });
    await writeJson(`/api/designs/${design.id}/images`, "POST", {
      isPrimary: true,
      mimeType: file.type,
      objectKey: presign.objectKey,
      originalFilename: file.name,
      sizeBytes: file.size,
    });

    return `/media/images/${presign.objectKey}`;
  }

  async function saveDesign() {
    if (!editing) return;
    setSaving(true);
    const categoryName = categories.find((item) => item.id === editing.category_id)?.name;
    const subCategoryName = subCategories.find((item) => item.id === editing.sub_category_id)?.name;
    const payload = { ...editing, category_name: categoryName, sub_category_name: subCategoryName };
    const method = editing.id ? "PUT" : "POST";
    const target = editing.id ? `/api/designs/${editing.id}` : "/api/designs";
    try {
      const saved = await writeJson(target, method, toDesignPayload(payload));
      const nextRow = normalizeDesign(saved?.data ?? saved ?? payload);
      let completedRow = { ...payload, ...nextRow, id: nextRow.id ?? editing.id };
      if (selectedFile && completedRow.id) {
        const imageUrl = await uploadImage(completedRow, selectedFile).catch(() => completedRow.image_url);
        completedRow = { ...completedRow, image_url: imageUrl };
      }
      setRows((current) => {
        if (editing.id) return current.map((row) => (row.id === editing.id ? completedRow : row));
        return [{ ...completedRow, id: completedRow.id ?? crypto.randomUUID() }, ...current];
      });
      closeDesignForm();
      setMessage("Design saved.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save design.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDesign(row: Design) {
    if (!row.id || !window.confirm(`Delete ${row.design_no}?`)) return;
    try {
      await deleteJson(`/api/designs/${row.id}`);
      setRows((current) => current.filter((item) => item.id !== row.id));
      setMessage(`${row.design_no} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete design.");
    }
  }

  const columns: Column<Design>[] = [
    {
      header: "Design",
      key: "design",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-zinc-100 text-zinc-500">
            {row.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={row.design_no} className="h-12 w-12 rounded-md object-cover" src={row.image_url} />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="font-medium text-zinc-950">{row.design_no}</p>
            <p className="text-xs text-zinc-500">{row.design_date}</p>
          </div>
        </div>
      ),
    },
    { header: "Category", key: "category", render: (row) => row.category_name || row.category_id },
    { header: "Sub Category", key: "subCategory", render: (row) => row.sub_category_name || "-" },
    { header: "Metal", key: "metal", render: (row) => row.metal_quality },
    {
      header: "Weights",
      key: "weights",
      render: (row) => (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-600">
          <span>G {row.gross_weight || "0"}g</span>
          <span>N {row.net_weight || "0"}g</span>
          <span>D {row.diamond_weight || "0"}ct</span>
          <span>S {row.stone_weight || "0"}ct</span>
        </div>
      ),
    },
    { header: "Status", key: "status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    {
      className: "text-right",
      header: "Actions",
      key: "actions",
      render: (row) => {
        const inCart = cart.some((c) => c.id === row.id);
        return (
          <div className="flex justify-end gap-2">
            <Button
              aria-label={inCart ? "Remove from cart" : "Add to cart"}
              className={inCart ? "text-emerald-600 hover:text-emerald-700" : ""}
              onClick={() => toggleCart(row)}
              size="icon"
              variant="ghost"
            >
              {inCart ? <MinusCircle className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
            </Button>
            <Button aria-label="Edit design" onClick={() => openDesignForm(row)} size="icon" variant="ghost">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button aria-label="Delete design" onClick={() => deleteDesign(row)} size="icon" variant="ghost">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const visibleSubCategories = subCategories.filter((item) => item.category_id === editing?.category_id);

  return (
    <>
      <PageHeader
        actions={
          activeTab === "designs" ? (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setImportSummary(null);
                  setParsedRows([]);
                  setImportError("");
                  setIsImportOpen(true);
                }}
              >
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <Button
                onClick={() => {
                  openDesignForm({ ...emptyDesign(categories[0]?.id ?? "") });
                }}
              >
                <Plus className="h-4 w-4" />
                Add Design
              </Button>
            </div>
          ) : null
        }
        eyebrow="Design Master"
        title={activeTab === "designs" ? "Designs" : "Quotations"}
      />

      {/* Tab bar */}
      <div className="border-b border-zinc-200 bg-white px-4 sm:px-6 lg:px-8">
        <nav className="-mb-px flex gap-6 overflow-x-auto whitespace-nowrap scrollbar-none">
          {(["designs", "quotations"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "flex-shrink-0 flex items-center gap-2 border-b-2 pb-3 pt-3 text-sm font-medium capitalize transition-colors",
                activeTab === tab
                  ? "border-zinc-950 text-zinc-950"
                  : "border-transparent text-zinc-500 hover:text-zinc-800",
              ].join(" ")}
            >
              {tab === "designs" ? <ImagePlus className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              {tab === "designs" ? "Designs" : "Quotations"}
              {tab === "quotations" && quotations.length > 0 && (
                <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
                  {quotations.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Quotations Tab ── */}
      {activeTab === "quotations" && (
        <section className="p-4 sm:p-6 lg:p-8">
          {quotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center">
              <FileText className="h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No quotations saved yet</p>
              <p className="text-xs text-zinc-400">Export a PDF from the cart — it will appear here for future re-download.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Date & Time</th>
                      <th className="px-4 py-3 text-left font-semibold">Customer</th>
                      <th className="px-4 py-3 text-left font-semibold">Designs</th>
                      <th className="px-4 py-3 text-left font-semibold">Gross (g)</th>
                      <th className="px-4 py-3 text-left font-semibold">Net (g)</th>
                      <th className="px-4 py-3 text-left font-semibold">Pure (g)</th>
                      <th className="px-4 py-3 text-left font-semibold">Diamond (ct)</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {quotations.map((q) => {
                      const dateStr = new Date(q.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                      });
                      const timeStr = new Date(q.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit", minute: "2-digit",
                      });
                      return (
                        <tr key={q.id} className="hover:bg-zinc-50/70">
                          <td className="px-4 py-3">
                            <p className="font-medium text-zinc-900">{dateStr}</p>
                            <p className="text-xs text-zinc-400">{timeStr}</p>
                          </td>
                          <td className="px-4 py-3">
                            {q.customer ? (
                              <div>
                                <p className="font-semibold text-zinc-900 text-xs">{q.customer.code}</p>
                                <p className="text-[11px] text-zinc-500 truncate max-w-[140px]">{q.customer.name}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-400 italic">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                              {q.item_count} item{q.item_count !== 1 ? "s" : ""}
                            </span>
                            <p className="mt-1 text-[11px] text-zinc-400 truncate max-w-[200px]">
                              {q.items.map((i) => i.design_no).join(", ")}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{q.total_gross.toFixed(3)}</td>
                          <td className="px-4 py-3 text-zinc-700">{q.total_net.toFixed(3)}</td>
                          <td className="px-4 py-3 text-zinc-700">{q.total_pure.toFixed(3)}</td>
                          <td className="px-4 py-3 text-zinc-700">{q.total_diamond.toFixed(3)}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                aria-label="Edit quotation"
                                onClick={() => openCartForEdit(q)}
                                size="icon"
                                variant="ghost"
                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                aria-label="Download PDF"
                                isLoading={redownloading === q.id}
                                onClick={() => redownloadQuotation(q)}
                                size="icon"
                                variant="ghost"
                                className="text-zinc-500 hover:text-zinc-900"
                              >
                                {redownloading !== q.id && <FileDown className="h-4 w-4" />}
                              </Button>
                              <Button
                                aria-label="Delete quotation"
                                onClick={() => deleteQuotation(q.id)}
                                size="icon"
                                variant="ghost"
                                className="text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Designs Tab ── */}
      {activeTab === "designs" && (
      <section className="p-4 sm:p-6 lg:p-8">
        {message ? <div className="mb-4 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">{message}</div> : null}
        {loading ? (
          <Loader label="Loading designs..." />
        ) : (
          <DataTable
            columns={columns}
            empty="No designs match the current filters."
            filters={
              <>
                <Select aria-label="Filter by category" onChange={(event) => setCategory(event.target.value)} value={category}>
                  <option value="ALL">All categories</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
                <Select aria-label="Filter by status" onChange={(event) => setStatus(event.target.value)} value={status}>
                  <option value="ALL">All status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </>
            }
            gridRender={(row) => (
              <div className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                {/* Image */}
                <div className="relative aspect-square w-full overflow-hidden bg-zinc-100">
                  {row.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={row.design_no}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      src={row.image_url}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-300">
                      <ImagePlus className="h-10 w-10" />
                    </div>
                  )}
                  {/* Status badge overlay */}
                  <span
                    className={[
                      "absolute right-2 top-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                      row.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                        : "bg-rose-50 text-rose-800 ring-rose-200",
                    ].join(" ")}
                  >
                    {row.status}
                  </span>
                </div>
                {/* Info */}
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <p className="truncate text-sm font-semibold text-zinc-900">{row.design_no}</p>
                  <p className="truncate text-xs text-zinc-500">{row.category_name || row.category_id}</p>
                  <p className="text-xs text-zinc-400">{row.metal_quality} · {row.design_date}</p>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-zinc-500">
                    <span>G: {row.gross_weight || "0"}g</span>
                    <span>N: {row.net_weight || "0"}g</span>
                    <span className="font-medium text-zinc-900">D: {row.diamond_weight || "0"}ct</span>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex justify-end gap-1 border-t border-zinc-100 px-3 py-2">
                  <Button
                    aria-label={cart.some((c) => c.id === row.id) ? "Remove from cart" : "Add to cart"}
                    className={cart.some((c) => c.id === row.id) ? "text-emerald-600 hover:text-emerald-700" : ""}
                    onClick={() => toggleCart(row)}
                    size="icon"
                    variant="ghost"
                  >
                    {cart.some((c) => c.id === row.id) ? <MinusCircle className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                  </Button>
                  <Button aria-label="Edit design" onClick={() => openDesignForm(row)} size="icon" variant="ghost">
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button aria-label="Delete design" onClick={() => deleteDesign(row)} size="icon" variant="ghost">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            rows={filtered}
            search={search}
            searchPlaceholder="Search design number, category, sub category, metal..."
            setSearch={setSearch}
            setViewMode={setViewMode}
            viewMode={viewMode}
          />
        )}
      </section>
      )}

      <Dialog
        onClose={closeDesignForm}
        open={Boolean(editing)}
        title={`${editing?.id ? "Edit" : "Add"} Design`}
      >
        {editing ? (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveDesign();
            }}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <FieldWrap label="Design No">
                <Input value={editing.design_no} onChange={(event) => updateForm("design_no", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="Date">
                <Input type="date" value={editing.design_date} onChange={(event) => updateForm("design_date", event.target.value)} />
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
              <FieldWrap label="Category">
                <Select value={editing.category_id} onChange={(event) => updateForm("category_id", event.target.value)}>
                  {categories.length === 0 ? <option value="">No categories</option> : null}
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </FieldWrap>
              <FieldWrap label="Sub Category">
                <Select value={editing.sub_category_id ?? ""} onChange={(event) => updateForm("sub_category_id", event.target.value)}>
                  <option value="">None</option>
                  {visibleSubCategories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </FieldWrap>
              <FieldWrap hint="JPG, PNG, or WebP up to 5 MB. Saved records upload through the presigned storage API." label="Design Image">
                <Input accept="image/jpeg,image/png,image/webp" type="file" onChange={(event) => selectImage(event.target.files?.[0] ?? null)} />
              </FieldWrap>
              <FieldWrap label="Gross Weight">
                <Input min="0" step="0.001" type="number" value={editing.gross_weight || ""} onChange={(event) => updateForm("gross_weight", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="Diamond Weight (Carat)">
                <Input min="0" step="0.001" type="number" value={editing.diamond_weight || ""} onChange={(event) => updateForm("diamond_weight", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="CS Weight (Carat)">
                <Input min="0" step="0.001" type="number" value={editing.stone_weight || ""} onChange={(event) => updateForm("stone_weight", event.target.value)} />
              </FieldWrap>
              {/* <FieldWrap hint="Auto calculated: Carat × 0.2" label="D/S Weight (Gram)">
                <Input disabled value={((Number(editing.diamond_weight || 0) + Number(editing.stone_weight || 0)) * 0.2).toFixed(3)} />
              </FieldWrap> */}
              <FieldWrap hint="Auto calculated: Gross − (D+S)(g)" label="Net Weight">
                <Input disabled value={editing.net_weight || "0.000"} />
              </FieldWrap>
              <FieldWrap hint="Auto calculated: Net × Purity %" label="Pure Gold Weight">
                <Input disabled value={editing.pure_weight || "0.000"} />
              </FieldWrap>
              <FieldWrap label="Diamond Pieces">
                <Input
                  min="0"
                  step="1"
                  type="number"
                  value={editing.diamond_pieces ?? ""}
                  onChange={(event) => {
                    setFormError("");
                    setEditing((current) => (current ? { ...current, diamond_pieces: Number(event.target.value || 0) } : current));
                  }}
                />
              </FieldWrap>
              <FieldWrap label="Stone Pieces">
                <Input
                  min="0"
                  step="1"
                  type="number"
                  value={editing.stone_pieces ?? ""}
                  onChange={(event) => {
                    setFormError("");
                    setEditing((current) => (current ? { ...current, stone_pieces: Number(event.target.value || 0) } : current));
                  }}
                />
              </FieldWrap>
              <FieldWrap label="Diamond Colour">
                <Input value={editing.diamond_color ?? ""} onChange={(event) => updateForm("diamond_color", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="Diamond Quality">
                <Input value={editing.diamond_quality ?? ""} onChange={(event) => updateForm("diamond_quality", event.target.value)} />
              </FieldWrap>
              <FieldWrap label="Status">
                <Select value={editing.status} onChange={(event) => updateForm("status", event.target.value)}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </FieldWrap>
              <div className="md:col-span-2">
                <FieldWrap label="Diamond Sizes & Quantities">
                  <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
                    <div className="flex flex-col gap-2">
                      {(editing.diamond_sizes || []).map((entry, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="relative flex-[2]">
                            <Input 
                              value={entry.size}
                              onChange={(e) => {
                                const newSizes = [...(editing.diamond_sizes || [])];
                                newSizes[index] = { ...newSizes[index], size: e.target.value };
                                const totalQty = newSizes.reduce((sum, s) => sum + (s.quantity || 0), 0);
                                setEditing((current) => {
                                  if (!current) return current;
                                  return { ...current, diamond_sizes: newSizes, diamond_pieces: totalQty };
                                });
                              }}
                              placeholder="Size"
                              className="h-9"
                            />
                          </div>
                          <div className="relative flex-1">
                            <Input 
                              type="number"
                              value={entry.quantity || ""}
                              onChange={(e) => {
                                const newSizes = [...(editing.diamond_sizes || [])];
                                const qty = parseInt(e.target.value) || 0;
                                newSizes[index] = { ...newSizes[index], quantity: qty };
                                const totalQty = newSizes.reduce((sum, s) => sum + (s.quantity || 0), 0);
                                setEditing((current) => {
                                  if (!current) return current;
                                  return { ...current, diamond_sizes: newSizes, diamond_pieces: totalQty };
                                });
                              }}
                              placeholder="Qty"
                              className="h-9"
                            />
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                            onClick={() => {
                              const newSizes = (editing.diamond_sizes || []).filter((_, i) => i !== index);
                              const totalQty = newSizes.reduce((sum, s) => sum + (s.quantity || 0), 0);
                              setEditing((current) => {
                                if (!current) return current;
                                return { ...current, diamond_sizes: newSizes, diamond_pieces: totalQty };
                              });
                            }}
                          >
                            <MinusCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-1 w-full bg-white text-[11px] font-semibold"
                        onClick={() => {
                          updateForm("diamond_sizes", [...(editing.diamond_sizes || []), { size: "", quantity: 0 }]);
                        }}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Diamond Size
                      </Button>
                    </div>

                    <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Quantity</span>
                        <span className="text-xs font-bold text-zinc-900">
                          {(editing.diamond_sizes || []).reduce((sum, s) => sum + (s.quantity || 0), 0)} Pcs
                        </span>
                      </div>
                    </div>
                  </div>
                </FieldWrap>
              </div>
            </div>
            <FieldWrap label="Remarks">
              <Textarea value={editing.remarks ?? ""} onChange={(event) => updateForm("remarks", event.target.value)} />
            </FieldWrap>
            {formError ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</div>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
              <Button onClick={closeDesignForm} variant="secondary">
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

      {/* Cart Summary Bottom Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:left-64">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 text-white">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-950">{cart.length} Designs Selected</p>
                <p className="text-xs text-zinc-500">
                  Gross: {cart.reduce((s, c) => s + (parseFloat(c.gross_weight || "0") || 0), 0).toFixed(3)}g |
                  Pure: {cart.reduce((s, c) => s + (parseFloat(c.pure_weight || "0") || 0), 0).toFixed(3)}g
                </p>
              </div>
            </div>
            <Button onClick={() => setIsCartOpen(true)}>View Cart</Button>
          </div>
        </div>
      )}

      {/* Cart Dialog */}
      <Dialog onClose={() => setIsCartOpen(false)} open={isCartOpen} title="Quotation Cart">
        <div className="flex flex-col gap-4">
          {/* Customer Selector */}
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Select Customer for this Quotation</p>
            <Select
              aria-label="Select customer"
              className="h-9 w-full text-sm"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              <option value="">— No customer selected —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.code ? ` (${c.code})` : ""}{c.company ? ` — ${c.company}` : ""}
                </option>
              ))}
            </Select>
            {selectedCustomerId && (() => {
              const cust = customers.find((c) => c.id === selectedCustomerId);
              if (!cust) return null;
              return (
                <div className="mt-2 rounded border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 space-y-0.5">
                  <p className="font-semibold text-zinc-900">{cust.name}{cust.company ? ` — ${cust.company}` : ""}</p>
                  {cust.mobile && <p>📞 {cust.mobile}</p>}
                  {cust.address && <p>📍 {cust.address}{cust.city ? `, ${cust.city}` : ""}{cust.state ? `, ${cust.state}` : ""}</p>}
                  {cust.gst && <p>GSTIN: {cust.gst}</p>}
                  {cust.pan && <p>PAN: {cust.pan}</p>}
                </div>
              );
            })()}
          </div>

          {cart.length > 0 && (
            <div className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-medium text-zinc-600 italic">
                {selectedCartIds.length > 0 
                  ? `Apply Karat to ${selectedCartIds.length} selected items:` 
                  : "Select items to apply bulk Karat change:"}
              </p>
              <Select
                className="h-8 w-[130px] py-0 pl-2 pr-6 text-xs"
                disabled={selectedCartIds.length === 0}
                onChange={(e) => {
                  updateSelectedKarat(e.target.value);
                  e.target.value = ""; // Reset select
                }}
                value=""
              >
                <option disabled value="">
                  Select Karat
                </option>
                {metalQualities.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="max-h-[60vh] overflow-auto rounded-md border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="sticky top-0 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    <input
                      checked={cart.length > 0 && selectedCartIds.length === cart.length}
                      className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950"
                      onChange={toggleAllCartSelection}
                      type="checkbox"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold">Design No</th>
                  <th className="px-4 py-3 font-semibold">Karat</th>
                  <th className="px-4 py-3 font-semibold">Gross (g)</th>
                  <th className="px-4 py-3 font-semibold">Diamond (ct)</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {cart.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/70">
                    <td className="px-4 py-3">
                      <input
                        checked={selectedCartIds.includes(item.id!)}
                        className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950"
                        onChange={() => toggleCartSelection(item.id!)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{item.design_no}</td>
                    <td className="px-4 py-3">
                      <Select
                        className="h-8 min-w-[90px] py-0 pl-2 pr-6 text-xs"
                        onChange={(e) => updateCartItem(item.id!, "metal_quality", e.target.value)}
                        value={item.metal_quality}
                      >
                        {metalQualities.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        className="h-8 w-[80px] px-2 text-xs"
                        min="0"
                        onChange={(e) => updateCartItem(item.id!, "gross_weight", e.target.value)}
                        step="0.001"
                        type="number"
                        value={item.gross_weight || ""}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        className="h-8 w-[80px] px-2 text-xs"
                        min="0"
                        onChange={(e) => updateCartItem(item.id!, "diamond_weight", e.target.value)}
                        step="0.001"
                        type="number"
                        value={item.diamond_weight || ""}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => toggleCart(item)}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-zinc-500" colSpan={6}>
                      Cart is empty
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
            <Button onClick={() => setIsCartOpen(false)} variant="secondary">
              Close
            </Button>
            <Button disabled={cart.length === 0} isLoading={exporting} onClick={exportPdf}>
              <FileDown className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Excel Import Dialog */}
      <Dialog
        onClose={() => {
          setIsImportOpen(false);
          setImportSummary(null);
          setParsedRows([]);
          setImportError("");
        }}
        open={isImportOpen}
        title="Import Designs from Excel"
        className="sm:max-w-5xl"
        hideClose={parsedRows.length > 0 || parsing || importing}
      >
        <div className="flex flex-col gap-5">
          {importError && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {/* 1. Upload state: dropzone & instructions */}
          {parsedRows.length === 0 && !importSummary && !parsing && !importing && (
            <div className="grid gap-6 md:grid-cols-5">
              <div className="md:col-span-2 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Import Instructions</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Upload your designs using a spreadsheet. The system supports `.xlsx`, `.xls`, or `.csv` files.
                  </p>
                </div>
                
                <div className="space-y-2 text-xs text-zinc-600">
                  <p className="font-semibold text-zinc-800">Required Column Formats:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong className="text-zinc-900">Category</strong>: Rings, Bangles, etc. (Created automatically if new)</li>
                    <li><strong className="text-zinc-900">Gross Weight</strong>: Number in grams (e.g. 5.42)</li>
                    <li><strong className="text-zinc-900">Metal Quality</strong>: 18KT, 22KT, etc.</li>
                  </ul>

                  <p className="pt-2 font-semibold text-zinc-800">Optional Column Formats:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong className="text-zinc-900">Design No</strong>: Unique code. Auto-generated if left blank</li>
                    <li><strong className="text-zinc-900">Diamond Weight / CS Weight</strong>: Carats (e.g. 0.35)</li>
                    <li><strong className="text-zinc-900">Diamond Sizes</strong>: e.g. <code className="bg-zinc-100 px-1 rounded">1.1:8, 1.2:4</code></li>
                    <li><strong className="text-zinc-900">Status</strong>: ACTIVE or INACTIVE (Defaults to ACTIVE)</li>
                  </ul>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={downloadTemplate}
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Download Excel Template
                  </Button>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div className="md:col-span-3">
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={[
                    "flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 text-center transition-all min-h-[300px]",
                    dragActive
                      ? "border-zinc-950 bg-zinc-50"
                      : "border-zinc-300 hover:border-zinc-400 bg-white"
                  ].join(" ")}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                    <Upload className="h-6 w-6 animate-bounce" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      Drag & drop your Excel file here
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      or click to browse files on your computer
                    </p>
                  </div>
                  <label className="relative mt-2">
                    <span className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 cursor-pointer">
                      Choose File
                    </span>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          parseExcelFile(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 2. Parsing state */}
          {parsing && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <Loader label="Reading spreadsheet and running validation checks..." />
            </div>
          )}

          {/* 3. Parsed preview list */}
          {parsedRows.length > 0 && !importSummary && !parsing && !importing && (
            <div className="flex flex-col gap-4">
              {/* Summary Dashboard */}
              <div className="grid grid-cols-4 gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 text-center">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Rows</span>
                  <span className="text-xl font-bold text-zinc-900">{parsedRows.length}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Ready</span>
                  <span className="text-xl font-bold text-emerald-600">
                    {parsedRows.filter(r => r.errors.length === 0).length}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Warnings</span>
                  <span className="text-xl font-bold text-amber-500">
                    {parsedRows.reduce((acc, r) => acc + r.warnings.length, 0)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Errors</span>
                  <span className="text-xl font-bold text-rose-600">
                    {parsedRows.reduce((acc, r) => acc + r.errors.length, 0)}
                  </span>
                </div>
              </div>

              {/* Preview Table */}
              <div className="max-h-[50vh] overflow-auto rounded-lg border border-zinc-200 bg-white">
                <table className="min-w-full divide-y divide-zinc-200 text-left text-xs">
                  <thead className="sticky top-0 bg-zinc-50 font-semibold uppercase tracking-wider text-zinc-500 shadow-sm">
                    <tr>
                      <th className="px-3 py-2.5">Row</th>
                      <th className="px-3 py-2.5">Design No</th>
                      <th className="px-3 py-2.5">Category</th>
                      <th className="px-3 py-2.5">Karat</th>
                      <th className="px-3 py-2.5">Gross (g)</th>
                      <th className="px-3 py-2.5">Net (g)</th>
                      <th className="px-3 py-2.5">CS/Stone</th>
                      <th className="px-3 py-2.5">Validation Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {parsedRows.map((row, idx) => {
                      const hasErrors = row.errors.length > 0;
                      const hasWarnings = row.warnings.length > 0;
                      return (
                        <tr key={idx} className={hasErrors ? "bg-rose-50/30" : "hover:bg-zinc-50/50"}>
                          <td className="px-3 py-2 text-zinc-400 font-medium">#{row.rowNum}</td>
                          <td className="px-3 py-2 font-semibold text-zinc-900">
                            {row.designNo ? row.designNo : <span className="text-zinc-400 italic font-normal">(Auto)</span>}
                          </td>
                          <td className="px-3 py-2">
                            {row.categoryName}
                            {row.subCategoryName && <span className="text-[10px] text-zinc-400 block">{row.subCategoryName}</span>}
                          </td>
                          <td className="px-3 py-2 text-zinc-600">{row.metalQuality}</td>
                          <td className="px-3 py-2 text-zinc-700">{row.grossWeight}g</td>
                          <td className="px-3 py-2 text-zinc-700">{row.netWeight}g</td>
                          <td className="px-3 py-2 text-zinc-500">
                            {row.diamondWeight > 0 && `${row.diamondWeight}ct (${row.diamondPieces}p)`}
                            {row.stoneWeight > 0 && ` | CS: ${row.stoneWeight}ct (${row.stonePieces}p)`}
                          </td>
                          <td className="px-3 py-2 space-y-1">
                            {hasErrors && row.errors.map((e: string, i: number) => (
                              <div key={i} className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-inset ring-rose-600/10 mr-1">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                {e}
                              </div>
                            ))}
                            {hasWarnings && row.warnings.map((w: string, i: number) => (
                              <div key={i} className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/10 mr-1">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                {w}
                              </div>
                            ))}
                            {!hasErrors && !hasWarnings && (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                                Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action buttons */}
              <div className="flex justify-between border-t border-zinc-200 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setParsedRows([]);
                    setImportError("");
                  }}
                >
                  Clear & Re-upload
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setIsImportOpen(false);
                      setParsedRows([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={parsedRows.some(r => r.errors.length > 0)}
                    onClick={executeImport}
                  >
                    Confirm Import ({parsedRows.length} Rows)
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 4. Importing in progress */}
          {importing && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <Loader label="Processing..." />
            </div>
          )}

          {/* 5. Success summary */}
          {importSummary && (
            <div className="flex flex-col items-center justify-center py-8 gap-5 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-10 w-10 animate-ping absolute opacity-30" />
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-950">Designs Imported Successfully!</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Spreadsheet records have been synchronized with the database.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-sm w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 text-xs">
                <div className="flex justify-between border-r border-zinc-200 pr-4">
                  <span className="text-zinc-500">New Designs Created:</span>
                  <strong className="text-zinc-950">{importSummary.createdCount || 0}</strong>
                </div>
                <div className="flex justify-between pl-4">
                  <span className="text-zinc-500">Designs Updated:</span>
                  <strong className="text-zinc-950">{importSummary.updatedCount || 0}</strong>
                </div>
                <div className="flex justify-between border-r border-zinc-200 pr-4 pt-2 border-t border-zinc-200 mt-2">
                  <span className="text-zinc-500">New Categories:</span>
                  <strong className="text-zinc-950">{importSummary.newCategoriesCount || 0}</strong>
                </div>
                <div className="flex justify-between pl-4 pt-2 border-t border-zinc-200 mt-2">
                  <span className="text-zinc-500">New Sub-Categories:</span>
                  <strong className="text-zinc-950">{importSummary.newSubCategoriesCount || 0}</strong>
                </div>
              </div>

              <div className="w-full border-t border-zinc-200 pt-4 flex justify-center">
                <Button
                  onClick={() => {
                    setIsImportOpen(false);
                    setImportSummary(null);
                    setParsedRows([]);
                    fetchData(); // Refresh page datasets
                  }}
                >
                  Finish & Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}

export function normalizeDesign(item: Record<string, unknown>): Design {
  const category = item.category as { id?: string; name?: string } | undefined;
  const subCategory = item.subCategory as { id?: string; name?: string } | undefined;
  const images = item.images as { objectKey?: string }[] | undefined;
  const objectKey = images?.[0]?.objectKey;

  let metal_quality = String(item.metal_quality ?? item.metalQuality ?? "");
  if (metal_quality === "24K") metal_quality = "24KT";
  else if (metal_quality === "22K") metal_quality = "22KT";
  else if (metal_quality === "18K") metal_quality = "18KT";

  return {
    category_id: String(item.category_id ?? item.categoryId ?? category?.id ?? ""),
    category_name: String(item.category_name ?? category?.name ?? ""),
    design_date: String(item.design_date ?? item.designDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
    design_no: String(item.design_no ?? item.designNo ?? ""),
    diamond_pieces: Number(item.diamond_pieces ?? item.diamondPieces ?? 0),
    diamond_sizes: (() => {
      const rawSizes = item.diamond_sizes ?? item.diamondSizes;
      return Array.isArray(rawSizes) ? (rawSizes as unknown[]).map((s: any) => {
          if (typeof s === "string" && s.includes(":")) {
            const [size, qty] = s.split(":");
            return { size, quantity: parseInt(qty) || 0 };
          }
          if (typeof s === "object" && s !== null && "size" in s) return s;
          return { size: String(s), quantity: 0 };
        }) : [];
    })(),
    diamond_weight: String(item.diamond_weight ?? item.diamondWeight ?? ""),
    gross_weight: String(item.gross_weight ?? item.grossWeight ?? ""),
    id: item.id ? String(item.id) : undefined,
    image_url: String(item.image_url ?? (objectKey ? `/media/images/${objectKey}` : "")),
    metal_quality,
    net_weight: String(item.net_weight ?? item.netWeight ?? "0.000"),
    pure_weight: String(item.pure_weight ?? item.pureWeight ?? "0.000"),
    remarks: item.remarks ? String(item.remarks) : undefined,
    status: String(item.status ?? "ACTIVE") as Design["status"],
    stone_pieces: Number(item.stone_pieces ?? item.stonePieces ?? 0),
    stone_weight: String(item.stone_weight ?? item.stoneWeight ?? "0.000"),
    sub_category_id: String(item.sub_category_id ?? item.subCategoryId ?? subCategory?.id ?? ""),
    sub_category_name: String(item.sub_category_name ?? subCategory?.name ?? ""),
    diamond_color: String(item.diamond_color ?? item.diamondColor ?? ""),
    diamond_quality: String(item.diamond_quality ?? item.diamondQuality ?? ""),
  };
}

function toDesignPayload(item: Design) {
  return {
    categoryId: item.category_id,
    designDate: item.design_date,
    designNo: item.design_no,
    diamondPieces: item.diamond_pieces,
    diamondSizes: item.diamond_sizes?.length 
      ? item.diamond_sizes.filter(s => s.size.trim() !== "").map(s => `${s.size}:${s.quantity}`) 
      : undefined,
    diamondWeight: item.diamond_weight,
    grossWeight: item.gross_weight,
    metalQuality: item.metal_quality,
    netWeight: item.net_weight,
    pureWeight: item.pure_weight,
    status: item.status,
    stonePieces: item.stone_pieces,
    stoneWeight: item.stone_weight,
    subCategoryId: item.sub_category_id,
    remarks: item.remarks?.trim() || undefined,
    diamondColor: item.diamond_color,
    diamondQuality: item.diamond_quality,
  };
}

function normalizeCategoryOption(item: Record<string, unknown>) {
  return {
    id: String(item.id ?? ""),
    name: String(item.name ?? ""),
  };
}

function normalizeSubCategoryOption(item: Record<string, unknown>) {
  const category = item.category as { id?: string } | undefined;
  return {
    category_id: String(item.category_id ?? item.categoryId ?? category?.id ?? ""),
    id: String(item.id ?? ""),
    name: String(item.name ?? ""),
  };
}
