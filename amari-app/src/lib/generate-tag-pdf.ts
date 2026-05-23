import jsPDF from "jspdf";

export type TagStockItem = {
  design_no?: string;
  tag_no: string;
  gross_weight: string;
  net_weight: string;
  metal_quality: string;
  diamond_weight?: string;
  diamond_pieces?: number;
  diamond_color?: string;
  diamond_quality?: string;
  stone_weight?: string; // CS Weight
};

// Draws the details inside the tag rectangles
function drawTagContent(doc: jsPDF, x: number, y: number, item: TagStockItem) {
  const lineSpacing = 2.5; // mm
  const startY = y + 3.9; // mm (vertically centered inside 13.7 mm tag height: padding = (13.7 - (3 * 2.5 + 1.6)) / 2 = 2.3 mm)
  const fontSize = 5.0;

  // GW & NW format
  const gwText = item.gross_weight ? `GW ${item.gross_weight}` : "GW -";
  const nwText = item.net_weight ? `NW ${item.net_weight}` : "NW -";

  // DW format
  let dwText = "DW -";
  if (item.diamond_weight) {
    dwText = `DW ${item.diamond_weight}`;
    if (item.diamond_pieces && item.diamond_pieces > 0) {
      dwText += `/${item.diamond_pieces}`;
    }
  }

  // CW format
  const cwText = item.stone_weight ? `CW ${item.stone_weight}` : "CW -";

  // Diamond Color & Quality format
  const dqParts = [item.diamond_color, item.diamond_quality].filter(Boolean);
  const dqText = dqParts.length > 0 ? dqParts.join("/") : "-";

  // We have Side A (starting at x, from x to x + 24mm)
  // And Side B (starting at x + 26mm, from x + 26mm to x + 50mm)
  // Both sides contain both columns side-by-side:
  // - Column 1: Design No, GW, NW, Metal Quality (starts at x_start + 1.0)
  // - Column 2: Tag No, DW, CW, Color/Quality (starts at x_start + 12.0)

  // Set font family and style to bold once
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);

  // --- Side A (Left Side of Tag) ---
  const sideAX = x;
  // Side A - Column 1
  doc.text(item.design_no || "-", sideAX + 1.0, startY);
  doc.text(gwText, sideAX + 1.0, startY + lineSpacing);
  doc.text(nwText, sideAX + 1.0, startY + lineSpacing * 2);
  doc.text(item.metal_quality || "-", sideAX + 1.0, startY + lineSpacing * 3);

  // Side A - Column 2
  doc.text(item.tag_no || "-", sideAX + 12.0, startY);
  doc.text(dwText, sideAX + 12.0, startY + lineSpacing);
  doc.text(cwText, sideAX + 12.0, startY + lineSpacing * 2);
  doc.text(dqText, sideAX + 12.0, startY + lineSpacing * 3);

  // --- Side B (Right Side of Tag) ---
  const sideBX = x + 26;
  // Side B - Column 1
  doc.text(item.design_no || "-", sideBX + 1.0, startY);
  doc.text(gwText, sideBX + 1.0, startY + lineSpacing);
  doc.text(nwText, sideBX + 1.0, startY + lineSpacing * 2);
  doc.text(item.metal_quality || "-", sideBX + 1.0, startY + lineSpacing * 3);

  // Side B - Column 2
  doc.text(item.tag_no || "-", sideBX + 12.0, startY);
  doc.text(dwText, sideBX + 12.0, startY + lineSpacing);
  doc.text(cwText, sideBX + 12.0, startY + lineSpacing * 2);
  doc.text(dqText, sideBX + 12.0, startY + lineSpacing * 3);
}

export function generateTagPdf(items: TagStockItem[], startPosition: number = 1): jsPDF {
  // Custom page width of 110 mm (11 cm) x height 299 mm (29.9 cm)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [110, 299]
  });

  const colX = 5; // Starts at left margin: 5mm (0.5 cm)
  const rowHeight = 16.2; // 13.70 mm tag height + 2.50 mm vertical gap
  const topMargin = 5; // 0.5 cm
  const maxSlots = 18; // Fits up to 18 rows with exactly 5mm top and bottom margins (5 + 17 * 16.2 + 13.7 + 5 = 299.1 mm)

  // startPosition is 1-indexed, so currentSlot starts at startPosition - 1
  let currentSlot = Math.max(0, Math.min(maxSlots - 1, startPosition - 1));

  items.forEach((item, index) => {
    if (index > 0 && currentSlot === 0) {
      doc.addPage([110, 299], "portrait");
    }

    const y = topMargin + currentSlot * rowHeight;

    drawTagContent(doc, colX, y, item);

    currentSlot = (currentSlot + 1) % maxSlots;
  });

  return doc;
}
