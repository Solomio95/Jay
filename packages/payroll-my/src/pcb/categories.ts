// PCB (MTD — Potongan Cukai Bulanan) taxpayer categories.
//
// Source: LHDN "Garis Panduan Potongan Cukai Bulanan".
// The category drives baseline relief + spouse relief. Child relief is
// computed separately from the dependents count on the employee record.
//
// Category codes follow LHDN's convention:
//   K     — single / divorced without qualifying spouse
//   KA0   — married, spouse not working, no qualifying children
//   KA1   — married, spouse not working, 1 qualifying child
//   KA2   — married, spouse not working, 2 qualifying children
//   ...
//   KA20  — up to 20 children (LHDN's table goes this high)
//
// "Qualifying child" per LHDN: unmarried child under 18, or 18+ in full-time
// tertiary education. Child relief is applied on top of the category's
// baseline (see reliefs.ts). Disabled children attract an additional relief.

export type PcbCategory =
    | "K"
    | "KA0"
    | `KA${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20}`;

export const parsePcbCategory = (raw: string): PcbCategory => {
    const upper = raw.toUpperCase();
    if (upper === "K") return "K";
    const m = /^KA(\d{1,2})$/.exec(upper);
    if (!m) throw new Error(`Unknown PCB category: ${raw}`);
    const n = Number(m[1]);
    if (n < 0 || n > 20) throw new Error(`PCB category out of range: ${raw}`);
    return upper as PcbCategory;
};

export const isMarried = (category: PcbCategory): boolean =>
    category.startsWith("KA");

export const childCountFromCategory = (category: PcbCategory): number => {
    if (category === "K") return 0;
    const m = /^KA(\d{1,2})$/.exec(category);
    return m ? Number(m[1]) : 0;
};
