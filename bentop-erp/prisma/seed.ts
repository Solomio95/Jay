import { PrismaClient, UserRole, LocationType, CustomerType, ChannelType, OrderStatus, PaymentStatus, Currency, MovementType, DiscountType, PromotionRuleMode } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ─── Users ────────────────────────────────────────────
  const passwordHash = await hash("admin123", 12);
  const staffHash = await hash("staff123", 12);
  const promoterHash = await hash("promoter123", 12);
  const supervisorHash = await hash("supervisor123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@bentop.com" },
    update: {},
    create: {
      email: "admin@bentop.com",
      name: "Ahmad Razak",
      phone: "+60123456789",
      role: UserRole.ADMIN,
      department: "Management",
      passwordHash,
      isActive: true,
    },
  });

  const manager1 = await prisma.user.upsert({
    where: { email: "siti@bentop.com" },
    update: {},
    create: {
      email: "siti@bentop.com",
      name: "Siti Nurhaliza",
      phone: "+60198765432",
      role: UserRole.MANAGER,
      department: "Inventory",
      passwordHash: staffHash,
      isActive: true,
    },
  });

  const manager2 = await prisma.user.upsert({
    where: { email: "james@bentop.com" },
    update: {},
    create: {
      email: "james@bentop.com",
      name: "James Tan",
      phone: "+60112345678",
      role: UserRole.MANAGER,
      department: "Sales",
      passwordHash: staffHash,
      isActive: true,
    },
  });

  const staff1 = await prisma.user.upsert({
    where: { email: "mei@bentop.com" },
    update: {},
    create: {
      email: "mei@bentop.com",
      name: "Mei Lin",
      phone: "+60187654321",
      role: UserRole.STAFF,
      department: "Retail",
      passwordHash: staffHash,
      isActive: true,
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: "viewer@bentop.com" },
    update: {},
    create: {
      email: "viewer@bentop.com",
      name: "Lee Wei",
      phone: "+60176543210",
      role: UserRole.VIEWER,
      department: "Finance",
      passwordHash: staffHash,
      isActive: true,
    },
  });

  console.log("Users seeded");

  // ─── Categories ───────────────────────────────────────
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: "t-shirts" },
      update: {},
      create: { name: "T-Shirts", slug: "t-shirts", sortOrder: 1, description: "Casual and formal t-shirts" },
    }),
    prisma.category.upsert({
      where: { slug: "pants" },
      update: {},
      create: { name: "Pants", slug: "pants", sortOrder: 2, description: "Trousers, jeans, and casual pants" },
    }),
    prisma.category.upsert({
      where: { slug: "jackets" },
      update: {},
      create: { name: "Jackets", slug: "jackets", sortOrder: 3, description: "Outerwear and jackets" },
    }),
    prisma.category.upsert({
      where: { slug: "accessories" },
      update: {},
      create: { name: "Accessories", slug: "accessories", sortOrder: 4, description: "Bags, caps, and accessories" },
    }),
    prisma.category.upsert({
      where: { slug: "dresses" },
      update: {},
      create: { name: "Dresses", slug: "dresses", sortOrder: 5, description: "Casual and formal dresses" },
    }),
  ]);

  console.log("Categories seeded");

  // ─── Locations ────────────────────────────────────────
  const warehouse = await prisma.location.create({
    data: {
      name: "Main Warehouse KL",
      type: LocationType.WAREHOUSE,
      address: "Lot 15, Jalan Industri 3, Taman Perindustrian, 47100 Puchong, Selangor",
      contactPerson: "Ahmad Razak",
      contactPhone: "+60123456789",
    },
  });

  const retailStore = await prisma.location.create({
    data: {
      name: "Retail Store Pavilion",
      type: LocationType.RETAIL_STORE,
      address: "Lot 3.12, Level 3, Pavilion KL, 168 Jalan Bukit Bintang, 55100 Kuala Lumpur",
      contactPerson: "Mei Lin",
      contactPhone: "+60187654321",
    },
  });

  let consignmentLoc = await prisma.location.findFirst({
    where: {
      name: "Consignment Partner XYZ",
      type: LocationType.CONSIGNMENT,
    },
  });

  if (consignmentLoc) {
    consignmentLoc = await prisma.location.update({
      where: { id: consignmentLoc.id },
      data: {
        address: "No. 22, Jalan SS2/75, 47300 Petaling Jaya, Selangor",
        contactPerson: "David Wong",
        contactPhone: "+60145678901",
      },
    });
  } else {
    consignmentLoc = await prisma.location.create({
      data: {
        name: "Consignment Partner XYZ",
        type: LocationType.CONSIGNMENT,
        address: "No. 22, Jalan SS2/75, 47300 Petaling Jaya, Selangor",
        contactPerson: "David Wong",
        contactPhone: "+60145678901",
      },
    });
  }

  const promoter = await prisma.user.upsert({
    where: { email: "promoter@bentop.com" },
    update: {
      name: "Promoter Test User",
      role: UserRole.PROMOTER,
      department: "Promotions",
      defaultLocationId: consignmentLoc.id,
      passwordHash: promoterHash,
      isActive: true,
    },
    create: {
      email: "promoter@bentop.com",
      name: "Promoter Test User",
      phone: "+60111112222",
      role: UserRole.PROMOTER,
      department: "Promotions",
      defaultLocationId: consignmentLoc.id,
      passwordHash: promoterHash,
      isActive: true,
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@bentop.com" },
    update: {
      name: "Supervisor Test User",
      role: UserRole.SUPERVISOR,
      department: "Promotions",
      passwordHash: supervisorHash,
      isActive: true,
      supervisedLocations: {
        connect: { id: consignmentLoc.id },
      },
    },
    create: {
      email: "supervisor@bentop.com",
      name: "Supervisor Test User",
      phone: "+60111113333",
      role: UserRole.SUPERVISOR,
      department: "Promotions",
      passwordHash: supervisorHash,
      isActive: true,
      supervisedLocations: {
        connect: { id: consignmentLoc.id },
      },
    },
  });

  console.log(`Promoter seeded: ${promoter.email}`);
  console.log(`Supervisor seeded: ${supervisor.email}`);

  const billionPartner = await prisma.$transaction(async (tx) => {
    const partner = await tx.consignmentPartner.upsert({
      where: { locationId: consignmentLoc.id },
      update: {
        name: "Billion Group",
        contactPerson: "Billion Consignment Team",
        paymentTermsDays: 30,
        isActive: true,
      },
      create: {
        locationId: consignmentLoc.id,
        name: "Billion Group",
        contactPerson: "Billion Consignment Team",
        paymentTermsDays: 30,
        isActive: true,
      },
    });

    await tx.consignmentCommissionTier.deleteMany({
      where: { partnerId: partner.id },
    });

    await tx.consignmentCommissionTier.createMany({
      data: [
        {
          partnerId: partner.id,
          name: "Super Best Buy",
          minPrice: 0,
          maxPrice: 49.9,
          commissionRate: 23,
          sortOrder: 1,
          isActive: true,
        },
        {
          partnerId: partner.id,
          name: "Best Buy",
          minPrice: 50,
          maxPrice: 109,
          commissionRate: 25,
          sortOrder: 2,
          isActive: true,
        },
        {
          partnerId: partner.id,
          name: "Normal",
          minPrice: 110,
          maxPrice: null,
          commissionRate: 32,
          sortOrder: 3,
          isActive: true,
        },
      ],
    });

    return partner;
  });

  console.log(`Consignment partner seeded: ${billionPartner.name}`);

  console.log("Locations seeded");

  // ─── Sales Channels ───────────────────────────────────
  const channels = await Promise.all([
    prisma.salesChannel.create({
      data: { name: "Pavilion Retail Store", type: ChannelType.PHYSICAL_STORE, commissionRate: 0 },
    }),
    prisma.salesChannel.create({
      data: { name: "Shopee Malaysia", type: ChannelType.SHOPEE, commissionRate: 5.5 },
    }),
    prisma.salesChannel.create({
      data: { name: "TikTok Shop", type: ChannelType.TIKTOK, commissionRate: 4.0 },
    }),
    prisma.salesChannel.create({
      data: { name: "Wholesale B2B", type: ChannelType.WHOLESALE, commissionRate: 0 },
    }),
    prisma.salesChannel.create({
      data: { name: "Consignment Partners", type: ChannelType.CONSIGNMENT, commissionRate: 20 },
    }),
  ]);

  console.log("Sales channels seeded");

  // ─── Products & Variants ──────────────────────────────
  const sizes = ["S", "M", "L", "XL"];
  const colorSets = [
    [{ name: "Black", hex: "#000000" }, { name: "White", hex: "#FFFFFF" }, { name: "Navy", hex: "#1B2A4A" }],
    [{ name: "Black", hex: "#000000" }, { name: "Grey", hex: "#808080" }, { name: "Khaki", hex: "#C3B091" }],
    [{ name: "Black", hex: "#000000" }, { name: "Grey", hex: "#808080" }, { name: "Olive", hex: "#556B2F" }],
    [{ name: "Black", hex: "#000000" }, { name: "Brown", hex: "#8B4513" }],
    [{ name: "White", hex: "#FFFFFF" }, { name: "Pink", hex: "#FFC0CB" }, { name: "Blue", hex: "#4169E1" }],
  ];

  const productDefs = [
    { name: "Classic Crew Tee", catIdx: 0, prefix: "BT-TS-001", cost: 15, colorIdx: 0 },
    { name: "V-Neck Essential", catIdx: 0, prefix: "BT-TS-002", cost: 18, colorIdx: 0 },
    { name: "Oversized Street Tee", catIdx: 0, prefix: "BT-TS-003", cost: 22, colorIdx: 0 },
    { name: "Henley Long Sleeve", catIdx: 0, prefix: "BT-TS-004", cost: 25, colorIdx: 1 },
    { name: "Slim Fit Chinos", catIdx: 1, prefix: "BT-PN-001", cost: 35, colorIdx: 1 },
    { name: "Relaxed Cargo Pants", catIdx: 1, prefix: "BT-PN-002", cost: 40, colorIdx: 2 },
    { name: "Jogger Pants", catIdx: 1, prefix: "BT-PN-003", cost: 30, colorIdx: 1 },
    { name: "Denim Straight Cut", catIdx: 1, prefix: "BT-PN-004", cost: 45, colorIdx: 0 },
    { name: "Bomber Jacket", catIdx: 2, prefix: "BT-JK-001", cost: 65, colorIdx: 2 },
    { name: "Lightweight Windbreaker", catIdx: 2, prefix: "BT-JK-002", cost: 55, colorIdx: 0 },
    { name: "Denim Jacket", catIdx: 2, prefix: "BT-JK-003", cost: 70, colorIdx: 0 },
    { name: "Hoodie Classic", catIdx: 2, prefix: "BT-JK-004", cost: 50, colorIdx: 1 },
    { name: "Canvas Tote Bag", catIdx: 3, prefix: "BT-AC-001", cost: 20, colorIdx: 3 },
    { name: "Snapback Cap", catIdx: 3, prefix: "BT-AC-002", cost: 15, colorIdx: 0 },
    { name: "Leather Belt", catIdx: 3, prefix: "BT-AC-003", cost: 25, colorIdx: 3 },
    { name: "Woven Scarf", catIdx: 3, prefix: "BT-AC-004", cost: 18, colorIdx: 0 },
    { name: "Summer Maxi Dress", catIdx: 4, prefix: "BT-DR-001", cost: 45, colorIdx: 4 },
    { name: "Wrap Midi Dress", catIdx: 4, prefix: "BT-DR-002", cost: 50, colorIdx: 4 },
    { name: "Shirt Dress", catIdx: 4, prefix: "BT-DR-003", cost: 42, colorIdx: 0 },
    { name: "Casual Shift Dress", catIdx: 4, prefix: "BT-DR-004", cost: 38, colorIdx: 4 },
  ];

  const allVariants: { id: string; sku: string; productName: string }[] = [];

  for (const pDef of productDefs) {
    const colors = colorSets[pDef.colorIdx];
    const product = await prisma.product.create({
      data: {
        name: pDef.name,
        slug: pDef.name.toLowerCase().replace(/\s+/g, "-"),
        skuPrefix: pDef.prefix,
        categoryId: categories[pDef.catIdx].id,
        baseCostMyr: pDef.cost,
        baseCostUsd: +(pDef.cost * 0.22).toFixed(2),
        baseCostRmb: +(pDef.cost * 1.02).toFixed(2),
        material: pDef.catIdx <= 2 ? "100% Cotton" : "Mixed",
        weightKg: 0.3,
        description: `Premium ${pDef.name} from Bentop Collection.`,
      },
    });

    for (const color of colors) {
      const colorCode = color.name.substring(0, 3).toUpperCase();
      for (const size of sizes) {
        const sku = `${pDef.prefix}-${colorCode}-${size}`;
        const variant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku,
            size,
            color: color.name,
            colorHex: color.hex,
            barcode: `899${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
          },
        });
        allVariants.push({ id: variant.id, sku: variant.sku, productName: pDef.name });
      }
    }
  }

  console.log(`Products seeded: ${productDefs.length} products, ${allVariants.length} variants`);

  const promotionStartsAt = new Date();
  const promotionEndsAt = new Date(promotionStartsAt);
  promotionEndsAt.setMonth(promotionEndsAt.getMonth() + 1);

  const promotion = await prisma.promotion.findFirst({
    where: { name: "Consignment Bundle Promo" },
  });
  const activePromotion = promotion
    ? await prisma.promotion.update({
        where: { id: promotion.id },
        data: {
          ruleMode: PromotionRuleMode.MIX_AND_MATCH,
          bundleQuantity: 2,
          bundlePrice: 99,
          startsAt: promotionStartsAt,
          endsAt: promotionEndsAt,
          isActive: true,
        },
      })
    : await prisma.promotion.create({
        data: {
          name: "Consignment Bundle Promo",
          ruleMode: PromotionRuleMode.MIX_AND_MATCH,
          bundleQuantity: 2,
          bundlePrice: 99,
          startsAt: promotionStartsAt,
          endsAt: promotionEndsAt,
          isActive: true,
        },
      });

  await prisma.promotionLocation.upsert({
    where: {
      promotionId_locationId: {
        promotionId: activePromotion.id,
        locationId: consignmentLoc.id,
      },
    },
    update: {},
    create: {
      promotionId: activePromotion.id,
      locationId: consignmentLoc.id,
    },
  });

  if (allVariants.length > 0) {
    await prisma.promotionVariant.upsert({
      where: {
        promotionId_productVariantId: {
          promotionId: activePromotion.id,
          productVariantId: allVariants[0].id,
        },
      },
      update: {},
      create: {
        promotionId: activePromotion.id,
        productVariantId: allVariants[0].id,
      },
    });
  }

  const leaderboardGroup = await prisma.leaderboardGroup.findFirst({
    where: { name: "Consignment Monthly Leaderboard" },
  });
  const activeLeaderboardGroup = leaderboardGroup
    ? await prisma.leaderboardGroup.update({
        where: { id: leaderboardGroup.id },
        data: { isActive: true },
      })
    : await prisma.leaderboardGroup.create({
        data: {
          name: "Consignment Monthly Leaderboard",
          isActive: true,
        },
      });

  await prisma.leaderboardGroupLocation.upsert({
    where: {
      groupId_locationId: {
        groupId: activeLeaderboardGroup.id,
        locationId: consignmentLoc.id,
      },
    },
    update: {},
    create: {
      groupId: activeLeaderboardGroup.id,
      locationId: consignmentLoc.id,
    },
  });

  await prisma.leaderboardTier.deleteMany({
    where: { groupId: activeLeaderboardGroup.id },
  });

  await prisma.leaderboardTier.createMany({
    data: [
      {
        groupId: activeLeaderboardGroup.id,
        name: "Bronze",
        minSales: 0,
        maxSales: 2999,
        sortOrder: 1,
      },
      {
        groupId: activeLeaderboardGroup.id,
        name: "Silver",
        minSales: 3000,
        maxSales: 7999,
        sortOrder: 2,
      },
      {
        groupId: activeLeaderboardGroup.id,
        name: "Gold",
        minSales: 8000,
        maxSales: null,
        sortOrder: 3,
      },
    ],
  });

  console.log("Promotions and leaderboard seeded");

  // ─── Stock Levels ─────────────────────────────────────
  const locations = [warehouse, retailStore, consignmentLoc];
  for (const variant of allVariants) {
    // Warehouse always has stock
    await prisma.stockLevel.create({
      data: {
        productVariantId: variant.id,
        locationId: warehouse.id,
        quantityOnHand: Math.floor(Math.random() * 80) + 5,
        reorderPoint: 20,
        reorderQuantity: 50,
      },
    });
    // 60% chance of retail store stock
    if (Math.random() > 0.4) {
      await prisma.stockLevel.create({
        data: {
          productVariantId: variant.id,
          locationId: retailStore.id,
          quantityOnHand: Math.floor(Math.random() * 15) + 1,
          reorderPoint: 5,
          reorderQuantity: 15,
        },
      });
    }
    // 30% chance of consignment stock
    if (Math.random() > 0.7) {
      await prisma.stockLevel.create({
        data: {
          productVariantId: variant.id,
          locationId: consignmentLoc.id,
          quantityOnHand: Math.floor(Math.random() * 10) + 1,
          reorderPoint: 3,
          reorderQuantity: 10,
        },
      });
    }
  }

  console.log("Stock levels seeded");

  // ─── Customers ────────────────────────────────────────
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: "Sarah Ahmad",
        email: "sarah@email.com",
        phone: "+60123001001",
        customerType: CustomerType.RETAIL,
        addresses: JSON.parse('[{"type":"shipping","line1":"12 Jalan Ampang","city":"KL","state":"WP","postcode":"50450"}]'),
      },
    }),
    prisma.customer.create({
      data: {
        name: "TechStyle Sdn Bhd",
        email: "purchasing@techstyle.com",
        phone: "+60321234567",
        companyName: "TechStyle Sdn Bhd",
        customerType: CustomerType.WHOLESALE,
        taxId: "201901012345",
        creditLimitMyr: 50000,
        paymentTermsDays: 30,
      },
    }),
    prisma.customer.create({
      data: {
        name: "Fashion Hub Sdn Bhd",
        email: "orders@fashionhub.com",
        phone: "+60322345678",
        companyName: "Fashion Hub Sdn Bhd",
        customerType: CustomerType.CONSIGNMENT,
        creditLimitMyr: 30000,
        paymentTermsDays: 60,
      },
    }),
    prisma.customer.create({
      data: {
        name: "David Wong",
        email: "david.w@email.com",
        phone: "+60145001002",
        customerType: CustomerType.RETAIL,
      },
    }),
    prisma.customer.create({
      data: {
        name: "Aisha Boutique",
        email: "aisha@boutique.com",
        phone: "+60198001003",
        companyName: "Aisha Boutique",
        customerType: CustomerType.WHOLESALE,
        creditLimitMyr: 20000,
        paymentTermsDays: 14,
      },
    }),
    prisma.customer.create({
      data: {
        name: "Metro Mall",
        email: "vendor@metromall.com",
        phone: "+60332001004",
        companyName: "Metro Mall Sdn Bhd",
        customerType: CustomerType.CONSIGNMENT,
        creditLimitMyr: 40000,
        paymentTermsDays: 45,
      },
    }),
    prisma.customer.create({
      data: { name: "Lim Mei Ying", email: "meiying@email.com", phone: "+60167001005", customerType: CustomerType.RETAIL },
    }),
    prisma.customer.create({
      data: { name: "Raj Kumar", email: "raj@email.com", phone: "+60178001006", customerType: CustomerType.RETAIL },
    }),
    prisma.customer.create({
      data: {
        name: "Trendy Threads",
        email: "buy@trendythreads.com",
        phone: "+60342001007",
        companyName: "Trendy Threads Enterprise",
        customerType: CustomerType.WHOLESALE,
        creditLimitMyr: 15000,
        paymentTermsDays: 14,
      },
    }),
    prisma.customer.create({
      data: { name: "Nurul Izzah", email: "nurul.i@email.com", phone: "+60189001008", customerType: CustomerType.RETAIL },
    }),
  ]);

  console.log("Customers seeded");

  // ─── Sample Orders ────────────────────────────────────
  const statuses: OrderStatus[] = [
    OrderStatus.DRAFT,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.PACKED,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
  ];

  const paymentStatuses: PaymentStatus[] = [
    PaymentStatus.UNPAID,
    PaymentStatus.UNPAID,
    PaymentStatus.PAID,
    PaymentStatus.PAID,
    PaymentStatus.PAID,
    PaymentStatus.PAID,
  ];

  for (let i = 0; i < 50; i++) {
    const statusIdx = Math.floor(Math.random() * statuses.length);
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const channel = channels[Math.floor(Math.random() * channels.length)];
    const numItems = Math.floor(Math.random() * 4) + 1;
    const dateOffset = Math.floor(Math.random() * 30);
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - dateOffset);

    const seq = String(i + 1).padStart(4, "0");
    const dateStr = orderDate.toISOString().slice(0, 10).replace(/-/g, "");

    const selectedVariants = [];
    for (let j = 0; j < numItems; j++) {
      const v = allVariants[Math.floor(Math.random() * allVariants.length)];
      selectedVariants.push(v);
    }

    let subtotal = 0;
    const items = selectedVariants.map((v) => {
      const qty = Math.floor(Math.random() * 5) + 1;
      const unitPrice = +(Math.random() * 100 + 30).toFixed(2);
      const totalPrice = +(qty * unitPrice).toFixed(2);
      subtotal += totalPrice;
      return {
        productVariantId: v.id,
        quantity: qty,
        unitPrice,
        totalPrice,
        costAtTimeOfSale: +(unitPrice * 0.4).toFixed(2),
      };
    });

    const discountAmount = Math.random() > 0.7 ? +(subtotal * 0.1).toFixed(2) : 0;
    const totalAmount = +(subtotal - discountAmount).toFixed(2);

    await prisma.order.create({
      data: {
        orderNumber: `BT-SO-${dateStr}-${seq}`,
        customerId: customer.id,
        salesChannelId: channel.id,
        locationId: warehouse.id,
        status: statuses[statusIdx],
        currency: Currency.MYR,
        subtotal,
        discountAmount,
        discountType: discountAmount > 0 ? DiscountType.PERCENTAGE : null,
        totalAmount,
        paymentStatus: paymentStatuses[statusIdx],
        paymentMethod: statusIdx >= 2 ? "Bank Transfer" : null,
        createdById: [admin.id, manager1.id, manager2.id, staff1.id][Math.floor(Math.random() * 4)],
        createdAt: orderDate,
        items: {
          create: items,
        },
        statusHistory: {
          create: {
            toStatus: statuses[statusIdx],
            changedById: admin.id,
            reason: "Order created",
            createdAt: orderDate,
          },
        },
      },
    });
  }

  console.log("Orders seeded: 50 sample orders");

  // ─── Exchange Rates ───────────────────────────────────
  await prisma.exchangeRate.createMany({
    data: [
      { fromCurrency: Currency.USD, toCurrency: Currency.MYR, rate: 4.47, effectiveDate: new Date(), source: "Manual" },
      { fromCurrency: Currency.RMB, toCurrency: Currency.MYR, rate: 0.62, effectiveDate: new Date(), source: "Manual" },
      { fromCurrency: Currency.MYR, toCurrency: Currency.USD, rate: 0.224, effectiveDate: new Date(), source: "Manual" },
      { fromCurrency: Currency.MYR, toCurrency: Currency.RMB, rate: 1.61, effectiveDate: new Date(), source: "Manual" },
    ],
  });

  console.log("Exchange rates seeded");
  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
