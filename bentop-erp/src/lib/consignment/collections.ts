type MoneyLike = number | string | { toString(): string };

export type CollectionAgingBucket =
  | "NOT_DUE"
  | "OVERDUE_1_7"
  | "OVERDUE_8_30"
  | "OVERDUE_31_60"
  | "OVERDUE_60_PLUS"
  | "PAID";

export type CollectionStatus =
  | "NOT_FOLLOWED_UP"
  | "CONTACTED"
  | "PROMISED_PAYMENT"
  | "DISPUTED"
  | "ESCALATED";

type CollectionInvoiceInput = {
  id: string;
  invoiceNumber: string;
  dueDate: Date | null;
  netAmount: MoneyLike;
  payments: Array<{ amount: MoneyLike }>;
  collectionStatus: CollectionStatus;
  followUps: Array<{
    note: string;
    nextFollowUpDate: Date | null;
    createdAt: Date;
  }>;
};

export function getCollectionAgingBucket(
  dueDate: Date | null,
  outstandingAmount: number,
  now = new Date(),
): CollectionAgingBucket {
  if (outstandingAmount <= 0) {
    return "PAID";
  }

  if (!dueDate) {
    return "NOT_DUE";
  }

  const overdueDays = daysBetween(startOfDay(dueDate), startOfDay(now));
  if (overdueDays <= 0) return "NOT_DUE";
  if (overdueDays <= 7) return "OVERDUE_1_7";
  if (overdueDays <= 30) return "OVERDUE_8_30";
  if (overdueDays <= 60) return "OVERDUE_31_60";
  return "OVERDUE_60_PLUS";
}

export function summarizeCollectionInvoice(invoice: CollectionInvoiceInput, now = new Date()) {
  const paidAmount = roundMoney(invoice.payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0));
  const netAmount = toNumber(invoice.netAmount);
  const outstandingAmount = roundMoney(Math.max(0, netAmount - paidAmount));
  const latestFollowUp = invoice.followUps
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    netAmount,
    paidAmount,
    outstandingAmount,
    agingBucket: getCollectionAgingBucket(invoice.dueDate, outstandingAmount, now),
    collectionStatus: invoice.collectionStatus,
    lastFollowUpNote: latestFollowUp?.note ?? null,
    nextFollowUpDate: latestFollowUp?.nextFollowUpDate ?? null,
  };
}

export function agingBucketLabel(bucket: CollectionAgingBucket) {
  const labels: Record<CollectionAgingBucket, string> = {
    NOT_DUE: "Not due",
    OVERDUE_1_7: "1-7 days",
    OVERDUE_8_30: "8-30 days",
    OVERDUE_31_60: "31-60 days",
    OVERDUE_60_PLUS: "60+ days",
    PAID: "Paid",
  };
  return labels[bucket];
}

export function collectionStatusLabel(status: CollectionStatus) {
  const labels: Record<CollectionStatus, string> = {
    NOT_FOLLOWED_UP: "Not followed up",
    CONTACTED: "Contacted",
    PROMISED_PAYMENT: "Promised payment",
    DISPUTED: "Disputed",
    ESCALATED: "Escalated",
  };
  return labels[status];
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toNumber(value: MoneyLike) {
  return Number(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
