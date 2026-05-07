import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { csvResponse } from "@/lib/csv/response";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const invoices = await prisma.consignmentInvoice.findMany({
      include: {
        partner: true,
        shipment: { select: { shipmentNumber: true } },
        report: { select: { reportNumber: true, periodStart: true, periodEnd: true } },
        payments: { select: { amount: true } },
      },
      orderBy: [{ invoiceDate: "desc" }, { invoiceNumber: "asc" }],
    });

    return csvResponse(
      `bentop-consignment-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
      invoices.map((invoice) => {
        const paidAmount = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        return {
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          partnerName: invoice.partner.name,
          shipmentNumber: invoice.shipment.shipmentNumber,
          reportNumber: invoice.report.reportNumber,
          periodStart: invoice.report.periodStart.toISOString().slice(0, 10),
          periodEnd: invoice.report.periodEnd.toISOString().slice(0, 10),
          invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
          dueDate: invoice.dueDate?.toISOString().slice(0, 10) ?? "",
          grossAmount: Number(invoice.grossAmount).toFixed(2),
          commissionAmount: Number(invoice.commissionAmount).toFixed(2),
          netAmount: Number(invoice.netAmount).toFixed(2),
          paidAmount: paidAmount.toFixed(2),
          outstandingAmount: Math.max(0, Number(invoice.netAmount) - paidAmount).toFixed(2),
        };
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
