import bwipjs from "bwip-js";
import { PDFDocument, type PDFFont, type PDFPage, type RGB, StandardFonts, rgb } from "pdf-lib";

const CM_TO_PT = 28.3464566929;

export const BARCODE_LABEL_WIDTH_PT = 3.5 * CM_TO_PT;
export const BARCODE_LABEL_HEIGHT_PT = 2.5 * CM_TO_PT;

const LABEL_MARGIN_X = 5;
const LABEL_TEXT_WIDTH_PT = BARCODE_LABEL_WIDTH_PT - LABEL_MARGIN_X * 2;
const HEADER_FONT_SIZE = 7.5;
const BODY_FONT_SIZE = 6.2;
const BARCODE_VALUE_FONT_SIZE = 3;

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

      const black = rgb(0.05, 0.05, 0.05);
      const muted = rgb(0.25, 0.25, 0.25);

      page.drawText(fitTextToWidth("Bentop Collection", boldFont, HEADER_FONT_SIZE, LABEL_TEXT_WIDTH_PT), {
        x: LABEL_MARGIN_X,
        y: BARCODE_LABEL_HEIGHT_PT - 10,
        size: HEADER_FONT_SIZE,
        font: boldFont,
        color: black,
      });

      drawLabelText(page, `Article No: ${label.articleNo}`, LABEL_MARGIN_X, 51, regularFont, black);
      drawLabelText(page, `Size: ${label.size}`, LABEL_MARGIN_X, 43, regularFont, black);
      drawLabelText(page, `Colour: ${label.colour}`, LABEL_MARGIN_X, 35, regularFont, black);

      const imageWidth = LABEL_TEXT_WIDTH_PT;
      const imageHeight = 20;
      page.drawImage(barcodeImage, {
        x: LABEL_MARGIN_X,
        y: 10,
        width: imageWidth,
        height: imageHeight,
      });

      drawCenteredText(page, label.barcode!.trim(), 5, BARCODE_VALUE_FONT_SIZE, regularFont, muted);
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
  page.drawText(fitTextToWidth(text, font, BODY_FONT_SIZE, LABEL_TEXT_WIDTH_PT), {
    x,
    y,
    size: BODY_FONT_SIZE,
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
  const safeText = fitTextToWidth(text, font, size, LABEL_TEXT_WIDTH_PT);
  const textWidth = font.widthOfTextAtSize(safeText, size);
  page.drawText(safeText, {
    x: Math.max(3, (BARCODE_LABEL_WIDTH_PT - textWidth) / 2),
    y,
    size,
    font,
    color,
  });
}

function fitTextToWidth(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;

  const suffix = "...";
  let end = text.length - 1;
  while (end > 0) {
    const candidate = `${text.slice(0, end)}${suffix}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) return candidate;
    end -= 1;
  }

  return suffix;
}
