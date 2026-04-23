import type { UserRole } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export type NavItem = {
  title: string;
  href: string;
  icon: string;
  badge?: number;
  children?: NavItem[];
};

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type ApiResponse<T = unknown> = {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};
