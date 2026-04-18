export type LeaveCode = "AL" | "MC" | "UPL" | "REPL" | "MAT" | "PAT";

export type LeaveStatus =
    | "pending"
    | "approved"
    | "rejected"
    | "cancelled"
    | "escalated";

export interface LeaveRequest {
    id: string;
    employeeId: string;
    leaveTypeCode: LeaveCode;
    startDate: string;
    endDate: string;
    halfDay: boolean;
    days: number;
    reason?: string;
    attachmentUrl?: string;
    status: LeaveStatus;
    currentApproverId: string | null;
}

export interface LeaveBalance {
    employeeId: string;
    leaveTypeCode: LeaveCode;
    year: number;
    entitled: number;
    taken: number;
    pending: number;
    carriedForward: number;
}

export const availableDays = (b: LeaveBalance): number =>
    b.entitled + b.carriedForward - b.taken - b.pending;
