import type { Sen } from "./money.js";

export interface SalesRecord {
    id: string;
    externalId: string;          // ERP primary key
    counterId: string;
    employeeId: string | null;   // null if unassigned at time of sale
    saleDate: string;            // ISO date
    grossAmount: Sen;
    returnsAmount: Sen;
    netAmount: Sen;              // generated: gross - returns
    currency: "MYR";
    erpVersion: number;
    supersededBy?: string;
}
