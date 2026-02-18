import { z } from "zod";

export const createCompanySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
  }),
});

export const updateCompanySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
  }),
});

export const registerInviteSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
    token: z.string().uuid(),
  }),
});
