import { z } from "zod";

export const createAccountSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["checking", "card", "cash", "deposit"]),
  bank: z.string().max(255).optional(),
  accountNumber: z.string().max(255).optional(),
  contractNumber: z.string().max(255).optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(["checking", "card", "cash", "deposit"]).optional(),
  bank: z.string().max(255).optional(),
  accountNumber: z.string().max(255).optional(),
  contractNumber: z.string().max(255).optional(),
});
