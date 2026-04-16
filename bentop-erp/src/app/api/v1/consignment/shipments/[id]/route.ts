import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const shipment = await prisma.consignmentShipment.findUnique({
    where: { id },
    include: {
      fromLocation: true,
      toLocation: true,
      createdBy: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          productVariant: {
            select: {
              id: true,
              sku: true,
              size: true,
              color: true,
              colorHex: true,
              product: { select: { id: true, name: true, skuPrefix: true } },
            },
          },
          batch: { select: { id: true, batchNumber: true, productionDate: true } },
        },
      },
    },
  });

  if (!shipment) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Shipment not found" } }, { status: 404 });
  }

  return Response.json({ data: shipment });
}
