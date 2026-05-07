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
