import type { UserRole } from "@prisma/client";

export type PermissionRole = UserRole | string | undefined | null;

export type PermissionUser = {
  role: PermissionRole;
  defaultLocationId?: string | null;
  supervisedLocationIds?: readonly string[];
  temporaryLocationIds?: readonly string[];
};

export type TransferPermissionTarget = {
  fromLocationId: string;
  toLocationId: string;
  requestedById?: string | null;
};

export type PermissionLocationScope = "all" | readonly string[];

export function canManageProducts(role: PermissionRole) {
  return isAdminOrManager(role);
}

export function canManageImports(role: PermissionRole) {
  return isAdminOrManager(role);
}

export function canManagePurchases(role: PermissionRole) {
  return isAdminOrManager(role);
}

export function canManageConsignment(role: PermissionRole) {
  return isAdminOrManager(role);
}

export function canManageStock(role: PermissionRole) {
  return role === "ADMIN" || role === "MANAGER" || role === "STAFF";
}

export function canViewReports(role: PermissionRole) {
  return role === "ADMIN" || role === "MANAGER" || role === "STAFF" || role === "SUPERVISOR" || role === "VIEWER";
}

export function canCreatePromoterSale(
  user: Pick<PermissionUser, "role">,
  locationId: string,
  allowedLocationIds: readonly string[],
) {
  return user.role === "PROMOTER" && allowedLocationIds.includes(locationId);
}

export function canViewLocationStock(user: PermissionUser, locationId: string | undefined | null) {
  if (user.role === "ADMIN" || user.role === "MANAGER" || user.role === "STAFF" || user.role === "VIEWER") {
    return true;
  }

  if (!locationId) return false;

  if (user.role === "PROMOTER") {
    return allowedPromoterStockLocationIds(user).includes(locationId);
  }

  if (user.role === "SUPERVISOR") {
    return (user.supervisedLocationIds ?? []).includes(locationId);
  }

  return false;
}

export function stockLocationScopeForUser(user: PermissionUser): PermissionLocationScope {
  if (user.role === "ADMIN" || user.role === "MANAGER" || user.role === "STAFF" || user.role === "VIEWER") {
    return "all";
  }

  if (user.role === "PROMOTER") {
    return allowedPromoterStockLocationIds(user);
  }

  if (user.role === "SUPERVISOR") {
    return user.supervisedLocationIds ?? [];
  }

  return [];
}

export function allowedPromoterStockLocationIds(user: PermissionUser) {
  return uniqueStrings([
    user.defaultLocationId ?? undefined,
    ...(user.temporaryLocationIds ?? []),
  ]);
}

export function canManageTransfer(user: PermissionUser, transfer: TransferPermissionTarget) {
  if (isAdminOrManager(user.role)) return true;

  if (user.role === "SUPERVISOR") {
    const supervised = user.supervisedLocationIds ?? [];
    return supervised.includes(transfer.fromLocationId) || supervised.includes(transfer.toLocationId);
  }

  return false;
}

export function isAdminOrManager(role: PermissionRole) {
  return role === "ADMIN" || role === "MANAGER";
}

export function forbiddenResponse(message = "Insufficient permissions") {
  return Response.json({ error: { code: "FORBIDDEN", message } }, { status: 403 });
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}
