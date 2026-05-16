# Barcode Labels Design

## Goal

Add an inventory barcode label generator for Bentop Collection product tags.

## Scope

The feature creates a PDF for selected product variants. Each label is exactly 35 mm wide by 25 mm tall and includes:

- Bentop Collection
- Artical No: full variant SKU
- Size: variant size
- Colour: variant colour
- Scannable barcode from the variant barcode field

The first version exports PDF only because PDF preserves physical print size reliably for manufacturers.

## Data

No database change is required. The feature reads existing active `ProductVariant` records, using `sku`, `size`, `color`, `barcode`, and product name.

Variants without a barcode are rejected before PDF generation so staff can correct the product setup first.

## UI

Add `Inventory -> Barcode Labels`. Staff can search variants one by one or bulk add by pasted SKU/barcode, set copy quantity, then download a PDF.

## Permissions

Authenticated ADMIN, MANAGER, and STAFF users can generate labels. VIEWER, PROMOTER, and SUPERVISOR are blocked.

## Testing

Unit tests cover PDF size, page count, and missing barcode validation. Existing lint, unit tests, and build must pass.
