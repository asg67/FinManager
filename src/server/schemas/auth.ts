import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(255),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  language: z.enum(["ru", "en"]).optional(),
  theme: z.enum(["dark", "light"]).optional(),
  sberAccountNumber: z.string().max(50).optional().nullable(),
  tbankCardCode: z.string().max(50).optional().nullable(),
  tbankDepositContract: z.string().max(50).optional().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});
