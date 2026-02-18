import { z } from "zod";

export const createExpenseTypeSchema = z.object({
  name: z.string().min(1).max(255),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateExpenseTypeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createExpenseArticleSchema = z.object({
  name: z.string().min(1).max(255),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateExpenseArticleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sortOrder: z.number().int().min(0).optional(),
});
