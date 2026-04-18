export type Role =
    | "promoter"
    | "area_manager"
    | "state_manager"
    | "hr_admin"
    | "super_admin";

export const MANAGER_ROLES: Role[] = ["area_manager", "state_manager"];
export const ADMIN_ROLES: Role[] = ["hr_admin", "super_admin"];

export const canApprove = (role: Role): boolean =>
    MANAGER_ROLES.includes(role) || ADMIN_ROLES.includes(role);
