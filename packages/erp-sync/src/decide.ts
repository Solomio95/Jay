// Pure decision logic for the ERP sync pipeline.
//
// The Supabase Edge Function at supabase/functions/erp-sync-sales/ is the
// thin IO wrapper — it fetches from the ERP, resolves counter/employee
// codes, then delegates every per-sale decision to decideSaleAction() so
// the behaviour is covered by unit tests here rather than end-to-end.
//
// Contract
// --------
// For a given ERP sale (identified by its base external_id) we may have
// multiple rows in sales_records, each representing a version. The newest
// non-superseded row is the live one; older rows keep superseded_by set.
// When the ERP sends an amendment (version N+1) we insert a new row keyed
// on `{baseExternalId}#v{N+1}` and flip the previous live row's
// superseded_by pointer to the new id.
//
// Idempotency rules
// -----------------
// * A replay of a sale with the same version as any existing row → `skip`.
// * A sale whose base has no rows yet → `insert`, keyed on baseExternalId.
// * A sale with version > max existing version → `amend`, linking the new
//   row against whatever row is currently live (non-superseded).
// * A sale with version < max existing version → `skip` (older amendment).

export interface ErpSaleInput {
    baseExternalId: string;
    counterId: string;
    employeeId: string | null;
    saleDate: string;               // YYYY-MM-DD
    grossAmount: number;            // ringgit
    returnsAmount: number;
    currency: string;
    erpVersion: number;
    erpLastModifiedAt: string;      // ISO timestamp
}

export interface ExistingSaleRow {
    id: string;
    externalId: string;             // may be base or `{base}#vN`
    erpVersion: number;
    supersededBy: string | null;
}

export interface SaleInsertRow {
    externalId: string;
    counterId: string;
    employeeId: string | null;
    saleDate: string;
    grossAmount: number;
    returnsAmount: number;
    currency: string;
    erpVersion: number;
    erpLastModifiedAt: string;
}

export type SaleAction =
    | { kind: "skip"; reason: "duplicate_version" | "older_version" }
    | { kind: "insert"; row: SaleInsertRow }
    | { kind: "amend"; supersedesId: string; row: SaleInsertRow };

// Decide what to do with a single ERP sale given the rows currently in the
// DB for its base external id. Rows are sorted by erp_version for clarity
// but the logic doesn't depend on the order.
export const decideSaleAction = (
    existingRows: readonly ExistingSaleRow[],
    sale: ErpSaleInput,
): SaleAction => {
    if (existingRows.length === 0) {
        return {
            kind: "insert",
            row: buildRow(sale.baseExternalId, sale),
        };
    }

    const versions = existingRows.map((r) => r.erpVersion);
    const maxVersion = Math.max(...versions);

    if (versions.includes(sale.erpVersion)) {
        return { kind: "skip", reason: "duplicate_version" };
    }
    if (sale.erpVersion < maxVersion) {
        return { kind: "skip", reason: "older_version" };
    }

    // sale.erpVersion > maxVersion: treat as amendment.
    const live = existingRows.find((r) => r.supersededBy == null);
    const supersedesId = live?.id ?? existingRows[existingRows.length - 1]!.id;
    return {
        kind: "amend",
        supersedesId,
        row: buildRow(
            `${sale.baseExternalId}#v${sale.erpVersion}`,
            sale,
        ),
    };
};

const buildRow = (externalId: string, sale: ErpSaleInput): SaleInsertRow => ({
    externalId,
    counterId: sale.counterId,
    employeeId: sale.employeeId,
    saleDate: sale.saleDate,
    grossAmount: sale.grossAmount,
    returnsAmount: sale.returnsAmount,
    currency: sale.currency,
    erpVersion: sale.erpVersion,
    erpLastModifiedAt: sale.erpLastModifiedAt,
});

// Group existing rows by base external id so the Edge Function can hand
// decideSaleAction the right bucket per incoming sale. A row whose
// externalId matches `baseId#vN` is considered to belong to baseId.
export const extractBaseExternalId = (externalId: string): string => {
    const idx = externalId.indexOf("#v");
    return idx === -1 ? externalId : externalId.slice(0, idx);
};
