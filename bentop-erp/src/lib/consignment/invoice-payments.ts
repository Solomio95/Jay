export type ConsignmentInvoicePaymentStatus = "DRAFT" | "ISSUED" | "PARTIAL_PAID" | "PAID" | "VOID";

export type ConsignmentInvoicePaymentStateInput = {
  netAmount: number;
  paidAmount: number;
  currentStatus: ConsignmentInvoicePaymentStatus;
};

export function summarizeConsignmentInvoicePaymentState({
  netAmount,
  paidAmount,
  currentStatus,
}: ConsignmentInvoicePaymentStateInput) {
  const balanceAmount = Math.max(0, roundMoney(netAmount - paidAmount));

  if (currentStatus === "VOID") {
    return { status: "VOID" as const, balanceAmount, isFullyPaid: false };
  }

  if (paidAmount >= netAmount && netAmount > 0) {
    return { status: "PAID" as const, balanceAmount: 0, isFullyPaid: true };
  }

  if (paidAmount > 0) {
    return { status: "PARTIAL_PAID" as const, balanceAmount, isFullyPaid: false };
  }

  return { status: currentStatus === "DRAFT" ? "DRAFT" as const : "ISSUED" as const, balanceAmount, isFullyPaid: false };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
