# Bentop ERP Growth Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow Bentop ERP from a consignment/promoter prototype into a reliable operating system for stock, sales, returns, consignment invoicing, purchasing, accounting follow-up, barcode/import-export, role permissions, and management reports.

**Architecture:** Build this in phases. Phase 1 stabilizes current workflows and must finish before adding purchase/accounting modules. Each later phase creates one business capability with its own schema, APIs, UI, tests, and smoke checklist updates.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, PostgreSQL, NextAuth, Docker Compose, Node test runner, existing `npm run test:unit`, `npm run test:erp`.

---

## Phase Order

1. Stabilize stock, sales, returns, and consignment invoice.
2. Add purchase and receiving.
3. Add accounting/payment tracking for partner invoices.
4. Add barcode and import/export.
5. Tighten role permissions.
6. Add richer reports.

Phase 1 is the recommended next implementation phase.

---

## Phase 1: Stabilize Stock, Sales, Returns, And Consignment Invoice

### Task 1: Stock Reservation Consistency

**Files:**
- Modify: `src/lib/promoter/sales.ts`
- Modify: `src/app/api/v1/promoter/sales/route.ts`
- Modify: `src/app/api/v1/transfers/route.ts`
- Modify: `src/app/api/v1/transfers/[id]/route.ts`
- Test: `src/lib/promoter/sales.test.ts`
- Test: create `src/lib/inventory/reservation.test.ts`
- Create: `src/lib/inventory/reservation.ts`

- [ ] **Step 1: Add reservation tests**

Create tests for:
- Duplicate same sub SKU in one sale combines quantity before checking stock.
- Sale available quantity uses `quantityOnHand - quantityReserved`.
- Transfer request reserves stock immediately.
- Second transfer cannot reserve already reserved stock.
- Transfer completion rechecks stock before moving it.

Run:

```powershell
npm run test:unit
```

Expected before implementation: at least one new reservation test fails.

- [ ] **Step 2: Add reservation helper**

Create `src/lib/inventory/reservation.ts` with functions:
- `calculateAvailableStock(quantityOnHand: number, quantityReserved: number): number`
- `assertEnoughAvailableStock(available: number, requested: number): void`
- `mergeRequestedQuantities<T extends { productVariantId: string; quantity: number }>(items: T[]): Map<string, number>`

- [ ] **Step 3: Use helper in promoter sales**

Update `src/lib/promoter/sales.ts` so:
- Same `productVariantId` lines are combined for stock validation.
- Stock validation uses available stock after reserved quantity.
- Error remains `INSUFFICIENT_STOCK:<message>` for API compatibility.

- [ ] **Step 4: Use helper in transfers**

Update transfer creation/completion so:
- Requested transfers increase reserved stock.
- Cancellation releases reserved stock.
- Completion deducts reserved stock and increases destination stock.
- Completion fails if source stock changed and cannot cover the request.

- [ ] **Step 5: Verify**

Run:

```powershell
npm run test:unit
npx tsc --noEmit
npm run test:erp
```

Expected: all pass.

### Task 2: Promoter Return State And Net Sales

**Files:**
- Modify: `src/lib/promoter/returns.ts`
- Modify: `src/lib/promoter/sales.ts`
- Modify: `src/app/api/v1/promoter/returns/route.ts`
- Test: `src/lib/promoter/sales.test.ts`
- Test: create `src/lib/promoter/returns.test.ts`

- [ ] **Step 1: Add return tests**

Test:
- Partial return keeps order as active but shows returned line quantity.
- Full return sets order status to `RETURNED`.
- Sales history shows gross, returned, and net values.
- Return cannot exceed remaining returnable quantity.
- Return adds stock back to the same sale location.

- [ ] **Step 2: Update return logic**

Update `createPromoterReturn` so it:
- Creates `PromoterReturn`.
- Restocks aggregate stock.
- Updates order status to `RETURNED` only when all order items are fully returned.
- Keeps `PaymentStatus` consistent with returned amount.

- [ ] **Step 3: Verify UI still reads net sales**

Check `src/app/(dashboard)/promoter/sales/page.tsx` still uses:
- `returnedAmount`
- `netAmount`
- `returnedQuantity`
- `netQuantity`

- [ ] **Step 4: Verify**

Run:

```powershell
npm run test:unit
npm run test:erp
```

Expected: all pass.

### Task 3: Consignment Report And Invoice Consistency

**Files:**
- Modify: `src/app/api/v1/consignment/shipments/[id]/reports/route.ts`
- Modify: `src/lib/consignment/finalize-report.ts`
- Modify: `src/app/api/v1/reports/consignment/route.ts`
- Test: `src/lib/consignment/finalize-report.test.ts`
- Test: `src/lib/consignment/commission.test.ts`

- [ ] **Step 1: Add invoice consistency tests**

Test:
- Report line commission uses actual final selling price.
- Product override applies when variant override does not exist.
- Variant override wins over product override.
- Finalized invoice totals equal report totals.
- `/api/v1/reports/consignment` summary uses finalized report/invoice data when available.

- [ ] **Step 2: Update report summary**

Change `/api/v1/reports/consignment` so management totals come from finalized report/invoice line snapshots where possible, not only shipment default commission rate.

- [ ] **Step 3: Add dated sales/returns clarity**

Ensure report data returned to UI includes:
- `periodStart`
- `periodEnd`
- `quantitySold`
- `quantityReturned`
- `grossAmount`
- `commissionAmount`
- `netAmount`

- [ ] **Step 4: Verify**

Run:

```powershell
npm run test:unit
npm run test:erp
```

Expected: all pass.

### Task 4: Phase 1 Human Regression Checklist

**Files:**
- Modify: `docs/erp-testing-agent.md`
- Modify: `scripts/erp-smoke-test.mjs`

- [ ] **Step 1: Add Phase 1 manual sign-off section**

Update checklist with:
- Duplicate sub SKU sale test.
- Transfer reservation test.
- Partial return and full return test.
- Consignment invoice total comparison test.

- [ ] **Step 2: Add non-destructive smoke checks**

Extend `scripts/erp-smoke-test.mjs` to GET:
- `/api/v1/promoter/sales?limit=5`
- `/api/v1/promoter/stock`
- `/api/v1/reports/consignment`
- `/api/v1/stock-levels?pageSize=5`

These already exist in the current smoke runner; keep them after refactors.

- [ ] **Step 3: Verify**

Run:

```powershell
npm run test:erp
```

Expected: 45/45 or higher pass count.

---

## Phase 2: Purchase And Receiving

### Task 5: Supplier And Purchase Order Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`
- Create: `src/lib/validators/purchase.ts`
- Create: `src/app/api/v1/suppliers/route.ts`
- Create: `src/app/api/v1/suppliers/[id]/route.ts`
- Create: `src/app/api/v1/purchase-orders/route.ts`
- Create: `src/app/api/v1/purchase-orders/[id]/route.ts`
- Create: `src/app/api/v1/purchase-orders/[id]/receive/route.ts`

- [ ] **Step 1: Add models**

Add models:
- `Supplier`
- `PurchaseOrder`
- `PurchaseOrderItem`
- `PurchaseReceipt`
- `PurchaseReceiptItem`

Use statuses:
- `DRAFT`
- `ORDERED`
- `PARTIAL_RECEIVED`
- `RECEIVED`
- `CANCELLED`

- [ ] **Step 2: Add validators**

Create schemas for:
- Supplier create/update.
- Purchase order create/update.
- Receive purchase order.

- [ ] **Step 3: Add APIs**

API behavior:
- Admin/Manager can create supplier and purchase order.
- Receiving stock creates `Batch`, `StockLevel`, and `StockMovement`.
- Received cost becomes batch cost.

- [ ] **Step 4: Verify**

Run:

```powershell
npm run db:generate
npx tsc --noEmit
npm run test:unit
```

Expected: all pass.

### Task 6: Purchase UI

**Files:**
- Create: `src/app/(dashboard)/purchases/page.tsx`
- Create: `src/app/(dashboard)/purchases/suppliers/page.tsx`
- Create: `src/app/(dashboard)/purchases/orders/page.tsx`
- Create: `src/app/(dashboard)/purchases/orders/new/page.tsx`
- Create: `src/app/(dashboard)/purchases/orders/[id]/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/mobile-nav.tsx`

- [ ] **Step 1: Add purchase navigation**

Add sidebar group for:
- Suppliers
- Purchase orders
- Receiving

- [ ] **Step 2: Add supplier list**

Show supplier name, contact, phone, email, active status.

- [ ] **Step 3: Add purchase order form**

Allow selecting supplier, expected date, variant items, quantities, cost.

- [ ] **Step 4: Add receive action**

Receiving should create stock into selected warehouse.

- [ ] **Step 5: Verify**

Run:

```powershell
npm run build
npm run test:erp
```

Expected: build and smoke pass.

---

## Phase 3: Accounting And Partner Invoice Payments

### Task 7: Payment Tracking Schema And API

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/validators/accounting.ts`
- Create: `src/app/api/v1/consignment/invoices/[id]/payments/route.ts`
- Modify: `src/app/(dashboard)/consignment/invoices/[id]/page.tsx`

- [ ] **Step 1: Add payment model**

Add `ConsignmentInvoicePayment` with:
- `invoiceId`
- `paymentDate`
- `amount`
- `paymentMethod`
- `reference`
- `notes`
- `createdById`

- [ ] **Step 2: Update invoice status rules**

Rules:
- No payments: `ISSUED`
- Partial payments: `ISSUED` with outstanding amount displayed
- Fully paid: `PAID`
- Void invoice cannot accept payment

- [ ] **Step 3: Add invoice payment UI**

Invoice detail should show:
- Gross amount
- Commission amount
- Net amount
- Paid amount
- Outstanding amount
- Payment history

- [ ] **Step 4: Verify**

Run:

```powershell
npm run db:generate
npx tsc --noEmit
npm run test:unit
npm run test:erp
```

Expected: all pass.

---

## Phase 4: Barcode And Import/Export

### Task 8: Barcode Workflows

**Files:**
- Modify: `src/components/inventory/variant-picker.tsx`
- Modify: `src/app/(dashboard)/promoter/sales/new/page.tsx`
- Modify: `src/components/sales/order-form-client.tsx`
- Create: `src/lib/barcode.ts`
- Test: create `src/lib/barcode.test.ts`

- [ ] **Step 1: Add barcode lookup helper**

Lookup should match:
- Exact sub SKU.
- Exact barcode.
- Case-insensitive SKU fallback.

- [ ] **Step 2: Add scan input**

Promoter sale and admin order forms should let user scan barcode and add item quickly.

- [ ] **Step 3: Verify**

Run:

```powershell
npm run test:unit
npm run build
```

Expected: all pass.

### Task 9: CSV Import/Export

**Files:**
- Create: `src/lib/import-export/csv.ts`
- Create: `src/app/api/v1/import/products/route.ts`
- Create: `src/app/api/v1/export/stock/route.ts`
- Create: `src/app/api/v1/export/consignment-invoices/route.ts`
- Test: create `src/lib/import-export/csv.test.ts`

- [ ] **Step 1: Add CSV parser/serializer helpers**

Support:
- Product import.
- Variant import.
- Stock export.
- Consignment invoice export.

- [ ] **Step 2: Add safe validation**

Invalid import rows should return row number and reason.

- [ ] **Step 3: Verify**

Run:

```powershell
npm run test:unit
npm run build
```

Expected: all pass.

---

## Phase 5: Tighten Role Permissions

### Task 10: Central Permission Policy

**Files:**
- Create: `src/lib/permissions.ts`
- Test: create `src/lib/permissions.test.ts`
- Modify: API routes under `src/app/api/v1`

- [x] **Step 1: Define permission matrix**

Roles:
- `ADMIN`: full access.
- `MANAGER`: operations and reports.
- `SUPERVISOR`: supervised locations and transfer handling.
- `STAFF`: limited HQ operations.
- `PROMOTER`: assigned/temporary locations only.
- `VIEWER`: read-only safe reports.

- [x] **Step 2: Add helper functions**

Create:
- `canManageProducts(role)`
- `canManageStock(role)`
- `canViewLocationStock(user, locationId)`
- `canCreatePromoterSale(user, locationId)`
- `canManageTransfer(user, transfer)`
- `canManageConsignment(role)`
- `canViewReports(role)`

- [x] **Step 3: Apply route guards**

Apply to:
- Products
- Stock
- Transfers
- Orders
- Consignment
- Reports
- Promoter APIs

- [x] **Step 4: Verify role tests**

Add tests proving:
- Promoter cannot access unrelated stock.
- Supervisor cannot change unrelated location.
- Viewer cannot mutate.
- Admin can mutate.

Run:

```powershell
npm run test:unit
npm run test:erp
```

Expected: all pass.

---

## Phase 6: Richer Reports

### Task 11: Report Data Services

**Files:**
- Create: `src/lib/reports/inventory.ts`
- Create: `src/lib/reports/sales.ts`
- Create: `src/lib/reports/consignment.ts`
- Create: `src/lib/reports/promoter.ts`
- Modify: `src/app/api/v1/reports/inventory/route.ts`
- Modify: `src/app/api/v1/reports/sales/route.ts`
- Modify: `src/app/api/v1/reports/consignment/route.ts`

- [ ] **Step 1: Extract report services**

Reports should support:
- Date range.
- Location filter.
- Partner filter.
- Product/parent SKU filter.
- Sub SKU filter.

- [ ] **Step 2: Add report totals**

Inventory:
- On hand
- Reserved
- Available
- Low stock
- Stock aging

Sales:
- Gross
- Discount
- Returns
- Net
- Quantity

Consignment:
- Shipped
- Sold
- Returned
- Gross
- Commission
- Net payable
- Outstanding invoice amount

Promoter:
- Gross sales
- Returns
- Net sales
- Rank
- Tier

- [ ] **Step 3: Verify**

Run:

```powershell
npm run test:unit
npm run test:erp
```

Expected: all pass.

### Task 12: Report UI And Export

**Files:**
- Modify: `src/app/(dashboard)/inventory/reports/page.tsx`
- Modify: `src/app/(dashboard)/sales/reports/page.tsx`
- Modify: `src/app/(dashboard)/consignment/reports/page.tsx`
- Create: `src/app/(dashboard)/promoter/reports/page.tsx`

- [ ] **Step 1: Add filters**

Each report page should support:
- Date range.
- Location.
- Product/SKU.
- Partner where applicable.

- [ ] **Step 2: Add export buttons**

Export:
- CSV first.
- PDF later only after CSV is stable.

- [ ] **Step 3: Verify**

Run:

```powershell
npm run build
npm run test:erp
```

Expected: all pass.

---

## Execution Recommendation

Start with Phase 1 only. Do not begin purchase/accounting until stock reservation, promoter returns, and consignment invoice consistency are proven by tests.

Recommended next command sequence before Phase 1:

```powershell
npm run test:unit
npx tsc --noEmit
npm run test:erp
```

Expected baseline:
- Unit tests pass.
- TypeScript passes.
- ERP smoke test passes.
