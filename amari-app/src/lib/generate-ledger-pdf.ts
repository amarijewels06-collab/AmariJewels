import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Helper for formatting numbers
function fmtNum(val: any): string {
  const n = Number(val);
  return n ? n.toFixed(3) : "";
}

function fmtAmt(val: any): string {
  const n = Number(val);
  return n ? n.toFixed(2) : "";
}

function getSideVal(net: number, col: "dr" | "cr", decimals: number): string {
  if (col === "dr") return net > 0 ? net.toFixed(decimals) : "";
  return net < 0 ? Math.abs(net).toFixed(decimals) : "";
}

// 1. Customer Ledger PDF Generator
export function generateCustomerLedgerPdf({
  debitEntries,
  creditEntries,
  debitTotals,
  creditTotals,
  customerName,
  dateRange,
}: {
  debitEntries: any[];
  creditEntries: any[];
  debitTotals: { gold: number; diamond: number; stone: number; otherMetals: number; amount: number };
  creditTotals: { gold: number; diamond: number; stone: number; otherMetals: number; amount: number };
  customerName: string;
  dateRange: string;
}): jsPDF {
  const doc = new jsPDF({ orientation: "landscape" });

  // Company Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(31, 41, 55); // charcoal
  doc.text("AMARI JEWELS", 148, 15, { align: "center" });

  // Report Title
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(75, 85, 99); // gray-600
  doc.text("Customer Ledger Report", 148, 21, { align: "center" });

  // Line separator
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.5);
  doc.line(14, 24, 283, 24);

  // Metadata Left
  doc.setFontSize(9);
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.text("Customer:", 14, 30);
  doc.setFont("helvetica", "normal");
  doc.text(customerName, 32, 30);

  doc.setFont("helvetica", "bold");
  doc.text("Date Range:", 14, 35);
  doc.setFont("helvetica", "normal");
  doc.text(dateRange, 34, 35);

  // Metadata Right
  const generatedAt = new Date().toLocaleString("en-IN", { hour12: true });
  doc.setFont("helvetica", "bold");
  doc.text("Generated At:", 200, 30);
  doc.setFont("helvetica", "normal");
  doc.text(generatedAt, 222, 30);

  // Generate Table Data
  const body: any[] = [];
  const maxRows = Math.max(debitEntries.length, creditEntries.length);

  for (let idx = 0; idx < maxRows; idx++) {
    const dr = debitEntries[idx];
    const cr = creditEntries[idx];
    body.push([
      // Debit
      dr ? dr.date : "",
      dr ? dr.invoice_no : "",
      dr ? dr.particular : "",
      dr ? dr.remarks : "",
      dr ? fmtNum(dr.gold_gm) : "",
      dr ? fmtNum(dr.diamond_carat) : "",
      dr ? fmtNum(dr.stone_carat) : "",
      dr ? fmtNum(dr.other_metals_gm) : "",
      dr ? fmtAmt(dr.total_amount) : "",
      // Credit
      cr ? cr.date : "",
      cr ? cr.invoice_no : "",
      cr ? cr.particular : "",
      cr ? cr.remarks : "",
      cr ? fmtNum(cr.gold_gm) : "",
      cr ? fmtNum(cr.diamond_carat) : "",
      cr ? fmtNum(cr.stone_carat) : "",
      cr ? fmtNum(cr.other_metals_gm) : "",
      cr ? fmtAmt(cr.total_amount) : "",
    ]);
  }

  // Draw autoTable
  autoTable(doc, {
    startY: 42,
    head: [
      [
        { content: "DEBIT", colSpan: 9, styles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], halign: "center", fontStyle: "bold" } },
        { content: "CREDIT", colSpan: 9, styles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], halign: "center", fontStyle: "bold" } },
      ],
      [
        "Date", "Invoice No", "Particular", "Remarks", "Gold", "Diamond", "Stone", "Other", "Amount",
        "Date", "Invoice No", "Particular", "Remarks", "Gold", "Diamond", "Stone", "Other", "Amount",
      ],
    ],
    body,
    foot: [
      [
        "Debit Total", "", "", "",
        debitTotals.gold.toFixed(3),
        debitTotals.diamond.toFixed(3),
        debitTotals.stone.toFixed(3),
        debitTotals.otherMetals.toFixed(3),
        debitTotals.amount.toFixed(2),
        "Credit Total", "", "", "",
        creditTotals.gold.toFixed(3),
        creditTotals.diamond.toFixed(3),
        creditTotals.stone.toFixed(3),
        creditTotals.otherMetals.toFixed(3),
        creditTotals.amount.toFixed(2),
      ],
    ],
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: 1, halign: "center" },
    headStyles: { fontSize: 6.5 },
    footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontSize: 6.5, fontStyle: "bold" },
    columnStyles: {
      0: { halign: "left" }, 1: { halign: "left" }, 2: { halign: "left" }, 3: { halign: "left" },
      9: { halign: "left" }, 10: { halign: "left" }, 11: { halign: "left" }, 12: { halign: "left" },
    },
  });

  // Balance Summary Table
  const nextY = (doc as any).lastAutoTable.finalY + 8;
  const balanceRows = [
    ["Gold (gm)", (debitTotals.gold - creditTotals.gold).toFixed(3)],
    ["Diamond (ct)", (debitTotals.diamond - creditTotals.diamond).toFixed(3)],
    ["Stone (ct)", (debitTotals.stone - creditTotals.stone).toFixed(3)],
    ["Other Metals (gm)", (debitTotals.otherMetals - creditTotals.otherMetals).toFixed(3)],
    ["Total Amount (INR)", (debitTotals.amount - creditTotals.amount).toFixed(2)],
  ];

  autoTable(doc, {
    startY: nextY,
    head: [["Balance Summary (Dr - Cr)", "Value"]],
    body: balanceRows,
    theme: "grid",
    headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    styles: { fontSize: 7, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: "bold" },
      1: { cellWidth: 40, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const val = parseFloat(data.cell.text[0]);
        if (val > 0) {
          data.cell.styles.textColor = [180, 83, 9]; // Amber for Dr
        } else if (val < 0) {
          data.cell.styles.textColor = [220, 38, 38]; // Red for Cr
        }
      }
    },
  });

  return doc;
}

// 2. Supplier Ledger PDF Generator
export function generateSupplierLedgerPdf({
  debitEntries,
  creditEntries,
  debitTotals,
  creditTotals,
  supplierName,
  dateRange,
}: {
  debitEntries: any[];
  creditEntries: any[];
  debitTotals: { gold: number; diamond: number; stone: number; otherMetals: number; amount: number };
  creditTotals: { gold: number; diamond: number; stone: number; otherMetals: number; amount: number };
  supplierName: string;
  dateRange: string;
}): jsPDF {
  const doc = new jsPDF({ orientation: "landscape" });

  // Company Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(31, 41, 55);
  doc.text("AMARI JEWELS", 148, 15, { align: "center" });

  // Report Title
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(75, 85, 99);
  doc.text("Supplier Ledger Report", 148, 21, { align: "center" });

  // Line separator
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.5);
  doc.line(14, 24, 283, 24);

  // Metadata Left
  doc.setFontSize(9);
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.text("Supplier:", 14, 30);
  doc.setFont("helvetica", "normal");
  doc.text(supplierName, 32, 30);

  doc.setFont("helvetica", "bold");
  doc.text("Date Range:", 14, 35);
  doc.setFont("helvetica", "normal");
  doc.text(dateRange, 34, 35);

  // Metadata Right
  const generatedAt = new Date().toLocaleString("en-IN", { hour12: true });
  doc.setFont("helvetica", "bold");
  doc.text("Generated At:", 200, 30);
  doc.setFont("helvetica", "normal");
  doc.text(generatedAt, 222, 30);

  // Generate Table Data
  const body: any[] = [];
  const maxRows = Math.max(debitEntries.length, creditEntries.length);

  for (let idx = 0; idx < maxRows; idx++) {
    const dr = debitEntries[idx];
    const cr = creditEntries[idx];
    body.push([
      // Debit
      dr ? dr.date : "",
      dr ? dr.invoice_no : "",
      dr ? dr.particular : "",
      dr ? dr.remarks : "",
      dr ? fmtNum(dr.gold_gm) : "",
      dr ? fmtNum(dr.diamond_carat) : "",
      dr ? fmtNum(dr.stone_carat) : "",
      dr ? fmtNum(dr.other_metals_gm) : "",
      dr ? fmtAmt(dr.total_amount) : "",
      // Credit
      cr ? cr.date : "",
      cr ? cr.invoice_no : "",
      cr ? cr.particular : "",
      cr ? cr.remarks : "",
      cr ? fmtNum(cr.gold_gm) : "",
      cr ? fmtNum(cr.diamond_carat) : "",
      cr ? fmtNum(cr.stone_carat) : "",
      cr ? fmtNum(cr.other_metals_gm) : "",
      cr ? fmtAmt(cr.total_amount) : "",
    ]);
  }

  // Draw autoTable
  autoTable(doc, {
    startY: 42,
    head: [
      [
        { content: "DEBIT", colSpan: 9, styles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], halign: "center", fontStyle: "bold" } },
        { content: "CREDIT", colSpan: 9, styles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], halign: "center", fontStyle: "bold" } },
      ],
      [
        "Date", "Invoice No", "Particular", "Remarks", "Gold", "Diamond", "Stone", "Other", "Amount",
        "Date", "Invoice No", "Particular", "Remarks", "Gold", "Diamond", "Stone", "Other", "Amount",
      ],
    ],
    body,
    foot: [
      [
        "Debit Total", "", "", "",
        debitTotals.gold.toFixed(3),
        debitTotals.diamond.toFixed(3),
        debitTotals.stone.toFixed(3),
        debitTotals.otherMetals.toFixed(3),
        debitTotals.amount.toFixed(2),
        "Credit Total", "", "", "",
        creditTotals.gold.toFixed(3),
        creditTotals.diamond.toFixed(3),
        creditTotals.stone.toFixed(3),
        creditTotals.otherMetals.toFixed(3),
        creditTotals.amount.toFixed(2),
      ],
    ],
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: 1, halign: "center" },
    headStyles: { fontSize: 6.5 },
    footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontSize: 6.5, fontStyle: "bold" },
    columnStyles: {
      0: { halign: "left" }, 1: { halign: "left" }, 2: { halign: "left" }, 3: { halign: "left" },
      9: { halign: "left" }, 10: { halign: "left" }, 11: { halign: "left" }, 12: { halign: "left" },
    },
  });

  // Balance Summary Table
  const nextY = (doc as any).lastAutoTable.finalY + 8;
  const balanceRows = [
    ["Gold (gm)", (debitTotals.gold - creditTotals.gold).toFixed(3)],
    ["Diamond (ct)", (debitTotals.diamond - creditTotals.diamond).toFixed(3)],
    ["Stone (ct)", (debitTotals.stone - creditTotals.stone).toFixed(3)],
    ["Other Metals (gm)", (debitTotals.otherMetals - creditTotals.otherMetals).toFixed(3)],
    ["Total Amount (INR)", (debitTotals.amount - creditTotals.amount).toFixed(2)],
  ];

  autoTable(doc, {
    startY: nextY,
    head: [["Balance Summary (Dr - Cr)", "Value"]],
    body: balanceRows,
    theme: "grid",
    headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    styles: { fontSize: 7, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: "bold" },
      1: { cellWidth: 40, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const val = parseFloat(data.cell.text[0]);
        if (val > 0) {
          data.cell.styles.textColor = [180, 83, 9]; // Amber
        } else if (val < 0) {
          data.cell.styles.textColor = [220, 38, 38]; // Red
        }
      }
    },
  });

  return doc;
}

// 3. Customer Balance PDF Generator
export function generateCustomerBalancePdf({
  balances,
  grandNet,
}: {
  balances: any[];
  grandNet: { gold: number; diamond: number; stone: number; otherMetals: number; amount: number };
}): jsPDF {
  const doc = new jsPDF({ orientation: "landscape" });

  // Company Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(31, 41, 55);
  doc.text("AMARI JEWELS", 148, 15, { align: "center" });

  // Report Title
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(75, 85, 99);
  doc.text("Customer Balance Report", 148, 21, { align: "center" });

  // Line separator
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.5);
  doc.line(14, 24, 283, 24);

  // Metadata Right
  const generatedAt = new Date().toLocaleString("en-IN", { hour12: true });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(31, 41, 55);
  doc.text("Generated At:", 200, 30);
  doc.setFont("helvetica", "normal");
  doc.text(generatedAt, 222, 30);

  // Generate Table Data
  const body = balances.map((b) => [
    b.code,
    b.name,
    b.mobile || "—",
    // Debit
    getSideVal(b.net.gold, "dr", 3),
    getSideVal(b.net.diamond, "dr", 3),
    getSideVal(b.net.stone, "dr", 3),
    getSideVal(b.net.otherMetals, "dr", 3),
    getSideVal(b.net.amount, "dr", 2),
    // Credit
    getSideVal(b.net.gold, "cr", 3),
    getSideVal(b.net.diamond, "cr", 3),
    getSideVal(b.net.stone, "cr", 3),
    getSideVal(b.net.otherMetals, "cr", 3),
    getSideVal(b.net.amount, "cr", 2),
  ]);

  // Draw autoTable
  autoTable(doc, {
    startY: 38,
    head: [
      [
        { content: "Customer Info", colSpan: 3, styles: { fillColor: [75, 85, 99], textColor: [255, 255, 255], halign: "center", fontStyle: "bold" } },
        { content: "DEBIT BALANCES", colSpan: 5, styles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], halign: "center", fontStyle: "bold" } },
        { content: "CREDIT BALANCES", colSpan: 5, styles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], halign: "center", fontStyle: "bold" } },
      ],
      [
        "Code", "Name", "Mobile",
        "Gold", "Diamond", "Stone", "Other", "Amount",
        "Gold", "Diamond", "Stone", "Other", "Amount",
      ],
    ],
    body,
    foot: [
      [
        "Grand Total", "", "",
        getSideVal(grandNet.gold, "dr", 3),
        getSideVal(grandNet.diamond, "dr", 3),
        getSideVal(grandNet.stone, "dr", 3),
        getSideVal(grandNet.otherMetals, "dr", 3),
        getSideVal(grandNet.amount, "dr", 2),
        getSideVal(grandNet.gold, "cr", 3),
        getSideVal(grandNet.diamond, "cr", 3),
        getSideVal(grandNet.stone, "cr", 3),
        getSideVal(grandNet.otherMetals, "cr", 3),
        getSideVal(grandNet.amount, "cr", 2),
      ],
    ],
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.5, halign: "center" },
    headStyles: { fontSize: 7 },
    footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontSize: 7, fontStyle: "bold" },
    columnStyles: {
      0: { halign: "left" }, 1: { halign: "left" }, 2: { halign: "left" },
    },
  });

  return doc;
}
