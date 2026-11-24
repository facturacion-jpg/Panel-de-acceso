import { jsPDF } from "jspdf";

const createFilename = (name) => {
  const safeName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `${safeName || "reporte-inspeccion"}.pdf`;
};

export function downloadInspectionPdf(reportText, filename) {
  const file = createInspectionPdfFile(reportText, filename);
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createInspectionPdfFile(reportText, filename) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 18;
  const lineHeight = 6;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  reportText.split("\n").forEach((line, index) => {
    const isTitle = index < 2;
    const isSection = line === line.toUpperCase() && line.length > 0;
    pdf.setFont("helvetica", isTitle || isSection ? "bold" : "normal");
    pdf.setFontSize(isTitle ? (index === 0 ? 17 : 13) : 10);

    const wrappedLines = pdf.splitTextToSize(line || " ", maxWidth);
    const height = wrappedLines.length * lineHeight;
    if (y + height > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }

    pdf.text(wrappedLines, margin, y);
    y += height + (line ? 1 : 2);
  });

  return new File([pdf.output("blob")], createFilename(filename), {
    type: "application/pdf"
  });
}
