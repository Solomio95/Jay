# Bentop ERP Testing Agent

This playbook turns the ERP into a repeatable QA routine. Use it before pushing changes, after restoring the database, and before promoters or HQ users try new workflows.

## Fast Agent Command

Run the non-destructive smoke agent against a running local server:

```powershell
npm run test:erp
```

By default it checks `http://localhost:3000`. To test another server:

```powershell
$env:ERP_BASE_URL="http://localhost:3001"; npm run test:erp
```

Default test logins:

- Admin: `admin@bentop.com` / `admin123`
- Promoter: `promoter@bentop.com` / `promoter123`
- Supervisor: `supervisor@bentop.com` / `supervisor123`

The smoke agent does not create sales, returns, stock transfers, partners, or invoices. It only verifies login, page rendering, authenticated API responses, and basic role protection.

## QA Agent Personas

Admin agent:
- Checks product setup, parent SKU and sub SKU search, categories, locations, stock levels, stock in/out, stock adjustments, transfers, sales orders, reports, and settings.
- Confirms HQ prices are configured at sub SKU level before promoter testing.

Promoter agent:
- Logs in as a promoter and checks assigned location context.
- Tests stock search, new sale, pending stock decrease in cart, HQ price lock, auto promotion price, consignment payment method, return flow, sales history net after returns, leaderboard, and transfer requests.

Supervisor agent:
- Reviews transfer requests from promoters.
- Confirms requests are visible by location, stock is reserved while pending, and unresolved requests can be escalated after the configured duration.

Consignment agent:
- Checks partners, commission tiers, product and variant overrides, shipments, consignment stock, dated sales and returns reports, finalization, and invoices.
- Verifies totals appear at the top and detailed parent SKU/sub SKU/location rows appear below.

## Full Manual Test Matrix

Use this checklist when you want a human to test the ERP. The automated smoke test checks that pages and APIs load, but these items need a person because they involve business meaning, screen clarity, invoice correctness, and real-world workflow decisions.

## Human Testing Checklist

### Before Testing

- [ ] Docker Desktop is running.
- [ ] Local database is running.
- [ ] App is open at `http://localhost:3000/login`.
- [ ] You know which database you are testing: demo data, copied real data, or fresh empty data.
- [ ] You have test logins for Admin, Promoter, and Supervisor.
- [ ] You have at least one test product with parent SKU and sub SKU.
- [ ] You have at least one consignment location with stock.
- [ ] You have at least one consignment partner with commission tiers.
- [ ] You have at least one promoter assigned to a consignment location.

### Admin Setup

- [ ] Login as Admin.
- [ ] Confirm the dashboard loads without error.
- [ ] Open `/inventory/products`.
- [ ] Search by product name.
- [ ] Search by parent SKU.
- [ ] Search by sub SKU.
- [ ] Open one product and confirm variants are visible.
- [ ] Confirm each sub SKU has selling price set by HQ.
- [ ] Confirm product and variant names are understandable for real staff.
- [ ] Open `/inventory/locations`.
- [ ] Confirm consignment locations are active and correctly named.
- [ ] Open `/inventory/stock`.
- [ ] Filter by location.
- [ ] Filter by product or SKU.
- [ ] Confirm stock on hand, reserved, and available quantity look correct.

### Consignment Stock

- [ ] Open `/consignment/stock`.
- [ ] Confirm top summary totals are easy to understand.
- [ ] Confirm parent SKU/product rows appear first.
- [ ] Confirm sub SKU/location detail rows appear below each parent product.
- [ ] Search by parent SKU.
- [ ] Search by sub SKU.
- [ ] Search by partner name.
- [ ] Search by location name.
- [ ] Filter by partner.
- [ ] Filter by location.
- [ ] Confirm the page is still usable when many locations exist.
- [ ] Confirm stock shown here matches `/inventory/stock` for the same location and SKU.

### Consignment Partner And Commission

- [ ] Open `/consignment/partners`.
- [ ] Confirm partner contact details are correct.
- [ ] Confirm payment terms are correct.
- [ ] Confirm commission tiers are correct.
- [ ] Test price below RM50 uses Super Best Buy tier.
- [ ] Test price RM50 to RM109 uses Best Buy tier.
- [ ] Test price RM110 and above uses Normal tier.
- [ ] Confirm discounted final selling price changes the tier correctly.
- [ ] Confirm product-specific override works.
- [ ] Confirm sub-SKU-specific override works.

### Consignment Shipment

- [ ] Open `/consignment/shipments/new`.
- [ ] Select source warehouse.
- [ ] Select consignment partner.
- [ ] Confirm partner location fills correctly.
- [ ] Add multiple sub SKUs.
- [ ] Confirm shipped quantity cannot exceed available stock.
- [ ] Save draft shipment.
- [ ] Ship the shipment.
- [ ] Confirm source stock decreases.
- [ ] Confirm consignment location stock increases.
- [ ] Open shipment detail page and confirm status is correct.

### Consignment Sales, Returns, And Invoice

- [ ] Open a shipped consignment shipment.
- [ ] Create a sales and returns report for a date range.
- [ ] Enter sold quantity for at least one item.
- [ ] Enter returned quantity for at least one item.
- [ ] Confirm sold and returned quantities are shown separately.
- [ ] Confirm report date range is correct.
- [ ] Confirm commission tier uses actual final selling price.
- [ ] Confirm gross amount is correct.
- [ ] Confirm commission amount is correct.
- [ ] Confirm net amount payable to Bentop is correct.
- [ ] Finalize the report.
- [ ] Confirm invoice is created.
- [ ] Open `/consignment/invoices`.
- [ ] Open invoice detail.
- [ ] Confirm invoice date and due date are correct.
- [ ] Confirm invoice lines match the report.
- [ ] Confirm returned stock is handled correctly.

### Promoter Login And Location Lock

- [ ] Login as Promoter.
- [ ] Confirm promoter does not see confusing HQ-only menu items.
- [ ] Open `/promoter/sales/new`.
- [ ] Confirm promoter's default location is selected.
- [ ] Confirm sale location cannot be changed to unauthorized locations.
- [ ] Confirm temporary covered location appears only if HQ assigned it.
- [ ] Confirm expired temporary location does not appear.

### Promoter Stock View

- [ ] Open `/promoter/stock`.
- [ ] Search by product name.
- [ ] Search by parent SKU.
- [ ] Search by sub SKU.
- [ ] Confirm current location stock is easy to see.
- [ ] Confirm available stock is clear.
- [ ] Confirm pending or reserved stock is clear.
- [ ] Confirm other-location stock, if shown, is only for transfer request purpose.
- [ ] Confirm promoter cannot directly edit stock.

### Promoter New Sale

- [ ] Open `/promoter/sales/new`.
- [ ] Search and select a sub SKU.
- [ ] Confirm selling price is filled from HQ setting.
- [ ] Confirm promoter cannot manually key selling price.
- [ ] Add item to cart.
- [ ] Confirm available stock visually decreases as pending before submit.
- [ ] Add multiple items in one order.
- [ ] Test active promotion, such as 2 for RM100.
- [ ] Confirm final deal price per unit is used for commission and reporting.
- [ ] Confirm payment method is Consignment Partner only for consignment locations.
- [ ] Submit sale.
- [ ] Confirm sale becomes final immediately.
- [ ] Confirm stock decreases after submit.
- [ ] Confirm sale appears in sales history.

### Promoter Return

- [ ] Open `/promoter/returns`.
- [ ] Search a sale by order number, customer, or SKU.
- [ ] Return one item.
- [ ] Confirm return succeeds.
- [ ] Confirm returned quantity appears on the sale.
- [ ] Confirm stock increases back.
- [ ] Try returning more than sold quantity.
- [ ] Confirm system blocks over-return.
- [ ] Open `/promoter/sales`.
- [ ] Confirm returned amount is deducted.
- [ ] Confirm net sales amount is correct.

### Promoter Sales History

- [ ] Open `/promoter/sales`.
- [ ] Filter by today.
- [ ] Filter by date range.
- [ ] Search by order number.
- [ ] Search by SKU.
- [ ] Confirm gross sales are shown.
- [ ] Confirm returned amount is shown.
- [ ] Confirm net sales after return is shown.
- [ ] Confirm customer name is optional but saved if entered.
- [ ] Confirm customer is recorded with promoter and location.

### Promoter Leaderboard

- [ ] Open `/promoter/leaderboard`.
- [ ] Confirm monthly leaderboard is shown.
- [ ] Confirm tier group is shown.
- [ ] Confirm monthly sales amount matches sales history net amount.
- [ ] Confirm returned sales are deducted.
- [ ] Confirm location grouping is correct.
- [ ] Confirm tier thresholds match HQ setup.

### Promoter Transfer Request

- [ ] Open `/promoter/stock`.
- [ ] Find a product available at another location.
- [ ] Create transfer request.
- [ ] Confirm requested quantity becomes reserved or pending.
- [ ] Login as Supervisor.
- [ ] Confirm Supervisor can see the request.
- [ ] Confirm Supervisor can approve or act on the request.
- [ ] Confirm unresolved request should escalate after 4 hours.
- [ ] Confirm stock does not disappear incorrectly during transfer.

### Supervisor Testing

- [ ] Login as Supervisor.
- [ ] Open transfer requests.
- [ ] Confirm only relevant location requests are visible.
- [ ] Approve a transfer request.
- [ ] Complete a transfer request.
- [ ] Confirm source stock decreases.
- [ ] Confirm destination stock increases.
- [ ] Confirm promoter can see the updated stock.

### Access And Safety

- [ ] As Promoter, try opening `/inventory`.
- [ ] As Promoter, try opening `/sales/orders`.
- [ ] As Promoter, try opening `/consignment`.
- [ ] Confirm access is blocked or safely scoped.
- [ ] As Supervisor, confirm they cannot change unrelated HQ setup.
- [ ] As wrong user, confirm no other promoter's sales can be changed.
- [ ] Logout and confirm protected pages redirect to login.

### Human Sign-Off

- [ ] Admin setup looks correct.
- [ ] Promoter sale flow is easy enough for real promoter use.
- [ ] Promoter return flow is understandable.
- [ ] Consignment stock is clear for many locations.
- [ ] Sales and returns report is usable for opening invoice.
- [ ] Commission calculation matches Bentop business rules.
- [ ] Invoice amount matches expected collection from partner.
- [ ] No confusing or unnecessary page is visible to the wrong role.
- [ ] Tester name:
- [ ] Test date:
- [ ] Notes or issues found:

### Auth And Setup

1. Start the server with `npm run dev`.
2. Visit `/login`.
3. Sign in with Admin, Promoter, and Supervisor accounts.
4. Expected:
   - Valid users reach their proper dashboard.
   - Wrong password stays on login.
   - Logged-out protected pages redirect to `/login`.
   - Promoter cannot access HQ-only data pages.

### Inventory And SKU

1. Open `/inventory/products`.
2. Search by parent SKU, product name, and sub SKU.
3. Open a product and check variants.
4. Open `/inventory/stock`.
5. Filter by product, sub SKU, and location.
6. Expected:
   - Parent SKU groups variants clearly.
   - Sub SKU color and size are visible.
   - Each location stock is searchable.
   - On hand, reserved, and available quantities are consistent.

### Promoter Sale

1. Login as promoter.
2. Open `/promoter/sales/new`.
3. Search a sub SKU with available stock at the promoter's assigned location.
4. Add item to cart.
5. Expected:
   - Selling price comes from HQ product variant setup.
   - Promoter cannot manually key selling price.
   - Active location-specific promotion applies automatically.
   - Cart shows pending quantity so available stock is reduced visually before submit.
   - Payment method is Consignment Partner.
6. Submit sale.
7. Expected:
   - Order is created as final.
   - Stock decreases immediately.
   - Sale appears in `/promoter/sales`.

### Promoter Return

1. Open `/promoter/returns`.
2. Search a promoter sale.
3. Return one item.
4. Expected:
   - Return creates a return record.
   - Stock increases back at the sale location.
   - Same item cannot be returned above original sold quantity.
   - `/promoter/sales` shows returned quantity, returned amount, and net sales after minus return.

### Promoter Leaderboard

1. Open `/promoter/leaderboard`.
2. Change month.
3. Compare with promoter sales history for the same month.
4. Expected:
   - Monthly sales are net of returns.
   - Promoters are grouped by HQ tier setting.
   - Tier boundaries match HQ setup.

### Promoter Transfer Request

1. Open `/promoter/stock`.
2. Find stock available at another location.
3. Request transfer to the promoter's assigned location.
4. Expected:
   - Transfer status is Requested.
   - Requested stock becomes reserved.
   - Supervisor can see and act on the request.
   - Request escalates after 4 hours if not handled.

### Consignment Partner Setup

1. Open `/consignment/partners`.
2. Create or edit a partner.
3. Configure tiers:
   - Super Best Buy: below RM 50
   - Best Buy: RM 50 to RM 109
   - Normal: RM 110 and above
4. Add product or variant override if needed.
5. Expected:
   - Commission tier is based on final selling price after discount.
   - Variant override wins over product override.

### Consignment Stock

1. Open `/consignment/stock`.
2. Search partner name, location, parent SKU, and sub SKU.
3. Expected:
   - Top metrics show total units, active locations, products, and reserved.
   - Detail table groups by parent SKU/product.
   - Sub SKU rows show location and linked partner.
   - Works with many locations without losing search/filter clarity.

### Consignment Sales, Returns, And Invoice

1. Create a consignment shipment.
2. Ship it to a consignment location.
3. Record dated sales and dated returns.
4. Create report for a period.
5. Finalize report.
6. Expected:
   - Sales and return quantities are separated by date in the report flow.
   - Commission uses the correct tier or override.
   - Invoice shows gross amount, commission amount, and net amount payable back to Bentop.
   - Returned stock is added back to the correct location.

## Known High-Risk Scenarios To Automate Next

- Duplicate same sub SKU in one promoter cart should combine quantity for stock validation and promotion pricing.
- Two promoters selling the last unit at the same time should not oversell.
- Return processed by a different promoter should subtract from the original seller's leaderboard.
- Transfer detail and action APIs should only allow the requester, supervisor, manager, or admin with valid location access.
- Consignment `record-sales` should never increase sold quantity if stock deduction fails.
- Consignment summary report should match finalized invoice commission, including tiers and overrides.
