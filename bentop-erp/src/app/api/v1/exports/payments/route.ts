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

    const payments = await prisma.consignmentInvoicePayment.findMany({
      include: {
        invoice: { include: { partner: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    });

    return csvResponse(
      `bentop-consignment-payments-${new Date().toISOString().slice(0, 10)}.csv`,
      payments.map((payment) => ({
        paymentDate: payment.paymentDate.toISOString().slice(0, 10),
        invoiceNumber: payment.invoice.invoiceNumber,
        partnerName: payment.invoice.partner.name,
        amount: Number(payment.amount).toFixed(2),
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.referenceNumber,
        notes: payment.notes,
        recordedBy: payment.createdBy.name || payment.createdBy.email,
      })),
      [
        "paymentDate",
        "invoiceNumber",
        "partnerName",
        "amount",
        "paymentMethod",
        "referenceNumber",
        "notes",
        "recordedBy",
      ]
    );
  } catch (error) {
    return handleApiError(error);
  }
}
