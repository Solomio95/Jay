import { type Sen, toRinggit } from "@bentop/domain";

// "2026-04-01" -> "April 2026"
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

export const formatPeriodMonth = (isoFirstOfMonth: string): string => {
    const [y, m] = isoFirstOfMonth.split("-");
    const monthIndex = Number(m) - 1;
    const name = MONTHS[monthIndex] ?? m ?? "";
    return `${name} ${y ?? ""}`.trim();
};

// RM 1,234.05 with thousands separator and two decimals.
export const formatRm = (sen: Sen): string => {
    const rm = toRinggit(sen);
    const sign = rm < 0 ? "-" : "";
    const abs = Math.abs(rm);
    const [intPart, decPart = "00"] = abs.toFixed(2).split(".");
    const withCommas = (intPart ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${sign}RM ${withCommas}.${decPart}`;
};
