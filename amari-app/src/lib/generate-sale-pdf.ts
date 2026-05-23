import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type SaleItem = {
  stock_id?: string;
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

type SaleData = {
  id?: string;
  invoice_no: string;
  customer_id: string;
  customer_name?: string;
  date: string;
  items: SaleItem[];
};

type CustomerInfo = {
  mobile?: string;
  address?: string;
  city?: string;
};

/**
 * Generate a sales invoice PDF and return it as a jsPDF instance.
 * Caller decides whether to save/download or render it in-browser.
 */
export async function generateSaleInvoicePdf(
  sale: SaleData,
  customer?: CustomerInfo | null
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "landscape" });

  // ── Fetch design images for all items ──
  const designNos = [...new Set(sale.items.map((i) => i.design_no).filter(Boolean))];
  const imageDataMap: Record<string, string> = {};

  if (designNos.length > 0) {
    try {
      const res = await fetch("/api/designs/images-by-design-nos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designNos }),
      });
      if (res.ok) {
        const { images } = (await res.json()) as { images: Record<string, string> };
        await Promise.all(
          Object.entries(images).map(async ([designNo, url]) => {
            try {
              const imgRes = await fetch(url);
              if (!imgRes.ok) return;
              const blob = await imgRes.blob();
              const bmp = await createImageBitmap(blob);
              const canvas = document.createElement("canvas");
              const maxDim = 120;
              const scale = Math.min(maxDim / bmp.width, maxDim / bmp.height, 1);
              canvas.width = Math.round(bmp.width * scale);
              canvas.height = Math.round(bmp.height * scale);
              const ctx = canvas.getContext("2d");
              if (!ctx) return;
              ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
              imageDataMap[designNo] = canvas.toDataURL("image/jpeg", 0.85);
            } catch {
              // Skip this image silently
            }
          })
        );
      }
    } catch {
      // Continue without images if fetch fails
    }
  }

  // ── Header ──
  doc.setFontSize(20);
  doc.text("Sales Invoice", 148, 20, { align: "center" });

  doc.setFontSize(12);
  doc.text(`Invoice No: ${sale.invoice_no || "DRAFT"}`, 14, 30);
  doc.text(`Date: ${sale.date}`, 14, 36);

  doc.text("Customer Details:", 200, 30);
  doc.setFontSize(10);
  doc.text(`Name: ${sale.customer_name || "N/A"}`, 200, 36);
  if (customer) {
    if (customer.mobile) doc.text(`Mobile: ${customer.mobile}`, 200, 42);
    if (customer.address) doc.text(`Address: ${customer.address}`, 200, 48);
    if (customer.city) doc.text(`City: ${customer.city}`, 200, 54);
  }

  // ── Items Table ──
  const hasImages = Object.keys(imageDataMap).length > 0;
  const IMG_CELL_SIZE = 12;

  const tableData = sale.items.map((item) => [
    "",
    item.tag_no,
    item.design_no,
    item.metal_quality,
    item.gross_weight,
    item.net_weight,
    item.pure_weight,
    item.diamond_weight,
    item.diamond_color,
    item.diamond_quality,
    item.diamond_pieces,
    item.diamond_rate,
    (Number(item.diamond_weight || 0) * Number(item.diamond_rate || 0)).toFixed(2),
    item.stone_weight,
    item.cs_rate,
    (Number(item.stone_weight || 0) * Number(item.cs_rate || 0)).toFixed(2),
    item.labour_rate,
    (Number(item.labour_rate || 0) * Number(item.net_weight || 0)).toFixed(2),
    item.ex_charge,
    (
      Number(item.diamond_weight || 0) * Number(item.diamond_rate || 0) +
      Number(item.stone_weight || 0) * Number(item.cs_rate || 0) +
      Number(item.labour_rate || 0) * Number(item.net_weight || 0) +
      Number(item.ex_charge || 0)
    ).toFixed(2),
  ]);

  const totals = sale.items.reduce(
    (acc, item) => {
      acc.gross += Number(item.gross_weight || 0);
      acc.net += Number(item.net_weight || 0);
      acc.pure += Number(item.pure_weight || 0);
      acc.diaWt += Number(item.diamond_weight || 0);
      acc.diaPcs += Number(item.diamond_pieces || 0);
      acc.amount +=
        Number(item.diamond_weight || 0) * Number(item.diamond_rate || 0) +
        Number(item.stone_weight || 0) * Number(item.cs_rate || 0) +
        Number(item.labour_rate || 0) * Number(item.net_weight || 0) +
        Number(item.ex_charge || 0);
      return acc;
    },
    { gross: 0, net: 0, pure: 0, diaWt: 0, diaPcs: 0, amount: 0 }
  );

  autoTable(doc, {
    startY: 65,
    head: [
      [
        "Image", "Tag No", "Design", "Metal", "Gross Wt", "Net Wt", "Pure Gold",
        "Dia Wt", "Color", "Qual", "Pcs", "Dia Rate", "Dia Amt",
        "CS Wt", "CS Rate", "CS Amt", "Lab Rate", "Lab Amt", "Ex Chg", "Total",
      ],
    ],
    body: tableData,
    foot: [
      [
        "", "TOTAL", "", "",
        totals.gross.toFixed(3),
        totals.net.toFixed(3),
        totals.pure.toFixed(3),
        totals.diaWt.toFixed(3),
        "", "",
        totals.diaPcs.toString(),
        "", "", "", "", "", "", "", "",
        totals.amount.toFixed(2),
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [95, 99, 104], fontSize: 7, halign: "center" },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 7, fontStyle: "bold", halign: "center" },
    styles: { fontSize: 7, cellPadding: 1, halign: "center" },
    columnStyles: {
      0: { cellWidth: hasImages ? IMG_CELL_SIZE + 2 : 6, minCellHeight: hasImages ? IMG_CELL_SIZE + 2 : undefined },
    },
    didDrawCell: (data: any) => {
      if (data.section === "body" && data.column.index === 0) {
        const rowIndex = data.row.index;
        const item = sale.items[rowIndex];
        const imgData = item?.design_no ? imageDataMap[item.design_no] : null;
        if (imgData) {
          const padding = 1;
          const imgX = data.cell.x + padding;
          const imgY = data.cell.y + padding;
          const imgW = IMG_CELL_SIZE;
          const imgH = IMG_CELL_SIZE;
          try {
            doc.addImage(imgData, "JPEG", imgX, imgY, imgW, imgH);
          } catch {
            // Skip if image can't be added
          }
        }
      }
    },
  });

  return doc;
}
