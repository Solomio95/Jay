# Barcode Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PDF barcode label generator for 35 mm x 25 mm Bentop Collection product tag stickers.

**Architecture:** Add a focused PDF generation library in `src/lib`, expose it through a protected API route, and add an Inventory page that reuses the existing variant picker and bulk SKU/barcode adder. No database schema change is needed.

**Tech Stack:** Next.js App Router, Prisma, React client component, `pdf-lib`, `bwip-js`, Node test runner.

---

### Task 1: PDF Generator

**Files:**
- Create: `src/lib/barcode-labels.ts`
- Create: `src/lib/barcode-labels.test.ts`

- [ ] Write failing tests for 35 mm x 25 mm PDF page size, copies, and missing barcode validation.
- [ ] Install `pdf-lib` and `bwip-js`.
- [ ] Implement `buildBarcodeLabelPdf` and `assertLabelsHaveBarcodes`.
- [ ] Run `npm run test:unit`.

### Task 2: API Route

**Files:**
- Create: `src/app/api/v1/barcode-labels/route.ts`

- [ ] Validate selected variant IDs and copy counts.
- [ ] Block unauthenticated and non-stock-management roles.
- [ ] Fetch active variants and reject missing barcodes.
- [ ] Return `application/pdf` with a dated filename.

### Task 3: Inventory UI

**Files:**
- Create: `src/components/inventory/barcode-label-generator-client.tsx`
- Create: `src/app/(dashboard)/inventory/barcodes/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`

- [ ] Add variant search and bulk add controls.
- [ ] Add copy quantity controls and missing barcode warnings.
- [ ] POST selected variants to the API and download the PDF.
- [ ] Add `Barcode Labels` under Inventory navigation.

### Task 4: Verification

- [ ] Run `npm run lint`.
- [ ] Run `npm run test:unit`.
- [ ] Run `npm run build`.
- [ ] Check git diff and commit the finished feature.
