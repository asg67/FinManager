import { z } from "zod";

export const createBankConnectionSchema = z.object({
  entityId: z.string().uuid(),
  bankCode: z.enum(["tbank", "modulbank", "tochka"]),
  token: z.string().min(1),
  label: z.string().max(255).optional(),
});

export const updateBankConnectionSchema = z.object({
  token: z.string().min(1).optional(),
  label: z.string().max(255).optional(),
});

export const syncBankConnectionSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
