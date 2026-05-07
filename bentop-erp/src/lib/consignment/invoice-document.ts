type MoneyLike = number | string | { toString(): string };

type InvoiceDocumentInput = {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date | null;
  billToName: string;
  billToContact: string | null;
  billToEmail: string | null;
  billToPhone: string | null;
  billToAddress: unknown;
  grossAmount: MoneyLike;
  commissionAmount: MoneyLike;
  netAmount: MoneyLike;
  status: string;
  report: {
    reportNumber: string;
    periodStart: Date;
    periodEnd: Date;
  };
  shipment: {
    shipmentNumber: string;
  };
  lines: Array<{
    id: string;
    sku: string;
    productName: string;
    color: string;
    size: string;
    quantitySold: number;
    actualUnitPrice: MoneyLike;
    grossAmount: MoneyLike;
    commissionTierName: string;
    commissionRate: MoneyLike;
    commissionAmount: MoneyLike;
    netAmount: MoneyLike;
  }>;
  payments: Array<{
    amount: MoneyLike;
  }>;
};

export type ConsignmentInvoiceDocument = ReturnType<typeof buildConsignmentInvoiceDocument>;

export function buildConsignmentInvoiceDocument(invoice: InvoiceDocumentInput) {
  const paidAmount = roundMoney(invoice.payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0));
  const netAmount = toNumber(invoice.netAmount);

  return {
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    billToName: invoice.billToName,
    billToLines: buildBillToLines(invoice),
    reportNumber: invoice.report.reportNumber,
    reportPeriodLabel: `${formatDocumentDate(invoice.report.periodStart)} to ${formatDocumentDate(invoice.report.periodEnd)}`,
    shipmentNumber: invoice.shipment.shipmentNumber,
    grossAmount: toNumber(invoice.grossAmount),
    commissionAmount: toNumber(invoice.commissionAmount),
    netAmount,
    paidAmount,
    outstandingAmount: roundMoney(Math.max(0, netAmount - paidAmount)),
    totalUnits: invoice.lines.reduce((sum, line) => sum + line.quantitySold, 0),
    lines: invoice.lines.map((line) => ({
      id: line.id,
      sku: line.sku,
      productName: line.productName,
      color: line.color,
      size: line.size,
      quantitySold: line.quantitySold,
      actualUnitPrice: toNumber(line.actualUnitPrice),
      grossAmount: toNumber(line.grossAmount),
      commissionTierName: line.commissionTierName,
      commissionRate: toNumber(line.commissionRate),
      commissionAmount: toNumber(line.commissionAmount),
      netAmount: toNumber(line.netAmount),
    })),
  };
}

export function formatDocumentDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function buildBillToLines(invoice: InvoiceDocumentInput) {
  return [
    invoice.billToName,
    invoice.billToContact,
    invoice.billToEmail,
    invoice.billToPhone,
    formatAddress(invoice.billToAddress),
  ].filter((line): line is string => typeof line === "string" && line.trim().length > 0);
}

function formatAddress(address: unknown) {
  if (!address || typeof address !== "object" || Array.isArray(address)) {
    return "";
  }

  const data = address as Record<string, unknown>;
  return ["street", "city", "state", "postalCode", "country"]
    .map((key) => data[key])
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(", ");
}

function toNumber(value: MoneyLike) {
  return Number(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
