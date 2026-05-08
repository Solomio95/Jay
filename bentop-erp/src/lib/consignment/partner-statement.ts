type MoneyLike = number | string | { toString(): string };

type PartnerStatementInvoice = {
  status: string;
  invoiceDate: Date;
  dueDate: Date | null;
  grossAmount: MoneyLike;
  commissionAmount: MoneyLike;
  netAmount: MoneyLike;
  payments: Array<{ amount: MoneyLike }>;
};

export function buildPartnerStatementSummary(invoices: PartnerStatementInvoice[], now = new Date()) {
  const activeInvoices = invoices.filter((invoice) => invoice.status !== "VOID");
  const today = startOfDay(now);

  return activeInvoices.reduce(
    (summary, invoice) => {
      const paidAmount = invoice.payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
      const netAmount = toNumber(invoice.netAmount);
      const outstandingAmount = Math.max(0, netAmount - paidAmount);
      const isOverdue =
        outstandingAmount > 0 &&
        invoice.dueDate !== null &&
        startOfDay(invoice.dueDate).getTime() < today.getTime();

      return {
        invoiceCount: summary.invoiceCount + 1,
        overdueCount: summary.overdueCount + (isOverdue ? 1 : 0),
        grossAmount: roundMoney(summary.grossAmount + toNumber(invoice.grossAmount)),
        commissionAmount: roundMoney(summary.commissionAmount + toNumber(invoice.commissionAmount)),
        netAmount: roundMoney(summary.netAmount + netAmount),
        paidAmount: roundMoney(summary.paidAmount + paidAmount),
        outstandingAmount: roundMoney(summary.outstandingAmount + outstandingAmount),
        lastInvoiceDate:
          summary.lastInvoiceDate === null || invoice.invoiceDate > summary.lastInvoiceDate
            ? invoice.invoiceDate
            : summary.lastInvoiceDate,
      };
    },
    {
      invoiceCount: 0,
      overdueCount: 0,
      grossAmount: 0,
      commissionAmount: 0,
      netAmount: 0,
      paidAmount: 0,
      outstandingAmount: 0,
      lastInvoiceDate: null as Date | null,
    },
  );
}

export function calculateInvoicePaidAmount(invoice: { payments: Array<{ amount: MoneyLike }> }) {
  return roundMoney(invoice.payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0));
}

export function calculateInvoiceOutstandingAmount(invoice: { netAmount: MoneyLike; payments: Array<{ amount: MoneyLike }> }) {
  return roundMoney(Math.max(0, toNumber(invoice.netAmount) - calculateInvoicePaidAmount(invoice)));
}

function toNumber(value: MoneyLike) {
  return Number(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
