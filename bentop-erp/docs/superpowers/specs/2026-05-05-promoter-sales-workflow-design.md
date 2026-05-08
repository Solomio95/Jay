# Promoter Sales Workflow Design

## Purpose

Bentop needs a promoter workflow for consignment locations. Promoters should log in with their own accounts, key in final sales and returns for their assigned location, view stock clearly, request transfers, and see monthly leaderboard performance. HQ, managers, and admins must still be able to review and correct records for invoice/reporting.

## Roles And Access

Add two roles:

- `PROMOTER`
- `SUPERVISOR`

Existing admin and manager roles remain for HQ control.

Promoters have a default location. HQ may assign temporary cover locations with a start date and end date. When a promoter is using the system, the sale location is locked to the default location unless there is an active temporary cover location. If active cover locations exist, the promoter can choose only from the allowed locations. Expired cover locations are automatically unavailable.

The server must enforce the same location restrictions as the UI. A promoter cannot bypass location locking from the browser or API.

Supervisors are assigned by location. Transfer requests from a promoter's current location notify that location's supervisor first. If no action is taken within four hours, the request becomes visible to managers and admins as escalated.

## Promoter Sales

Create a dedicated promoter sales screen at `/promoter/sales/new`.

Sales rules:

- Date is fixed to today.
- Location is locked to the promoter's current allowed location.
- Product entry prioritizes barcode scan.
- Manual search supports barcode, sub SKU, parent SKU, and product name.
- Multiple items can be added to one order.
- The system shows stock from all locations, but only current location stock can be sold.
- If current location stock is insufficient, the sale is blocked.
- Cash is not accepted.
- Consignment location payment method is fixed as `Consignment Partner`.
- Promoter sales become final immediately after submit.
- Stock deducts immediately after submit.
- HQ/admin can correct mistakes later.
- Promoters cannot edit finalized sales.

Customer rules:

- Walk-in sales are allowed without customer details.
- Registered customers require a phone number.
- Registered customers are automatically tagged with the promoter and location that registered them.

The implementation should save real sales through the existing order and stock system so HQ reports, consignment reports, invoices, inventory, and audit records stay connected.

## Promotions And Commission

HQ manages location-specific promotions.

Promotion setup includes:

- Promotion name
- Start date
- End date
- Allowed locations
- Allowed products, parent SKUs, or sub SKUs
- Promotion type, such as `2 for RM100`
- Rule mode: same SKU only or mix-and-match selected items

A promoter can only use a promotion when:

- Today is inside the promotion date range.
- The selected location is included.
- The selected item combination matches the promotion rule.

Commission and reports use the final effective unit price after promotion. For example, if a product normally sells for RM59.90 and the customer buys under a `2 for RM100` promotion, the effective unit price is RM50.00. Commission tier selection uses RM50.00.

## Promoter Returns

Create a dedicated promoter return screen at `/promoter/returns`.

Return rules:

- Promoter returns must link to an original sale/order.
- The promoter chooses the item and quantity to return.
- Return quantity cannot exceed sold quantity minus already returned quantity.
- Returns become final immediately after submit.
- Stock adds back to the same location immediately.
- HQ/admin can correct mistakes later.
- HQ/admin can create manual returns without an original sale when needed.
- Returns reduce promoter KPI and monthly leaderboard totals.

Example: if a promoter has RM100 sales in May and RM100 returns in May, May net KPI sales becomes RM0.

## Stock And Transfer Requests

Create a dedicated promoter stock screen at `/promoter/stock`.

The screen shows:

- Current location stock clearly at the top.
- Other locations' stock below as view-only.
- Parent SKU grouping with sub SKU details.
- Search by barcode, sub SKU, parent SKU, and product name.

If current location stock is insufficient but another location has stock, the promoter can request a transfer.

Transfer request flow:

1. Promoter requests stock transfer.
2. Location supervisor receives an ERP notification first.
3. If the supervisor does not act within four hours, managers and admins can see the escalated request.
4. Supervisor, manager, or admin approves or rejects.
5. Approved requests follow the existing stock transfer workflow.

External WhatsApp notifications are intentionally out of scope for the first version. The first version uses ERP notifications only.

## Monthly Leaderboard

Create a promoter leaderboard screen at `/promoter/leaderboard`.

Leaderboard rules:

- Monthly only.
- Ranked by sales amount.
- Quantity sold is also shown.
- Returns reduce sales amount and quantity.
- HQ controls comparison groups.
- HQ controls tier ranges.
- A promoter's tier is based on their own monthly sales amount.

Example tier configuration:

- RM1 to RM10,000
- RM10,001 to RM50,000
- RM50,001 to RM150,000

## Recommended Architecture

Use a dedicated promoter module for the UI and workflow, but keep the records connected to the existing order, stock, and transfer system.

This means promoter sales should still create normal `Order` and `OrderItem` records. Stock deductions and returns should use the same stock-level and movement concepts used by the rest of the ERP. This avoids having one sales system for HQ and another separate sales system for promoters.

New data relationships are needed for:

- User default location
- User temporary location coverage
- Location supervisor assignment
- Registered customer promoter/location attribution
- Location-specific promotions
- Promotion line/effective unit pricing
- Return linkage to original order items
- ERP notifications for transfer requests and escalation
- Leaderboard groups and tiers

## Testing Scope

The feature should be tested with at least:

- Promoter login and restricted navigation.
- Locked default location.
- Temporary cover location active and expired behavior.
- Barcode and manual SKU search.
- Multi-item sale.
- Insufficient own-location stock blocking.
- Other-location stock view and transfer request.
- Supervisor approval and four-hour escalation visibility.
- Location-specific promotion availability and expiry.
- Same-SKU and mix-and-match promotion calculation.
- Final effective unit price used for commission tier.
- Walk-in sale.
- Registered customer with required phone number.
- Linked promoter return.
- Return stock add-back.
- KPI and leaderboard reduction after returns.
- Admin/HQ correction access.

## Out Of Scope For First Version

- WhatsApp notifications.
- Cash payment for promoter sales.
- Promoter manual returns without original sale.
- Promoter editing finalized sales.
- Daily and weekly leaderboard.
