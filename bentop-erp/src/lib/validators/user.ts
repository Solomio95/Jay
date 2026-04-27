import { z } from "zod";

export const USER_ROLES = ["ADMIN", "MANAGER", "STAFF", "VIEWER"] as const;

export const userCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(USER_ROLES).default("STAFF"),
  phone: z.string().max(30).optional(),
  department: z.string().max(100).optional(),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(30).optional(),
  department: z.string().max(100).optional(),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});
