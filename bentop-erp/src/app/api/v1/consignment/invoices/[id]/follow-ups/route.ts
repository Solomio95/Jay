import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { canManageConsignment, forbiddenResponse } from "@/lib/permissions";
import { consignmentCollectionFollowUpCreateSchema } from "@/lib/validators/collections";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const { id } = await params;
    const followUps = await prisma.consignmentCollectionFollowUp.findMany({
      where: { invoiceId: id },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ data: followUps });
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
    if (!canManageConsignment(role)) {
      return forbiddenResponse();
    }

    const parsed = consignmentCollectionFollowUpCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    const { id } = await params;
    const invoice = await prisma.consignmentInvoice.findUnique({
      where: { id },
      select: { id: true, collectionStatus: true, nextFollowUpDate: true },
    });

    if (!invoice) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Invoice not found" } }, { status: 404 });
    }

    const data = parsed.data;
    const nextFollowUpDate = data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : null;
    const result = await prisma.$transaction(async (tx) => {
      const followUp = await tx.consignmentCollectionFollowUp.create({
        data: {
          invoiceId: invoice.id,
          collectionStatus: data.collectionStatus,
          note: data.note,
          nextFollowUpDate,
          createdById: session.user.id,
        },
        include: { createdBy: { select: { id: true, name: true, email: true } } },
      });

      const updatedInvoice = await tx.consignmentInvoice.update({
        where: { id: invoice.id },
        data: {
          collectionStatus: data.collectionStatus,
          nextFollowUpDate,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "RECORD_COLLECTION_FOLLOW_UP",
          entityType: "ConsignmentInvoice",
          entityId: invoice.id,
          oldValue: {
            collectionStatus: invoice.collectionStatus,
            nextFollowUpDate: invoice.nextFollowUpDate,
          },
          newValue: {
            collectionStatus: updatedInvoice.collectionStatus,
            nextFollowUpDate: updatedInvoice.nextFollowUpDate,
            followUpId: followUp.id,
          },
        },
      });

      return { followUp, invoice: updatedInvoice };
    });

    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
