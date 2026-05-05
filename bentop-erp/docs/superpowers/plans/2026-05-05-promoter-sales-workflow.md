# Promoter Sales Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated promoter workflow for locked-location consignment sales, returns, stock lookup, transfer requests, promotions, and monthly leaderboard.

**Architecture:** Add promoter/supervisor data relationships to Prisma, then layer focused business helpers under `src/lib/promoter`. Promoter UI gets its own `/promoter/*` pages, while sales, returns, stock, transfers, and reporting still write through the existing `Order`, `OrderItem`, `StockLevel`, `StockMovement`, and `StockTransfer` concepts.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, PostgreSQL, NextAuth, Zod, node:test.

---

## File Structure

- Modify `prisma/schema.prisma`: add `PROMOTER`, `SUPERVISOR`, user-location assignments, customer attribution, promotion models, return models, notification models, leaderboard models, and optional order item promotion metadata.
- Modify `prisma/seed.ts`: add one supervisor, one promoter, location assignment, and minimal promotion/leaderboard seed records for testing.
- Modify `src/lib/auth.ts`: include user location data in session.
- Create `src/lib/promoter/access.ts`: server-side role and allowed-location checks.
- Create `src/lib/promoter/promotions.ts`: promotion eligibility and effective price calculations.
- Create `src/lib/promoter/sales.ts`: final promoter sale creation with immediate stock deduction.
- Create `src/lib/promoter/returns.ts`: linked promoter return creation with stock add-back.
- Create `src/lib/promoter/leaderboard.ts`: monthly net sales and tier calculation.
- Create `src/lib/promoter/access.test.ts`: unit tests for allowed-location logic.
- Create `src/lib/promoter/promotions.test.ts`: unit tests for same-SKU and mix-and-match effective unit price.
- Create `src/lib/promoter/leaderboard.test.ts`: unit tests for returns reducing monthly totals.
- Create `src/lib/validators/promoter.ts`: Zod schemas for promoter sale, return, transfer request, and promotion setup.
- Create `src/app/api/v1/promoter/context/route.ts`: current promoter role/location context.
- Create `src/app/api/v1/promoter/stock/route.ts`: grouped stock view by parent SKU and sub SKU.
- Create `src/app/api/v1/promoter/sales/route.ts`: promoter sale submission.
- Create `src/app/api/v1/promoter/returns/route.ts`: promoter linked return submission.
- Create `src/app/api/v1/promoter/transfers/route.ts`: promoter transfer request with ERP notification.
- Create `src/app/api/v1/promoter/leaderboard/route.ts`: monthly leaderboard endpoint.
- Create `src/app/(dashboard)/promoter/layout.tsx`: promoter section layout.
- Create `src/app/(dashboard)/promoter/sales/new/page.tsx`: barcode-first multi-item sale entry.
- Create `src/app/(dashboard)/promoter/returns/page.tsx`: linked return entry.
- Create `src/app/(dashboard)/promoter/stock/page.tsx`: own-location stock first, other locations below.
- Create `src/app/(dashboard)/promoter/transfers/page.tsx`: transfer request status.
- Create `src/app/(dashboard)/promoter/leaderboard/page.tsx`: monthly leaderboard.
- Modify `src/components/layout/sidebar.tsx`: role-aware navigation showing promoter pages only for promoters.

## Task 1: Database Foundation

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Update Prisma schema with promoter roles and relationships**

Add `PROMOTER` and `SUPERVISOR` to `UserRole`.

Add these fields to `User`:

```prisma
  defaultLocationId String?
  defaultLocation   Location? @relation("UserDefaultLocation", fields: [defaultLocationId], references: [id])
  supervisedLocations Location[] @relation("LocationSupervisors")
  temporaryLocations UserTemporaryLocation[]
  registeredCustomers Customer[] @relation("CustomerRegisteredBy")
  promoterReturns PromoterReturn[]
  notifications Notification[]
```

Add these fields to `Location`:

```prisma
  defaultUsers User[] @relation("UserDefaultLocation")
  supervisors User[] @relation("LocationSupervisors")
  temporaryUsers UserTemporaryLocation[]
  customersRegisteredHere Customer[] @relation("CustomerRegisteredAtLocation")
  promotions PromotionLocation[]
  leaderboardLocations LeaderboardGroupLocation[]
```

Add these fields to `Customer`:

```prisma
  registeredById String?
  registeredLocationId String?
  registeredBy User? @relation("CustomerRegisteredBy", fields: [registeredById], references: [id])
  registeredLocation Location? @relation("CustomerRegisteredAtLocation", fields: [registeredLocationId], references: [id])
```

Add these models:

```prisma
model UserTemporaryLocation {
  id String @id @default(cuid())
  userId String
  locationId String
  startsAt DateTime
  endsAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  location Location @relation(fields: [locationId], references: [id], onDelete: Cascade)

  @@index([userId, startsAt, endsAt])
  @@index([locationId])
  @@map("user_temporary_locations")
}

enum PromotionRuleMode {
  SAME_SKU
  MIX_AND_MATCH
}

enum PromotionType {
  BUNDLE_PRICE
}

model Promotion {
  id String @id @default(cuid())
  name String
  promotionType PromotionType @default(BUNDLE_PRICE)
  ruleMode PromotionRuleMode
  bundleQuantity Int
  bundlePrice Decimal @db.Decimal(12, 2)
  startsAt DateTime
  endsAt DateTime
  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  locations PromotionLocation[]
  products PromotionProduct[]
  variants PromotionVariant[]

  @@index([startsAt, endsAt, isActive])
  @@map("promotions")
}

model PromotionLocation {
  id String @id @default(cuid())
  promotionId String
  locationId String

  promotion Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)
  location Location @relation(fields: [locationId], references: [id], onDelete: Cascade)

  @@unique([promotionId, locationId])
  @@map("promotion_locations")
}

model PromotionProduct {
  id String @id @default(cuid())
  promotionId String
  productId String

  promotion Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([promotionId, productId])
  @@map("promotion_products")
}

model PromotionVariant {
  id String @id @default(cuid())
  promotionId String
  productVariantId String

  promotion Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)
  productVariant ProductVariant @relation(fields: [productVariantId], references: [id], onDelete: Cascade)

  @@unique([promotionId, productVariantId])
  @@map("promotion_variants")
}

model PromoterReturn {
  id String @id @default(cuid())
  orderId String
  orderItemId String
  productVariantId String
  locationId String
  promoterId String
  quantity Int
  amount Decimal @db.Decimal(12, 2)
  reason String?
  createdAt DateTime @default(now())

  order Order @relation(fields: [orderId], references: [id])
  orderItem OrderItem @relation(fields: [orderItemId], references: [id])
  productVariant ProductVariant @relation(fields: [productVariantId], references: [id])
  location Location @relation(fields: [locationId], references: [id])
  promoter User @relation(fields: [promoterId], references: [id])

  @@index([orderId])
  @@index([promoterId, createdAt])
  @@index([locationId])
  @@map("promoter_returns")
}

enum NotificationStatus {
  UNREAD
  READ
  ACTIONED
}

model Notification {
  id String @id @default(cuid())
  userId String
  title String
  body String
  entityType String
  entityId String
  status NotificationStatus @default(UNREAD)
  escalatesAt DateTime?
  createdAt DateTime @default(now())
  readAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@index([escalatesAt])
  @@map("notifications")
}

model LeaderboardGroup {
  id String @id @default(cuid())
  name String
  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  locations LeaderboardGroupLocation[]
  tiers LeaderboardTier[]

  @@map("leaderboard_groups")
}

model LeaderboardGroupLocation {
  id String @id @default(cuid())
  groupId String
  locationId String

  group LeaderboardGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  location Location @relation(fields: [locationId], references: [id], onDelete: Cascade)

  @@unique([groupId, locationId])
  @@map("leaderboard_group_locations")
}

model LeaderboardTier {
  id String @id @default(cuid())
  groupId String
  name String
  minSales Decimal @db.Decimal(12, 2)
  maxSales Decimal? @db.Decimal(12, 2)
  sortOrder Int @default(0)

  group LeaderboardGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@index([groupId, sortOrder])
  @@map("leaderboard_tiers")
}
```

Add relations from `Product`, `ProductVariant`, `Order`, and `OrderItem` for the new models where Prisma requires back-relations.

- [ ] **Step 2: Run schema generation**

Run: `npm run db:generate`

Expected: Prisma client generation succeeds.

- [ ] **Step 3: Push schema to local database**

Run: `npm run db:push`

Expected: Database sync succeeds without data loss prompts.

- [ ] **Step 4: Seed promoter test data**

Modify `prisma/seed.ts` to create:

```ts
const promoterPasswordHash = await hash("promoter123", 10);
const supervisorPasswordHash = await hash("supervisor123", 10);

const promoter = await prisma.user.upsert({
  where: { email: "promoter@bentop.com" },
  update: { role: "PROMOTER", defaultLocationId: billionLocation.id, isActive: true },
  create: {
    email: "promoter@bentop.com",
    name: "Bentop Promoter",
    role: "PROMOTER",
    passwordHash: promoterPasswordHash,
    defaultLocationId: billionLocation.id,
  },
});

await prisma.user.upsert({
  where: { email: "supervisor@bentop.com" },
  update: { role: "SUPERVISOR", isActive: true },
  create: {
    email: "supervisor@bentop.com",
    name: "Bentop Supervisor",
    role: "SUPERVISOR",
    passwordHash: supervisorPasswordHash,
    supervisedLocations: { connect: { id: billionLocation.id } },
  },
});
```

Use an existing consignment location from the seed as `billionLocation`. If there is no variable for it yet, assign the first active `CONSIGNMENT` location after location seeding.

- [ ] **Step 5: Commit database foundation**

Run:

```powershell
git add prisma/schema.prisma prisma/seed.ts
git commit -m "Add promoter data model"
```

## Task 2: Access Helpers And Validators

**Files:**
- Create: `src/lib/promoter/access.ts`
- Create: `src/lib/promoter/access.test.ts`
- Create: `src/lib/validators/promoter.ts`
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Write access helper tests**

Create `src/lib/promoter/access.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAllowedPromoterLocationIds } from "./access";

describe("getAllowedPromoterLocationIds", () => {
  it("returns only the default location when no temporary coverage is active", () => {
    const result = getAllowedPromoterLocationIds({
      now: new Date("2026-05-25T12:00:00+08:00"),
      defaultLocationId: "loc-default",
      temporaryLocations: [
        { locationId: "loc-old", startsAt: new Date("2026-05-01"), endsAt: new Date("2026-05-10") },
      ],
    });

    assert.deepEqual(result, ["loc-default"]);
  });

  it("includes temporary cover locations inside the date range", () => {
    const result = getAllowedPromoterLocationIds({
      now: new Date("2026-05-25T12:00:00+08:00"),
      defaultLocationId: "loc-default",
      temporaryLocations: [
        { locationId: "loc-cover", startsAt: new Date("2026-05-24"), endsAt: new Date("2026-06-01") },
      ],
    });

    assert.deepEqual(result, ["loc-default", "loc-cover"]);
  });
});
```

- [ ] **Step 2: Run failing access tests**

Run: `npm run test:unit -- src/lib/promoter/access.test.ts`

Expected: FAIL because `src/lib/promoter/access.ts` does not exist.

- [ ] **Step 3: Implement access helper**

Create `src/lib/promoter/access.ts`:

```ts
export type TemporaryLocationWindow = {
  locationId: string;
  startsAt: Date;
  endsAt: Date;
};

export function getAllowedPromoterLocationIds(input: {
  now: Date;
  defaultLocationId: string | null | undefined;
  temporaryLocations: TemporaryLocationWindow[];
}) {
  const ids = new Set<string>();
  if (input.defaultLocationId) ids.add(input.defaultLocationId);

  for (const item of input.temporaryLocations) {
    if (item.startsAt <= input.now && item.endsAt >= input.now) {
      ids.add(item.locationId);
    }
  }

  return Array.from(ids);
}

export function assertPromoterLocationAllowed(input: {
  requestedLocationId: string;
  allowedLocationIds: string[];
}) {
  if (!input.allowedLocationIds.includes(input.requestedLocationId)) {
    throw new Error("PROMOTER_LOCATION_NOT_ALLOWED");
  }
}
```

- [ ] **Step 4: Add promoter validators**

Create `src/lib/validators/promoter.ts`:

```ts
import { z } from "zod";

export const promoterSaleItemSchema = z.object({
  productVariantId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  discountAmount: z.number().nonnegative().default(0),
  promotionId: z.string().optional().nullable(),
});

export const promoterSaleSchema = z.object({
  locationId: z.string().min(1),
  customer: z
    .object({
      name: z.string().min(1).max(200),
      phone: z.string().min(1, "Phone number is required").max(30),
    })
    .optional()
    .nullable(),
  customerId: z.string().optional().nullable(),
  items: z.array(promoterSaleItemSchema).min(1),
  notes: z.string().max(2000).optional(),
});

export const promoterReturnSchema = z.object({
  orderId: z.string().min(1),
  orderItemId: z.string().min(1),
  quantity: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

export const promoterTransferRequestSchema = z.object({
  fromLocationId: z.string().min(1),
  toLocationId: z.string().min(1),
  productVariantId: z.string().min(1),
  quantity: z.number().int().positive(),
  notes: z.string().max(1000).optional(),
});
```

- [ ] **Step 5: Add session location fields**

Modify `src/lib/auth.ts` so `authorize` fetches user location assignments:

```ts
const user = await prisma.user.findUnique({
  where: { email: credentials.email as string },
  include: { temporaryLocations: true },
});
```

Return:

```ts
defaultLocationId: user.defaultLocationId,
```

In `jwt`, set:

```ts
token.defaultLocationId = (user as { defaultLocationId?: string | null }).defaultLocationId ?? null;
```

In `session`, set:

```ts
(session.user as unknown as Record<string, unknown>).defaultLocationId = token.defaultLocationId as string | null;
```

- [ ] **Step 6: Run tests**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 7: Commit access helpers**

Run:

```powershell
git add src/lib/auth.ts src/lib/promoter/access.ts src/lib/promoter/access.test.ts src/lib/validators/promoter.ts
git commit -m "Add promoter access helpers"
```

## Task 3: Promotion Pricing Helpers

**Files:**
- Create: `src/lib/promoter/promotions.ts`
- Create: `src/lib/promoter/promotions.test.ts`

- [ ] **Step 1: Write promotion tests**

Create `src/lib/promoter/promotions.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculatePromotionUnitPrices } from "./promotions";

describe("calculatePromotionUnitPrices", () => {
  it("applies 2 for RM100 as RM50 per item for same SKU", () => {
    const result = calculatePromotionUnitPrices({
      ruleMode: "SAME_SKU",
      bundleQuantity: 2,
      bundlePrice: 100,
      items: [
        { productVariantId: "sku-a", productId: "p1", quantity: 2, normalUnitPrice: 59.9 },
      ],
    });

    assert.equal(result[0].effectiveUnitPrice, 50);
  });

  it("applies mix-and-match across selected variants", () => {
    const result = calculatePromotionUnitPrices({
      ruleMode: "MIX_AND_MATCH",
      bundleQuantity: 2,
      bundlePrice: 100,
      items: [
        { productVariantId: "sku-a", productId: "p1", quantity: 1, normalUnitPrice: 59.9 },
        { productVariantId: "sku-b", productId: "p2", quantity: 1, normalUnitPrice: 69.9 },
      ],
    });

    assert.deepEqual(result.map((item) => item.effectiveUnitPrice), [50, 50]);
  });
});
```

- [ ] **Step 2: Run failing promotion tests**

Run: `npm run test:unit -- src/lib/promoter/promotions.test.ts`

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement promotion helper**

Create `src/lib/promoter/promotions.ts`:

```ts
type RuleMode = "SAME_SKU" | "MIX_AND_MATCH";

type PromotionItem = {
  productVariantId: string;
  productId: string;
  quantity: number;
  normalUnitPrice: number;
};

export function calculatePromotionUnitPrices(input: {
  ruleMode: RuleMode;
  bundleQuantity: number;
  bundlePrice: number;
  items: PromotionItem[];
}) {
  const effectiveBundleUnitPrice = roundMoney(input.bundlePrice / input.bundleQuantity);
  const expanded = input.items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => ({
      productVariantId: item.productVariantId,
      productId: item.productId,
      normalUnitPrice: item.normalUnitPrice,
      effectiveUnitPrice: item.normalUnitPrice,
    })),
  );

  if (input.ruleMode === "SAME_SKU") {
    const byVariant = groupIndexes(expanded, (item) => item.productVariantId);
    for (const indexes of byVariant.values()) {
      const eligibleCount = Math.floor(indexes.length / input.bundleQuantity) * input.bundleQuantity;
      for (const index of indexes.slice(0, eligibleCount)) {
        expanded[index].effectiveUnitPrice = effectiveBundleUnitPrice;
      }
    }
  } else {
    const eligibleCount = Math.floor(expanded.length / input.bundleQuantity) * input.bundleQuantity;
    for (let index = 0; index < eligibleCount; index += 1) {
      expanded[index].effectiveUnitPrice = effectiveBundleUnitPrice;
    }
  }

  return expanded;
}

function groupIndexes<T>(items: T[], keyFn: (item: T) => string) {
  const groups = new Map<string, number[]>();
  items.forEach((item, index) => {
    const key = keyFn(item);
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  return groups;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 5: Commit promotion helpers**

Run:

```powershell
git add src/lib/promoter/promotions.ts src/lib/promoter/promotions.test.ts
git commit -m "Add promoter promotion pricing"
```

## Task 4: Promoter Context And Stock APIs

**Files:**
- Create: `src/app/api/v1/promoter/context/route.ts`
- Create: `src/app/api/v1/promoter/stock/route.ts`

- [ ] **Step 1: Create promoter context API**

Create `src/app/api/v1/promoter/context/route.ts`:

```ts
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getAllowedPromoterLocationIds } from "@/lib/promoter/access";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        defaultLocation: true,
        temporaryLocations: { include: { location: true } },
      },
    });

    if (!user || user.role !== "PROMOTER") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Promoter access required" } }, { status: 403 });
    }

    const allowedIds = getAllowedPromoterLocationIds({
      now: new Date(),
      defaultLocationId: user.defaultLocationId,
      temporaryLocations: user.temporaryLocations,
    });

    return Response.json({
      data: {
        user: { id: user.id, name: user.name, email: user.email },
        defaultLocationId: user.defaultLocationId,
        allowedLocations: [
          user.defaultLocation,
          ...user.temporaryLocations.map((item) => item.location),
        ].filter((location): location is NonNullable<typeof location> => Boolean(location) && allowedIds.includes(location.id)),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: Create promoter stock API**

Create `src/app/api/v1/promoter/stock/route.ts`:

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getAllowedPromoterLocationIds } from "@/lib/promoter/access";
import { handleApiError } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { temporaryLocations: true },
    });
    if (!user || user.role !== "PROMOTER") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Promoter access required" } }, { status: 403 });
    }

    const url = new URL(request.url);
    const locationId = url.searchParams.get("locationId") ?? user.defaultLocationId;
    const search = url.searchParams.get("search")?.trim() ?? "";
    const allowedIds = getAllowedPromoterLocationIds({
      now: new Date(),
      defaultLocationId: user.defaultLocationId,
      temporaryLocations: user.temporaryLocations,
    });

    if (!locationId || !allowedIds.includes(locationId)) {
      return Response.json({ error: { code: "FORBIDDEN", message: "Location is not allowed" } }, { status: 403 });
    }

    const where: Prisma.StockLevelWhereInput = {
      ...(search
        ? {
            productVariant: {
              OR: [
                { sku: { contains: search, mode: "insensitive" } },
                { barcode: { contains: search, mode: "insensitive" } },
                { product: { name: { contains: search, mode: "insensitive" } } },
                { product: { skuPrefix: { contains: search, mode: "insensitive" } } },
              ],
            },
          }
        : {}),
    };

    const levels = await prisma.stockLevel.findMany({
      where,
      include: {
        location: { select: { id: true, name: true, type: true } },
        productVariant: {
          include: { product: { select: { id: true, name: true, skuPrefix: true } } },
        },
      },
      orderBy: [{ productVariant: { product: { skuPrefix: "asc" } } }, { productVariant: { sku: "asc" } }],
      take: 500,
    });

    return Response.json({
      data: levels.map((level) => ({
        productId: level.productVariant.product.id,
        productName: level.productVariant.product.name,
        parentSku: level.productVariant.product.skuPrefix,
        variantId: level.productVariant.id,
        sku: level.productVariant.sku,
        barcode: level.productVariant.barcode,
        color: level.productVariant.color,
        size: level.productVariant.size,
        locationId: level.locationId,
        locationName: level.location.name,
        isCurrentLocation: level.locationId === locationId,
        quantityOnHand: level.quantityOnHand,
        quantityReserved: level.quantityReserved,
        available: Math.max(0, level.quantityOnHand - level.quantityReserved),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 3: Run type check/build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Commit APIs**

Run:

```powershell
git add src/app/api/v1/promoter/context/route.ts src/app/api/v1/promoter/stock/route.ts
git commit -m "Add promoter context and stock APIs"
```

## Task 5: Promoter Sales API

**Files:**
- Create: `src/lib/promoter/sales.ts`
- Create: `src/app/api/v1/promoter/sales/route.ts`

- [ ] **Step 1: Implement promoter sale service**

Create `src/lib/promoter/sales.ts` with a transaction that:

```ts
// Required behavior:
// 1. Verify current user is PROMOTER.
// 2. Verify requested location is in allowed locations.
// 3. Create registered customer only when customer payload exists; require phone through validator.
// 4. Check stock at selected location using quantityOnHand - quantityReserved.
// 5. Create Order with status PROCESSING, paymentStatus PAID, paymentMethod "Consignment Partner".
// 6. Create OrderItems with final effective unit prices.
// 7. Deduct stock FIFO from batch rows and aggregate row.
// 8. Create OUTBOUND StockMovement rows with reason "PROMOTER_SALE".
// 9. Create audit log.
```

Use the existing stock deduction logic in `src/app/api/v1/orders/[id]/status/route.ts` as the reference, but keep the new helper focused so the promoter route is small.

- [ ] **Step 2: Create promoter sales API route**

Create `src/app/api/v1/promoter/sales/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { promoterSaleSchema } from "@/lib/validators/promoter";
import { createPromoterSale } from "@/lib/promoter/sales";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const parsed = promoterSaleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    const order = await createPromoterSale({
      userId: session.user.id,
      input: parsed.data,
    });

    return Response.json({ data: order }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PROMOTER_LOCATION_NOT_ALLOWED") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Location is not allowed" } }, { status: 403 });
    }
    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_STOCK:")) {
      return Response.json({ error: { code: "INSUFFICIENT_STOCK", message: error.message.slice(19) } }, { status: 409 });
    }
    return handleApiError(error);
  }
}
```

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Commit promoter sales API**

Run:

```powershell
git add src/lib/promoter/sales.ts src/app/api/v1/promoter/sales/route.ts
git commit -m "Add promoter sales API"
```

## Task 6: Promoter Returns And Leaderboard

**Files:**
- Create: `src/lib/promoter/returns.ts`
- Create: `src/lib/promoter/leaderboard.ts`
- Create: `src/lib/promoter/leaderboard.test.ts`
- Create: `src/app/api/v1/promoter/returns/route.ts`
- Create: `src/app/api/v1/promoter/leaderboard/route.ts`

- [ ] **Step 1: Write leaderboard net sales test**

Create `src/lib/promoter/leaderboard.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateNetLeaderboardAmount } from "./leaderboard";

describe("calculateNetLeaderboardAmount", () => {
  it("subtracts returns from monthly sales amount and quantity", () => {
    const result = calculateNetLeaderboardAmount({
      sales: [{ amount: 100, quantity: 2 }],
      returns: [{ amount: 50, quantity: 1 }],
    });

    assert.deepEqual(result, { amount: 50, quantity: 1 });
  });
});
```

- [ ] **Step 2: Implement leaderboard helper**

Create `src/lib/promoter/leaderboard.ts`:

```ts
export function calculateNetLeaderboardAmount(input: {
  sales: { amount: number; quantity: number }[];
  returns: { amount: number; quantity: number }[];
}) {
  const salesAmount = input.sales.reduce((sum, item) => sum + item.amount, 0);
  const salesQuantity = input.sales.reduce((sum, item) => sum + item.quantity, 0);
  const returnAmount = input.returns.reduce((sum, item) => sum + item.amount, 0);
  const returnQuantity = input.returns.reduce((sum, item) => sum + item.quantity, 0);

  return {
    amount: Math.max(0, salesAmount - returnAmount),
    quantity: Math.max(0, salesQuantity - returnQuantity),
  };
}
```

- [ ] **Step 3: Implement returns service and route**

Create `src/lib/promoter/returns.ts` with a transaction that:

```ts
// Required behavior:
// 1. Verify user is PROMOTER.
// 2. Load original order item and order.
// 3. Verify order was created by the promoter or belongs to promoter location.
// 4. Sum existing PromoterReturn quantity for the orderItemId.
// 5. Block if requested return exceeds remaining returnable quantity.
// 6. Create PromoterReturn.
// 7. Increment aggregate StockLevel quantityOnHand at order location.
// 8. Create RETURN StockMovement with reason "PROMOTER_RETURN".
// 9. Add audit log.
```

Create `src/app/api/v1/promoter/returns/route.ts` using `promoterReturnSchema` and `createPromoterReturn`.

- [ ] **Step 4: Implement leaderboard API**

Create `src/app/api/v1/promoter/leaderboard/route.ts` that:

```ts
// Required behavior:
// 1. Verify current user is PROMOTER.
// 2. Use current month unless ?month=YYYY-MM is supplied.
// 3. Find leaderboard groups that include the promoter default/current location.
// 4. Calculate each promoter's monthly order totals minus PromoterReturn totals.
// 5. Rank by net sales amount desc.
// 6. Include quantity sold and tier name.
```

- [ ] **Step 5: Run tests and build**

Run:

```powershell
npm run test:unit
npm run build
```

Expected: Both pass.

- [ ] **Step 6: Commit returns and leaderboard**

Run:

```powershell
git add src/lib/promoter/returns.ts src/lib/promoter/leaderboard.ts src/lib/promoter/leaderboard.test.ts src/app/api/v1/promoter/returns/route.ts src/app/api/v1/promoter/leaderboard/route.ts
git commit -m "Add promoter returns and leaderboard"
```

## Task 7: Transfer Requests And Notifications

**Files:**
- Create: `src/app/api/v1/promoter/transfers/route.ts`
- Modify: `src/app/api/v1/transfers/route.ts`

- [ ] **Step 1: Create promoter transfer request route**

Create `src/app/api/v1/promoter/transfers/route.ts`:

```ts
// POST behavior:
// 1. Validate promoterTransferRequestSchema.
// 2. Verify authenticated user is PROMOTER.
// 3. Verify toLocationId is one of promoter allowed locations.
// 4. Verify source location has enough stock.
// 5. Create StockTransfer with status REQUESTED.
// 6. Reserve source stock on aggregate row.
// 7. Create Notification rows for supervisors assigned to toLocationId.
// 8. Set escalatesAt to createdAt + 4 hours.
// 9. Create audit log.
```

- [ ] **Step 2: Extend transfer list for escalated visibility**

Modify `src/app/api/v1/transfers/route.ts` GET so:

```ts
// SUPERVISOR sees transfers for supervised locations.
// MANAGER and ADMIN see all transfers.
// PROMOTER sees their requested transfers only.
// A transfer with supervisor notifications past escalatesAt is visible to MANAGER and ADMIN.
```

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Commit transfer notifications**

Run:

```powershell
git add src/app/api/v1/promoter/transfers/route.ts src/app/api/v1/transfers/route.ts
git commit -m "Add promoter transfer requests"
```

## Task 8: Promoter UI And Navigation

**Files:**
- Create: `src/app/(dashboard)/promoter/layout.tsx`
- Create: `src/app/(dashboard)/promoter/sales/new/page.tsx`
- Create: `src/app/(dashboard)/promoter/returns/page.tsx`
- Create: `src/app/(dashboard)/promoter/stock/page.tsx`
- Create: `src/app/(dashboard)/promoter/transfers/page.tsx`
- Create: `src/app/(dashboard)/promoter/leaderboard/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add role-aware sidebar**

Modify `src/components/layout/sidebar.tsx` to read the session role and show promoter navigation for `PROMOTER`:

```ts
const promoterNavItems = [
  { title: "New Sale", href: "/promoter/sales/new", icon: <ShoppingCart className="h-5 w-5" /> },
  { title: "Returns", href: "/promoter/returns", icon: <Package className="h-5 w-5" /> },
  { title: "Stock", href: "/promoter/stock", icon: <Boxes className="h-5 w-5" /> },
  { title: "Transfers", href: "/promoter/transfers", icon: <Package className="h-5 w-5" /> },
  { title: "Leaderboard", href: "/promoter/leaderboard", icon: <LayoutDashboard className="h-5 w-5" /> },
];
```

When role is `PROMOTER`, render only `promoterNavItems`.

- [ ] **Step 2: Build promoter pages**

Each page will be a client component that fetches the matching `/api/v1/promoter/*` endpoint.

`/promoter/sales/new` must include:

```text
Barcode input focused by default
Manual search field
Current location selector only when multiple active allowed locations exist
Cart table for multiple items
Walk-in/registered customer toggle
Registered customer phone required
Submit button
```

`/promoter/stock` must include:

```text
Search by barcode/SKU/product
Current location stock band first
Other locations view-only below
Transfer request button on other-location stock
Parent SKU grouping with sub SKU rows
```

`/promoter/returns` must include:

```text
Original order search
Returnable item list
Quantity input capped by remaining returnable quantity
Submit return button
```

`/promoter/leaderboard` must include:

```text
Current month heading
Tier name
Rank
Promoter name
Location
Net sales amount
Net quantity
```

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: Build succeeds and no hydration errors appear from active navigation.

- [ ] **Step 4: Commit promoter UI**

Run:

```powershell
git add src/components/layout/sidebar.tsx src/app/(dashboard)/promoter
git commit -m "Add promoter workspace UI"
```

## Task 9: End-To-End Verification

**Files:**
- No new files required unless a bug is found.

- [ ] **Step 1: Reset local generated state**

Run:

```powershell
npm run db:generate
npm run db:push
npm run db:seed
```

Expected: seed completes and creates `promoter@bentop.com / promoter123`.

- [ ] **Step 2: Start dev server**

Run: `npm run dev`

Expected: app is available at `http://localhost:3000`.

- [ ] **Step 3: Manual browser verification**

Log in as:

```text
promoter@bentop.com
promoter123
```

Verify:

```text
Promoter sees only promoter menu.
New sale page opens.
Location is locked.
Barcode/manual search finds SKU.
Promoter can add multiple items.
Insufficient own-location stock blocks submit.
Sale submits and deducts stock.
Stock page shows own location first and other locations below.
Transfer request can be created from another location.
Return must link to original order.
Return adds stock back.
Leaderboard shows monthly net amount and quantity.
```

- [ ] **Step 4: Admin correction visibility**

Log in as:

```text
admin@bentop.com
admin123
```

Verify:

```text
Admin can see promoter sales in sales orders.
Admin can see stock movements.
Admin can see transfer requests.
Admin can see returns reflected in leaderboard/reporting.
```

- [ ] **Step 5: Final automated verification**

Run:

```powershell
npm run test:unit
npm run build
git status --short
```

Expected:

```text
Tests pass.
Build passes.
Working tree is clean.
```

- [ ] **Step 6: Commit any verification fixes**

If fixes were required:

```powershell
git add <changed-files>
git commit -m "Fix promoter workflow verification issues"
```

If no fixes were required, do not create an empty commit.
