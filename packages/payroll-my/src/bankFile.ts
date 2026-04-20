// Maybank2E bulk credit file generator.
//
// Format (TSV, CRLF line endings):
//
// Header row:
//   H | org_account | pay_date(YYYYMMDD) | total_count | total_amount(sen) | reference
// Detail row (one per employee):
//   D | beneficiary_name | id_type(NI|OI|BR|PP) | id_no | bank_code |
//     account_no | amount(sen) | ref1 | ref2 | email
// Trailer row:
//   T | total_count | total_amount(sen)
//
// The real Maybank format is proprietary and bank-account-specific; this
// structure matches the shape of what ops uploads to Maybank2u Biz "Payroll
// Bulk Credit" and is trivially re-templated once Bentop gives us the spec
// that goes with their corporate account. The critical properties we hold
// onto here are deterministic output and balanced totals.

export interface BankFilePayee {
    employeeNo: string;
    fullName: string;
    icNo: string | null;      // Malaysian NRIC, no dashes
    bankName: string | null;  // free text; caller maps to bank_code
    bankAccount: string | null;
    bankCode: string | null;
    netPay: number;           // in ringgit
    email: string | null;
}

export interface BankFileInput {
    orgAccount: string;
    payDate: string;          // ISO YYYY-MM-DD
    reference: string;        // e.g. "PAYROLL 2026-04"
    payees: BankFilePayee[];
}

export interface BankFileResult {
    text: string;
    skipped: { employeeNo: string; reason: string }[];
    totalAmountSen: number;
    totalCount: number;
}

const CRLF = "\r\n";
const toSen = (rm: number): number => Math.round(rm * 100);
const ymd = (iso: string) => iso.replace(/-/g, "");

const escapeField = (s: string): string =>
    s.replace(/[\t\r\n]/g, " ").trim();

export const buildMaybankBulkFile = (input: BankFileInput): BankFileResult => {
    const skipped: { employeeNo: string; reason: string }[] = [];
    const detailRows: string[] = [];
    let total = 0;
    let count = 0;

    for (const p of input.payees) {
        if (p.netPay <= 0) {
            skipped.push({ employeeNo: p.employeeNo, reason: "zero_net_pay" });
            continue;
        }
        if (!p.bankAccount || !p.bankCode) {
            skipped.push({ employeeNo: p.employeeNo, reason: "missing_bank_details" });
            continue;
        }
        const sen = toSen(p.netPay);
        total += sen;
        count += 1;
        detailRows.push([
            "D",
            escapeField(p.fullName),
            p.icNo ? "NI" : "OI",
            escapeField(p.icNo ?? p.employeeNo),
            escapeField(p.bankCode),
            escapeField(p.bankAccount),
            String(sen),
            escapeField(input.reference),
            escapeField(p.employeeNo),
            escapeField(p.email ?? ""),
        ].join("\t"));
    }

    const header = [
        "H",
        escapeField(input.orgAccount),
        ymd(input.payDate),
        String(count),
        String(total),
        escapeField(input.reference),
    ].join("\t");
    const trailer = ["T", String(count), String(total)].join("\t");

    const text = [header, ...detailRows, trailer].join(CRLF) + CRLF;
    return { text, skipped, totalAmountSen: total, totalCount: count };
};
