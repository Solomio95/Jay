import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { buildBarcodeLabelPdf } from "@/lib/barcode-labels";
import { canManageStock, forbiddenResponse } from "@/lib/permissions";

export const runtime = "nodejs";

const barcodeLabelRequestSchema = z.object({
  items: z
    .array(
      z.object({
        productVariantId: z.string().min(1),
        copies: z.number().int().min(1).max(500).default(1),
      })
    )
    .min(1)
    .max(200),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const role = (session.user as unknown as { role?: string }).role;
    if (!canManageStock(role)) {
      return forbiddenResponse("Only inventory staff can generate barcode labels");
    }

    const body = await request.json();
    const parsed = barcodeLabelRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid barcode label request",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const requestedIds = parsed.data.items.map((item) => item.productVariantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: requestedIds }, isActive: true },
    });

    if (variants.length !== new Set(requestedIds).size) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "One or more variants were not found or inactive" } },
        { status: 404 }
      );
    }

    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
    const labels = parsed.data.items.map((item) => {
      const variant = variantsById.get(item.productVariantId)!;
      return {
        articleNo: variant.sku,
        size: variant.size,
        colour: variant.color,
        barcode: variant.barcode,
        copies: item.copies,
      };
    });

    const missingBarcodes = labels.filter((label) => !label.barcode?.trim()).map((label) => label.articleNo);
    if (missingBarcodes.length > 0) {
      return Response.json(
        {
          error: {
            code: "MISSING_BARCODE",
            message: `Add barcodes before printing labels: ${missingBarcodes.join(", ")}`,
          },
        },
        { status: 400 }
      );
    }

    const pdfBytes = await buildBarcodeLabelPdf(labels);
    const date = new Date().toISOString().slice(0, 10);

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="bentop-barcode-labels-${date}.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
