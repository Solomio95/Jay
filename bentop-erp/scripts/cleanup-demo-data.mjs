import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const seedProductPrefixes = [
  "BT-TS-001",
  "BT-TS-002",
  "BT-TS-003",
  "BT-TS-004",
  "BT-PN-001",
  "BT-PN-002",
  "BT-PN-003",
  "BT-PN-004",
  "BT-JK-001",
  "BT-JK-002",
  "BT-JK-003",
  "BT-JK-004",
  "BT-AC-001",
  "BT-AC-002",
  "BT-AC-003",
  "BT-AC-004",
  "BT-DR-001",
  "BT-DR-002",
  "BT-DR-003",
  "BT-DR-004",
];

const seedProductNames = [
  "Classic Crew Tee",
  "V-Neck Essential",
  "Oversized Street Tee",
  "Henley Long Sleeve",
  "Slim Fit Chinos",
  "Relaxed Cargo Pants",
  "Jogger Pants",
  "Denim Straight Cut",
  "Bomber Jacket",
  "Lightweight Windbreaker",
  "Denim Jacket",
  "Hoodie Classic",
  "Canvas Tote Bag",
  "Snapback Cap",
  "Leather Belt",
  "Woven Scarf",
  "Summer Maxi Dress",
  "Wrap Midi Dress",
  "Shirt Dress",
  "Casual Shift Dress",
];

const seedLocationNames = ["Main Warehouse KL", "Retail Store Pavilion", "Consignment Partner XYZ"];
const seedCustomerEmails = [
  "sarah@email.com",
  "purchasing@techstyle.com",
  "orders@fashionhub.com",
  "david.w@email.com",
  "aisha@boutique.com",
  "vendor@metromall.com",
  "meiying@email.com",
  "raj@email.com",
  "buy@trendythreads.com",
  "nurul.i@email.com",
];
const seedChannelNames = [
  "Pavilion Retail Store",
  "Shopee Malaysia",
  "TikTok Shop",
  "Wholesale B2B",
  "Consignment Partners",
];
const seedPromotionNames = ["Consignment Bundle Promo"];
const seedLeaderboardNames = ["Consignment Monthly Leaderboard"];
const seedPartnerNames = ["Billion Group"];
const seedUsers = ["promoter@bentop.com", "supervisor@bentop.com", "viewer@bentop.com"];

async function main() {
  const candidates = await collectCandidates();
  printCandidates(candidates);

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply after taking a DB backup to delete these records.");
    return;
  }

  console.log("\nApplying cleanup...");
  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { email: { in: seedUsers } },
      data: { defaultLocationId: null, isActive: false },
    });

    await tx.userTemporaryLocation.deleteMany({
      where: { user: { email: { in: seedUsers } } },
    });
    try {
      await tx.$executeRawUnsafe(
        `DELETE FROM "_LocationSupervisors" WHERE "A" IN (SELECT id FROM locations WHERE name = ANY($1))`,
        seedLocationNames,
      );
    } catch {
      // Join table name is Prisma-generated; skip if not present in this DB.
    }

    await tx.consignmentInvoicePayment.deleteMany({
      where: { invoice: { partner: { name: { in: seedPartnerNames } } } },
    });
    await tx.consignmentCollectionFollowUp.deleteMany({
      where: { invoice: { partner: { name: { in: seedPartnerNames } } } },
    });
    await tx.consignmentInvoiceLine.deleteMany({
      where: { invoice: { partner: { name: { in: seedPartnerNames } } } },
    });
    await tx.consignmentInvoice.deleteMany({
      where: { partner: { name: { in: seedPartnerNames } } },
    });
    await tx.consignmentReportLine.deleteMany({
      where: { report: { partner: { name: { in: seedPartnerNames } } } },
    });
    await tx.consignmentReport.deleteMany({
      where: { partner: { name: { in: seedPartnerNames } } },
    });
    await tx.consignmentShipmentItem.deleteMany({
      where: { shipment: { partner: { name: { in: seedPartnerNames } } } },
    });
    await tx.consignmentShipment.deleteMany({
      where: { partner: { name: { in: seedPartnerNames } } },
    });
    await tx.consignmentCommissionOverride.deleteMany({
      where: { partner: { name: { in: seedPartnerNames } } },
    });
    await tx.consignmentCommissionTier.deleteMany({
      where: { partner: { name: { in: seedPartnerNames } } },
    });
    await tx.consignmentPartner.deleteMany({
      where: { name: { in: seedPartnerNames } },
    });

    await tx.promoterReturn.deleteMany({
      where: {
        OR: [
          { promoter: { email: { in: seedUsers } } },
          { productVariant: { product: seedProductWhere() } },
        ],
      },
    });

    await tx.orderStatusHistory.deleteMany({
      where: {
        order: {
          OR: [
            { orderNumber: { startsWith: "BT-SO-" } },
            { customer: { email: { in: seedCustomerEmails } } },
            { items: { some: { productVariant: { product: seedProductWhere() } } } },
          ],
        },
      },
    });
    await tx.orderItem.deleteMany({
      where: {
        OR: [
          { order: { orderNumber: { startsWith: "BT-SO-" } } },
          { order: { customer: { email: { in: seedCustomerEmails } } } },
          { productVariant: { product: seedProductWhere() } },
        ],
      },
    });
    await tx.order.deleteMany({
      where: {
        OR: [
          { orderNumber: { startsWith: "BT-SO-" } },
          { customer: { email: { in: seedCustomerEmails } } },
          { items: { none: {} } },
        ],
      },
    });

    await tx.stockTransferItem.deleteMany({
      where: {
        OR: [
          { productVariant: { product: seedProductWhere() } },
          { transfer: { fromLocation: { name: { in: seedLocationNames } } } },
          { transfer: { toLocation: { name: { in: seedLocationNames } } } },
        ],
      },
    });
    await tx.stockTransfer.deleteMany({
      where: {
        OR: [
          { fromLocation: { name: { in: seedLocationNames } } },
          { toLocation: { name: { in: seedLocationNames } } },
          { items: { none: {} } },
        ],
      },
    });

    await tx.stockAlert.deleteMany({
      where: {
        OR: [
          { productVariant: { product: seedProductWhere() } },
          { location: { name: { in: seedLocationNames } } },
        ],
      },
    });
    await tx.stockMovement.deleteMany({
      where: {
        OR: [
          { productVariant: { product: seedProductWhere() } },
          { fromLocation: { name: { in: seedLocationNames } } },
          { toLocation: { name: { in: seedLocationNames } } },
        ],
      },
    });
    await tx.stockLevel.deleteMany({
      where: {
        OR: [
          { productVariant: { product: seedProductWhere() } },
          { location: { name: { in: seedLocationNames } } },
        ],
      },
    });
    await tx.purchaseReceiptItem.deleteMany({
      where: { productVariant: { product: seedProductWhere() } },
    });
    await tx.purchaseOrderItem.deleteMany({
      where: { productVariant: { product: seedProductWhere() } },
    });
    await tx.batch.deleteMany({
      where: { productVariant: { product: seedProductWhere() } },
    });

    await tx.promotionLocation.deleteMany({
      where: { promotion: { name: { in: seedPromotionNames } } },
    });
    await tx.promotionProduct.deleteMany({
      where: {
        OR: [
          { promotion: { name: { in: seedPromotionNames } } },
          { product: seedProductWhere() },
        ],
      },
    });
    await tx.promotionVariant.deleteMany({
      where: {
        OR: [
          { promotion: { name: { in: seedPromotionNames } } },
          { productVariant: { product: seedProductWhere() } },
        ],
      },
    });
    await tx.promotion.deleteMany({ where: { name: { in: seedPromotionNames } } });

    await tx.leaderboardTier.deleteMany({
      where: { group: { name: { in: seedLeaderboardNames } } },
    });
    await tx.leaderboardGroupLocation.deleteMany({
      where: {
        OR: [
          { group: { name: { in: seedLeaderboardNames } } },
          { location: { name: { in: seedLocationNames } } },
        ],
      },
    });
    await tx.leaderboardGroup.deleteMany({ where: { name: { in: seedLeaderboardNames } } });

    await tx.customer.deleteMany({ where: { email: { in: seedCustomerEmails } } });
    await tx.salesChannel.deleteMany({ where: { name: { in: seedChannelNames } } });
    await tx.exchangeRate.deleteMany({ where: { source: "Manual" } });

    await tx.productVariant.deleteMany({ where: { product: seedProductWhere() } });
    await tx.product.deleteMany({ where: seedProductWhere() });

    await tx.location.deleteMany({
      where: {
        name: { in: seedLocationNames },
        stockLevels: { none: {} },
        movementsFrom: { none: {} },
        movementsTo: { none: {} },
        orders: { none: {} },
        consignmentShipmentsFrom: { none: {} },
        consignmentShipmentsTo: { none: {} },
      },
    });

    await tx.category.deleteMany({
      where: {
        slug: { in: ["t-shirts", "pants", "jackets", "accessories", "dresses"] },
        products: { none: {} },
      },
    });
  }, { timeout: 120000 });

  console.log("Cleanup complete. Remaining candidates:");
  printCandidates(await collectCandidates());
}

function seedProductWhere() {
  return {
    OR: [
      { skuPrefix: { in: seedProductPrefixes } },
      { name: { in: seedProductNames } },
    ],
  };
}

async function collectCandidates() {
  const [
    users,
    categories,
    locations,
    products,
    variants,
    stockLevels,
    orders,
    customers,
    salesChannels,
    promotions,
    leaderboardGroups,
    partners,
    shipments,
    exchangeRates,
  ] = await Promise.all([
    prisma.user.findMany({ where: { email: { in: seedUsers } }, select: { email: true, name: true, role: true, isActive: true } }),
    prisma.category.findMany({ where: { slug: { in: ["t-shirts", "pants", "jackets", "accessories", "dresses"] } }, select: { name: true, slug: true } }),
    prisma.location.findMany({ where: { name: { in: seedLocationNames } }, select: { name: true, type: true } }),
    prisma.product.findMany({ where: seedProductWhere(), select: { name: true, skuPrefix: true } }),
    prisma.productVariant.count({ where: { product: seedProductWhere() } }),
    prisma.stockLevel.count({
      where: {
        OR: [
          { productVariant: { product: seedProductWhere() } },
          { location: { name: { in: seedLocationNames } } },
        ],
      },
    }),
    prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: { startsWith: "BT-SO-" } },
          { customer: { email: { in: seedCustomerEmails } } },
          { items: { some: { productVariant: { product: seedProductWhere() } } } },
        ],
      },
      select: { orderNumber: true },
      take: 20,
    }),
    prisma.customer.findMany({ where: { email: { in: seedCustomerEmails } }, select: { name: true, email: true } }),
    prisma.salesChannel.findMany({ where: { name: { in: seedChannelNames } }, select: { name: true, type: true } }),
    prisma.promotion.findMany({ where: { name: { in: seedPromotionNames } }, select: { name: true } }),
    prisma.leaderboardGroup.findMany({ where: { name: { in: seedLeaderboardNames } }, select: { name: true } }),
    prisma.consignmentPartner.findMany({ where: { name: { in: seedPartnerNames } }, select: { name: true } }),
    prisma.consignmentShipment.findMany({ where: { partner: { name: { in: seedPartnerNames } } }, select: { shipmentNumber: true } }),
    prisma.exchangeRate.findMany({ where: { source: "Manual" }, select: { fromCurrency: true, toCurrency: true } }),
  ]);

  return {
    users,
    categories,
    locations,
    products,
    variants,
    stockLevels,
    orders,
    customers,
    salesChannels,
    promotions,
    leaderboardGroups,
    partners,
    shipments,
    exchangeRates,
  };
}

function printCandidates(candidates) {
  console.log(JSON.stringify({
    usersToDisable: candidates.users,
    categoriesToDeleteIfEmpty: candidates.categories,
    locationsToDeleteIfUnused: candidates.locations,
    productsToDelete: candidates.products,
    variantCountToDelete: candidates.variants,
    stockLevelCountToDelete: candidates.stockLevels,
    ordersToDeleteSample: candidates.orders,
    customerCountToDelete: candidates.customers.length,
    customersToDelete: candidates.customers,
    salesChannelsToDelete: candidates.salesChannels,
    promotionsToDelete: candidates.promotions,
    leaderboardGroupsToDelete: candidates.leaderboardGroups,
    consignmentPartnersToDelete: candidates.partners,
    consignmentShipmentsToDelete: candidates.shipments,
    exchangeRateCountToDelete: candidates.exchangeRates.length,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
