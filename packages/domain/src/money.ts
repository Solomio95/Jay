// All monetary values travel through the system as integer cents (sen).
// Convert to/from ringgit at the UI boundary.
export type Sen = number & { readonly __brand: "Sen" };

export const toSen = (rm: number): Sen => Math.round(rm * 100) as Sen;
export const toRinggit = (sen: Sen): number => sen / 100;
export const addSen = (...values: Sen[]): Sen =>
    values.reduce((a, b) => (a + b) as Sen, 0 as Sen);
export const subSen = (a: Sen, b: Sen): Sen => (a - b) as Sen;

// Round half-away-from-zero, matching LHDN/KWSP convention for PCB/EPF.
export const mulPct = (sen: Sen, pct: number): Sen => {
    const raw = (sen * pct) / 100;
    return Math.round(raw) as Sen;
};
