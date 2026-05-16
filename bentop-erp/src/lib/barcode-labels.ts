import bwipjs from "bwip-js";
import { PDFDocument, type PDFFont, type PDFPage, type RGB, StandardFonts, rgb } from "pdf-lib";

const CM_TO_PT = 28.3464566929;

export const BARCODE_LABEL_WIDTH_PT = 3.5 * CM_TO_PT;
export const BARCODE_LABEL_HEIGHT_PT = 2.5 * CM_TO_PT;

export type BarcodeLabelInput = {
  articleNo: string;
  size: string;
  colour: string;
  barcode: string | null;
  copies?: number;
};

export function assertLabelsHaveBarcodes(labels: BarcodeLabelInput[]) {
  return labels
    .filter((label) => !label.barcode?.trim())
    .map((label) => label.articleNo);
}

export async function buildBarcodeLabelPdf(labels: BarcodeLabelInput[]) {
  const missingBarcodes = assertLabelsHaveBarcodes(labels);
  if (missingBarcodes.length > 0) {
    throw new Error(`Missing barcode for: ${missingBarcodes.join(", ")}`);
  }

  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdf.embedFont(StandardFonts.TimesRomanBold);

  for (const label of labels) {
    const copies = normalizeCopies(label.copies);
    for (let copy = 0; copy < copies; copy += 1) {
      const page = pdf.addPage([BARCODE_LABEL_WIDTH_PT, BARCODE_LABEL_HEIGHT_PT]);
      const barcodePng = await bwipjs.toBuffer({
        bcid: "code128",
        text: label.barcode!.trim(),
        scale: 3,
        height: 8,
        includetext: false,
        paddingwidth: 0,
        paddingheight: 0,
      });
      const barcodeImage = await pdf.embedPng(barcodePng);

      const marginX = 5;
      const black = rgb(0.05, 0.05, 0.05);
      const muted = rgb(0.25, 0.25, 0.25);

      page.drawText("Bentop Collection", {
        x: marginX,
        y: BARCODE_LABEL_HEIGHT_PT - 14,
        size: 14,
        font: boldFont,
        color: black,
      });

      drawLabelText(page, `Article No: ${label.articleNo}`, marginX, 43, regularFont, black);
      drawLabelText(page, `Size: ${label.size}`, marginX, 31, regularFont, black);
      drawLabelText(page, `Colour: ${label.colour}`, marginX, 19, regularFont, black);

      const imageWidth = BARCODE_LABEL_WIDTH_PT - marginX * 2;
      const imageHeight = 9;
      page.drawImage(barcodeImage, {
        x: marginX,
        y: 6,
        width: imageWidth,
        height: imageHeight,
      });

      drawCenteredText(page, label.barcode!.trim(), 1.5, 4, regularFont, muted);
    }
  }

  return pdf.save();
}

function normalizeCopies(copies: number | undefined) {
  if (!Number.isFinite(copies)) return 1;
  return Math.min(500, Math.max(1, Math.floor(copies ?? 1)));
}

function drawLabelText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  color: RGB
) {
  page.drawText(truncateForLabel(text, 34), {
    x,
    y,
    size: 12,
    font,
    color,
  });
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  y: number,
  size: number,
  font: PDFFont,
  color: RGB
) {
  const safeText = truncateForLabel(text, 38);
  const textWidth = font.widthOfTextAtSize(safeText, size);
  page.drawText(safeText, {
    x: Math.max(3, (BARCODE_LABEL_WIDTH_PT - textWidth) / 2),
    y,
    size,
    font,
    color,
  });
}

function truncateForLabel(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}
