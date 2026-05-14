import { UserRole } from "@prisma/client";
import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((value) => value || null);

export const userCreateSchema = z
  .object({
    email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
    name: z.string().trim().min(1).max(200),
    password: z.string().min(6).max(100),
    role: z.nativeEnum(UserRole),
    phone: optionalText(40),
    department: optionalText(100),
    defaultLocationId: z.string().trim().optional().nullable().transform((value) => value || null),
    supervisedLocationIds: z.array(z.string().min(1)).default([]),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.role === "PROMOTER" && !data.defaultLocationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultLocationId"],
        message: "Promoter needs a default location",
      });
    }
  });

export const userUpdateSchema = z
  .object({
    email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    password: z.string().min(6).max(100).optional().or(z.literal("")),
    role: z.nativeEnum(UserRole).optional(),
    phone: optionalText(40),
    department: optionalText(100),
    defaultLocationId: z.string().trim().optional().nullable().transform((value) => value || null),
    supervisedLocationIds: z.array(z.string().min(1)).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "PROMOTER" && data.defaultLocationId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultLocationId"],
        message: "Promoter needs a default location",
      });
    }
  });

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: optionalText(40),
  department: optionalText(100),
});
