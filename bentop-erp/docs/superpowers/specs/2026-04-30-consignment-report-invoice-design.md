# Consignment Report And Invoice Upgrade Design

## Context

Bentop Collection's ERP should be consignment-first. The core workflow is sending stock to consignment partners, receiving dated partner reports with sales and returns, then issuing invoices so partners pay Bentop the net sales amount after commission.

The current system already has consignment shipments and shipment items. It tracks detailed SKU, size, and color quantities, but it does not preserve dated consignment reports or invoice-ready commission calculations. Returns are mainly handled during settlement, while Bentop needs sales and returns recorded together from each partner report.

## Goals

- Keep detailed SKU, size, and color stock tracking.
- Show simple grouped product totals above detailed SKU lines.
- Record partner sales and returns as separate dated consignment reports.
- Calculate commission from the actual reported selling price, including discounts.
- Support partner-specific commission tiers and product/partner-specific overrides configured before report entry.
- Generate invoice views that show every line calculation.
- Preserve historical tier, rate, and amount values on report lines and invoices.

## Non-Goals

- Rewriting the whole ERP.
- Replacing existing inventory, stock transfer, or order modules.
- Building full accounting ledger integration in this phase.
- Automating payment collection from partners.

## Business Rules

For a partner such as Billion, default commission groups are price-tier based:

- `Super Best Buy`: actual selling price RM 49.90 and below.
- `Best Buy`: actual selling price RM 50.00 to RM 109.00.
- `Normal`: actual selling price RM 110.00 and above.

Commission rates are partner-specific. The tier names and price boundaries can be reused, but each partner can have its own percentage for each tier.

Some items have special product/partner commission modifications configured beforehand. During report entry, the system resolves commission in this order:

1. If the partner and item have a configured override, use the override tier and rate.
2. Otherwise, choose the partner commission tier from the actual reported selling price.
3. Save the final tier name, commission rate, and calculated amounts on the report line.

The saved report line values are historical records. Later changes to partner tiers or item overrides must not change past reports or invoices.

## Data Model

Keep the existing models:

- `ConsignmentShipment`: stock-send document.
- `ConsignmentShipmentItem`: detailed sent SKU, size, and color line.

Add these models:

- `ConsignmentPartner`: partner profile with name, contact details, payment terms, and active flag.
- `ConsignmentCommissionTier`: partner tier with name, minimum price, maximum price, and commission rate.
- `ConsignmentCommissionOverride`: partner plus product or variant override with tier name and commission rate.
- `ConsignmentReport`: dated report from a partner for a shipment.
- `ConsignmentReportLine`: sold and returned quantities for one shipment item, plus saved pricing and commission calculation.
- `ConsignmentInvoice`: invoice generated from a finalized report.
- `ConsignmentInvoiceLine`: invoice line values copied from finalized report lines.

`ConsignmentReportLine` stores:

- shipment item id
- sold quantity
- returned quantity
- actual selling price per unit
- resolved commission tier name
- resolved commission rate
- gross amount
- commission amount
- net amount owed to Bentop

## Workflow

### Partner Setup

Bentop creates or edits consignment partners. Each partner can have:

- name and contact information
- payment terms
- default commission tiers
- product or SKU-specific commission overrides

### Create Shipment

The shipment remains the document for stock sent to a partner. The shipment screen should show:

- upper grouped summary by product, with total quantity and value
- lower detailed SKU, size, and color table

Stock is still moved and tracked by detailed SKU line.

### Enter Partner Report

On an active shipment, Bentop creates a new report with:

- report date
- optional partner reference
- item lines for sold quantity, returned quantity, and actual selling price
- automatic commission tier and rate resolution
- gross, commission, and net totals

Draft reports do not move stock. Finalized reports apply stock movements.

### Generate Invoice

From a finalized report, Bentop generates an invoice. The invoice must show every calculation line:

- SKU and product
- size and color
- sold quantity
- actual selling price
- commission group
- commission rate
- gross sales amount
- commission amount
- net amount owed to Bentop

The invoice total is the amount the partner must pay Bentop.

### Settlement

When a report is finalized:

- sold quantity is deducted from the partner location stock
- returned quantity is moved from the partner location back to Bentop stock
- remaining partner stock stays open for future reports
- the shipment becomes fully settled only when every shipped unit has been sold or returned

## UI Changes

Update the consignment section to be the main working area for this workflow.

- Consignment dashboard: emphasize active partner stock, pending reports, draft invoices, and amount receivable.
- Shipment detail: add grouped product summary, detailed SKU table, report history, and invoice history.
- Shipment action: replace `Record Sales` with `New Report`.
- Report entry page: show grouped totals at the top and editable detailed lines below.
- Partner setup page: manage tiers and item overrides.
- Invoice page: printable invoice with full line-level calculations.

## Validation

- Sold quantity plus returned quantity cannot exceed the remaining quantity for the shipment item.
- Actual selling price must be zero or greater.
- Finalized reports must have at least one sold or returned line.
- Commission tier lookup must handle RM 49.90, RM 50.00, RM 109.00, and RM 110.00 exactly.
- Product/partner override must take precedence over selling-price tier.
- Draft reports must not change stock.
- Finalized reports must update stock movements exactly once.
- Invoice totals must match finalized report totals.

## Testing Plan

Test the commission calculation boundaries:

- RM 49.90 resolves to `Super Best Buy`.
- RM 50.00 resolves to `Best Buy`.
- RM 109.00 resolves to `Best Buy`.
- RM 110.00 resolves to `Normal`.

Test business behavior:

- Discounted actual selling price changes the tier.
- Product/partner override wins over default price tier.
- Sales reduce stock at the partner location.
- Returns move stock back to Bentop's source location.
- Remaining stock stays open for the next report.
- Invoice line totals equal gross amount minus commission.
- Historical invoices do not change after commission settings are edited.

## Implementation Notes

The first implementation should focus on the consignment module only. Existing sales orders and POS can remain unchanged. Existing consignment shipments should remain readable, and new reports should be created only for shipments linked to a `ConsignmentPartner`. A follow-up migration can convert old shipment `partnerName` values into partner profiles after the new workflow is stable.
