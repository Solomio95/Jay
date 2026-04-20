// Maps the free-text `employees.bank_name` we collect on the employee form
// into the short codes expected by Maybank2u's bulk-credit template. The
// mapping is case-insensitive and best-effort; anything unrecognised returns
// null so the bank-file generator skips the payee and surfaces it in the
// skipped list for HR to fix before uploading.

const CANONICAL: Record<string, string> = {
    maybank: "MBB",
    mbb: "MBB",
    "maybank islamic": "MBBE",
    cimb: "CIMB",
    "cimb bank": "CIMB",
    "cimb islamic": "CIMBI",
    "public bank": "PBB",
    pbb: "PBB",
    rhb: "RHB",
    "rhb bank": "RHB",
    "hong leong": "HLB",
    "hong leong bank": "HLB",
    hlb: "HLB",
    ambank: "AMBB",
    "am bank": "AMBB",
    bsn: "BSN",
    "bank simpanan nasional": "BSN",
    "bank rakyat": "BKRM",
    "bank islam": "BIMB",
    muamalat: "BMMB",
    "bank muamalat": "BMMB",
    ocbc: "OCBC",
    hsbc: "HSBC",
    "standard chartered": "SCB",
    uob: "UOB",
    affin: "ABB",
    "affin bank": "ABB",
    alliance: "ABMB",
    "alliance bank": "ABMB",
    agrobank: "AGRO",
    citibank: "CITI",
};

export const toBankCode = (name: string | null): string | null => {
    if (!name) return null;
    return CANONICAL[name.trim().toLowerCase()] ?? null;
};
