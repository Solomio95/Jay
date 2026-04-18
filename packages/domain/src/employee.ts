import type { Role } from "./roles.js";
import type { Sen } from "./money.js";

export type WageType = "monthly" | "hourly" | "daily";

export interface Employee {
    id: string;
    profileId: string;
    employeeNo: string;
    fullName: string;
    role: Role;
    wageType: WageType;
    baseSalary: Sen;
    hourlyRate?: Sen;
    dailyRate?: Sen;
    pcbCategory?: string;  // LHDN category: K, KA1, KA2, etc.
    dependents: number;
    epfNo?: string;
    socsoNo?: string;
    taxNo?: string;
}

// Hierarchy edge valid over a date window.
export interface EmployeeAssignment {
    id: string;
    employeeId: string;
    counterId: string | null;    // null for managers
    managerId: string | null;    // null for top of chain
    roleInAssignment: Role;
    effectiveFrom: string;       // ISO date
    effectiveTo: string | null;  // null = still active
}

// Resolve the assignment in effect on a given date. Assumes input sorted by effective_from desc.
export const assignmentOn = (
    assignments: readonly EmployeeAssignment[],
    date: string,
): EmployeeAssignment | undefined =>
    assignments.find((a) =>
        a.effectiveFrom <= date && (a.effectiveTo === null || a.effectiveTo >= date),
    );
