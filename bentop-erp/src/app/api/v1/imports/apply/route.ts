import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { parseCsv } from "@/lib/csv/csv";
import { generateBatchNumber } from "@/lib/utils";
import {
  emptyImportApplySummary,
  requireImportConfirmation,
  slugFromImportName,
  toImportInteger,
  toImportNumber,
} from "@/lib/imports/apply";
import { validateImportRows, type ImportType } from "@/lib/imports/validation";
import { canManageImports, forbiddenResponse } from "@/lib/permissions";

const allowedTypes = ["product-variants", "locations", "consignment-partners", "opening-stock"] as const;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const role = (session.user as unknown as { role: string }).role;
    if (!canManageImports(role)) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const type = String(body.type ?? "");
    const csv = String(body.csv ?? "");
    const dryRun = body.dryRun !== false;

    if (!allowedTypes.includes(type as ImportType)) {
      return Response.json({ error: { code: "VALIDATION_ERROR", message: "Unknown import type" } }, { status: 400 });
    }

    requireImportConfirmation(dryRun, body.confirm);

    const rows = parseCsv(csv);
    const validation = validateImportRows(type as ImportType, rows);
    if (dryRun || validation.invalidRows > 0) {
      return Response.json({ data: { dryRun: true, validation } });
    }

    const summary = await prisma.$transaction(async (tx) => {
      if (type === "locations") return importLocations(tx, rows, session.user.id);
      if (type === "consignment-partners") return importConsignmentPartners(tx, rows, session.user.id);
      if (type === "product-variants") return importProductVariants(tx, rows, session.user.id);
      return importOpeningStock(tx, rows, session.user.id);
    });

    return Response.json({ data: { dryRun: false, validation, summary } });
  } catch (error) {
    return handleApiError(error);
  }
}

async function importLocations(
  tx: Prisma.TransactionClient,
  rows: Record<string, string>[],
  userId: string,
) {
  const summary = emptyImportApplySummary();
  for (const row of rows) {
    const existing = await tx.location.findFirst({ where: { name: row.name } });
    const data = {
      name: row.name,
      type: row.type as "WAREHOUSE" | "RETAIL_STORE" | "CONSIGNMENT",
      address: row.address || null,
      contactPerson: row.contactPerson || null,
      contactPhone: row.contactPhone || null,
      isActive: true,
    };

    const location = existing
      ? await tx.location.update({ where: { id: existing.id }, data })
      : await tx.location.create({ data });
    if (existing) {
      summary.updated += 1;
    } else {
      summary.created += 1;
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: existing ? "IMPORT_UPDATE" : "IMPORT_CREATE",
        entityType: "Location",
        entityId: location.id,
        newValue: { name: location.name, type: location.type },
      },
    });
  }
  return summary;
}

async function importConsignmentPartners(
  tx: Prisma.TransactionClient,
  rows: Record<string, string>[],
  userId: string,
) {
  const summary = emptyImportApplySummary();
  for (const row of rows) {
    const location = row.locationName
      ? await tx.location.findFirst({ where: { name: row.locationName, isActive: true } })
      : null;
    const existing = await tx.consignmentPartner.findFirst({ where: { name: row.name } });
    const data = {
      name: row.name,
      locationId: location?.id ?? null,
      contactPerson: row.contactPerson || null,
      contactPhone: row.contactPhone || null,
      contactEmail: row.contactEmail || null,
      paymentTermsDays: row.paymentTermsDays ? toImportInteger(row.paymentTermsDays, "paymentTermsDays") : null,
      defaultCommissionRate: toImportNumber(row.defaultCommissionRate, "defaultCommissionRate"),
      isActive: true,
    };

    const partner = existing
      ? await tx.consignmentPartner.update({ where: { id: existing.id }, data })
      : await tx.consignmentPartner.create({ data });
    if (existing) {
      summary.updated += 1;
    } else {
      summary.created += 1;
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: existing ? "IMPORT_UPDATE" : "IMPORT_CREATE",
        entityType: "ConsignmentPartner",
        entityId: partner.id,
        newValue: { name: partner.name, locationId: partner.locationId },
      },
    });
  }
  return summary;
}

async function importProductVariants(
  tx: Prisma.TransactionClient,
  rows: Record<string, string>[],
  userId: string,
) {
  const summary = emptyImportApplySummary();
  for (const row of rows) {
    const categorySlug = slugFromImportName(row.categoryName);
    const category = await tx.category.upsert({
      where: { slug: categorySlug },
      update: { name: row.categoryName, isActive: true },
      create: { name: row.categoryName, slug: categorySlug, isActive: true },
    });

    const productSlug = slugFromImportName(row.productName);
    const existingProduct =
      (await tx.product.findFirst({ where: { skuPrefix: row.skuPrefix } })) ??
      (await tx.product.findUnique({ where: { slug: productSlug } }));

    const product = existingProduct
      ? await tx.product.update({
          where: { id: existingProduct.id },
          data: {
            name: row.productName,
            skuPrefix: row.skuPrefix,
            categoryId: category.id,
            baseCostMyr: toImportNumber(row.baseCostMyr, "baseCostMyr"),
            isActive: true,
          },
        })
      : await tx.product.create({
          data: {
            name: row.productName,
            slug: productSlug,
            skuPrefix: row.skuPrefix,
            categoryId: category.id,
            brand: "Bentop Collection",
            baseCostMyr: toImportNumber(row.baseCostMyr, "baseCostMyr"),
            isActive: true,
          },
        });

    const existingVariant = await tx.productVariant.findUnique({ where: { sku: row.sku } });
    const variantData = {
      productId: product.id,
      sku: row.sku,
      size: row.size,
      color: row.color,
      barcode: row.barcode || null,
      sellingPriceMyr: toImportNumber(row.sellingPriceMyr, "sellingPriceMyr"),
      isActive: true,
    };

    const variant = existingVariant
      ? await tx.productVariant.update({ where: { id: existingVariant.id }, data: variantData })
      : await tx.productVariant.create({ data: variantData });
    if (existingVariant) {
      summary.updated += 1;
    } else {
      summary.created += 1;
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: existingVariant ? "IMPORT_UPDATE" : "IMPORT_CREATE",
        entityType: "ProductVariant",
        entityId: variant.id,
        newValue: { sku: variant.sku, productId: product.id },
      },
    });
  }
  return summary;
}

async function importOpeningStock(
  tx: Prisma.TransactionClient,
  rows: Record<string, string>[],
  userId: string,
) {
  const summary = emptyImportApplySummary();
  for (const row of rows) {
    const variant = await tx.productVariant.findUnique({ where: { sku: row.sku } });
    const location = await tx.location.findFirst({ where: { name: row.locationName, isActive: true } });
    if (!variant || !location) {
      summary.skipped += 1;
      continue;
    }

    const quantity = toImportInteger(row.quantity, "quantity");
    const batch = await tx.batch.create({
      data: {
        batchNumber: generateBatchNumber(),
        productVariantId: variant.id,
        quantityProduced: quantity,
        productionDate: new Date(),
        supplierName: row.supplierName || "Opening stock import",
        costPerUnitMyr: toImportNumber(row.costPerUnitMyr, "costPerUnitMyr"),
        notes: "Opening stock import",
      },
    });

    await tx.stockMovement.create({
      data: {
        productVariantId: variant.id,
        batchId: batch.id,
        toLocationId: location.id,
        movementType: "INBOUND",
        quantity,
        referenceNumber: "OPENING-STOCK-IMPORT",
        performedById: userId,
        notes: "Opening stock import",
      },
    });

    await tx.stockLevel.create({
      data: {
        productVariantId: variant.id,
        locationId: location.id,
        batchId: batch.id,
        quantityOnHand: quantity,
        binLocation: row.binLocation || null,
      },
    });

    const aggregate = await tx.stockLevel.findFirst({
      where: { productVariantId: variant.id, locationId: location.id, batchId: null },
    });
    if (aggregate) {
      await tx.stockLevel.update({
        where: { id: aggregate.id },
        data: { quantityOnHand: { increment: quantity }, binLocation: row.binLocation || aggregate.binLocation },
      });
    } else {
      await tx.stockLevel.create({
        data: {
          productVariantId: variant.id,
          locationId: location.id,
          batchId: null,
          quantityOnHand: quantity,
          binLocation: row.binLocation || null,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: "IMPORT_CREATE",
        entityType: "OpeningStock",
        entityId: batch.id,
        newValue: { sku: row.sku, locationName: row.locationName, quantity },
      },
    });
    summary.created += 1;
  }
  return summary;
}
