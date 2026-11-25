const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Generic landscape-A4 tabular PDF renderer for dashboard detail exports. Columns are laid
// out as equal-width slots and long values are truncated to fit - this is a plain data dump
// (matching the on-screen/CSV export data), not a formatted document like the loan agreement
// templates in pdfGeneratorService.js.
async function renderTablePdf({ title, columns, rows, formatCell }) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 841.89; // A4 landscape
  const pageHeight = 595.28;
  const margin = 30;
  const rowHeight = 14;
  const fontSize = 7;
  const usableWidth = pageWidth - margin * 2;
  const colWidth = columns.length ? usableWidth / columns.length : usableWidth;

  const truncate = (text, width, f, size) => {
    let str = String(text ?? '');
    while (str.length > 1 && f.widthOfTextAtSize(str, size) > width - 4) {
      str = str.slice(0, -1);
    }
    return str;
  };

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawHeader = () => {
    page.drawText(title, { x: margin, y, size: 12, font: boldFont, color: rgb(0, 0, 0) });
    y -= 18;
    columns.forEach((col, i) => {
      page.drawText(truncate(col.header, colWidth, boldFont, fontSize), {
        x: margin + i * colWidth, y, size: fontSize, font: boldFont, color: rgb(0, 0, 0)
      });
    });
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= rowHeight;
  };

  drawHeader();

  for (const row of rows) {
    if (y < margin + rowHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawHeader();
    }
    columns.forEach((col, i) => {
      const raw = formatCell ? formatCell(col.field, row[col.field]) : row[col.field];
      page.drawText(truncate(raw, colWidth, font, fontSize), {
        x: margin + i * colWidth, y, size: fontSize, font, color: rgb(0, 0, 0)
      });
    });
    y -= rowHeight;
  }

  if (!rows.length) {
    page.drawText('No records found', { x: margin, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = { renderTablePdf };
