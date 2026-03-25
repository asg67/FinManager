import { z } from "zod";

export const createIncomeTypeSchema = z.object({
  name: z.string().min(1).max(255),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateIncomeTypeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createIncomeArticleSchema = z.object({
  name: z.string().min(1).max(255),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateIncomeArticleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sortOrder: z.number().int().min(0).optional(),
});
