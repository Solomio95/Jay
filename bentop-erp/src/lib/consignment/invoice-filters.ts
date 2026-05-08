import type { ConsignmentInvoiceStatus, Prisma } from "@prisma/client";

const INVOICE_STATUSES = new Set(["DRAFT", "ISSUED", "PARTIAL_PAID", "PAID", "VOID"]);
const DUE_STATES = new Set(["outstanding", "overdue", "paid"]);

export type ConsignmentInvoiceFilters = {
  status?: ConsignmentInvoiceStatus;
  partnerId?: string;
  from?: string;
  to?: string;
  dueState?: "outstanding" | "overdue" | "paid";
  search?: string;
};

export function parseConsignmentInvoiceFilters(
  values: Record<string, string | string[] | null | undefined>,
): ConsignmentInvoiceFilters {
  const status = singleValue(values.status);
  const dueState = singleValue(values.dueState);

  return compactFilters({
    status: status && INVOICE_STATUSES.has(status) ? (status as ConsignmentInvoiceStatus) : undefined,
    partnerId: clean(singleValue(values.partnerId)),
    from: clean(singleValue(values.from)),
    to: clean(singleValue(values.to)),
    dueState: dueState && DUE_STATES.has(dueState) ? (dueState as ConsignmentInvoiceFilters["dueState"]) : undefined,
    search: clean(singleValue(values.search)),
  });
}

export function buildConsignmentInvoiceWhere(
  filters: ConsignmentInvoiceFilters,
  now: Date = new Date(),
): Prisma.ConsignmentInvoiceWhereInput {
  const where: Prisma.ConsignmentInvoiceWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.partnerId) {
    where.partnerId = filters.partnerId;
  }

  if (filters.from || filters.to) {
    where.invoiceDate = {
      ...(filters.from ? { gte: startOfDay(filters.from) } : {}),
      ...(filters.to ? { lte: endOfDay(filters.to) } : {}),
    };
  }

  if (filters.dueState === "paid") {
    where.status = "PAID";
  }

  if (filters.dueState === "outstanding") {
    where.status = { in: ["DRAFT", "ISSUED", "PARTIAL_PAID"] };
  }

  if (filters.dueState === "overdue") {
    where.status = filters.status ?? { in: ["ISSUED", "PARTIAL_PAID"] };
    where.dueDate = { lt: startOfDay(toDateInput(now)) };
  }

  if (filters.search) {
    where.OR = [
      { invoiceNumber: { contains: filters.search, mode: "insensitive" } },
      { billToName: { contains: filters.search, mode: "insensitive" } },
      { partner: { name: { contains: filters.search, mode: "insensitive" } } },
      { shipment: { shipmentNumber: { contains: filters.search, mode: "insensitive" } } },
      { report: { reportNumber: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  return where;
}

export function toInvoiceFilterQuery(filters: ConsignmentInvoiceFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function singleValue(value: string | string[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function compactFilters(filters: ConsignmentInvoiceFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined),
  ) as ConsignmentInvoiceFilters;
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00.000`);
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999`);
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}
