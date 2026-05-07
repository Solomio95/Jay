import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { summarizeConsignmentInvoicePaymentState } from "@/lib/consignment/invoice-payments";
import { consignmentInvoicePaymentCreateSchema } from "@/lib/validators/invoice-payments";

function canRecordPayment(role: string) {
  return role === "ADMIN" || role === "MANAGER";
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const { id } = await params;
    const payments = await prisma.consignmentInvoicePayment.findMany({
      where: { invoiceId: id },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    });

    return Response.json({ data: payments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const role = (session.user as unknown as { role: string }).role;
    if (!canRecordPayment(role)) {
      return Response.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
    }

    const parsed = consignmentInvoicePaymentCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { id } = await params;
    const data = parsed.data;
    const invoice = await prisma.consignmentInvoice.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!invoice) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Invoice not found" } }, { status: 404 });
    }
    if (invoice.status === "VOID") {
      return Response.json({ error: { code: "CONFLICT", message: "Voided invoices cannot receive payments" } }, { status: 409 });
    }

    const paidBefore = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const netAmount = Number(invoice.netAmount);
    const balanceBefore = Math.max(0, Math.round((netAmount - paidBefore) * 100) / 100);
    if (data.amount > balanceBefore) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Payment exceeds invoice balance. Remaining balance is MYR ${balanceBefore.toFixed(2)}.`,
          },
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.consignmentInvoicePayment.create({
        data: {
          invoiceId: invoice.id,
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          referenceNumber: data.referenceNumber,
          notes: data.notes,
          createdById: session.user.id,
        },
        include: { createdBy: { select: { id: true, name: true, email: true } } },
      });

      const paidAmount = paidBefore + data.amount;
      const summary = summarizeConsignmentInvoicePaymentState({
        netAmount,
        paidAmount,
        currentStatus: invoice.status,
      });

      const updatedInvoice = await tx.consignmentInvoice.update({
        where: { id: invoice.id },
        data: {
          status: summary.status,
          paidAt: summary.isFullyPaid ? new Date() : null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "RECORD_PAYMENT",
          entityType: "ConsignmentInvoice",
          entityId: invoice.id,
          oldValue: { status: invoice.status, paidAmount: paidBefore },
          newValue: {
            status: updatedInvoice.status,
            paidAmount,
            balanceAmount: summary.balanceAmount,
            paymentId: payment.id,
          },
        },
      });

      return { payment, invoice: updatedInvoice, balanceAmount: summary.balanceAmount };
    });

    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
