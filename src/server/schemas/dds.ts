import { z } from "zod";

const customFieldValueSchema = z.object({
  customFieldId: z.string().uuid(),
  value: z.string().max(1000),
});

export const createOperationSchema = z
  .object({
    operationType: z.enum(["income", "expense", "transfer"]),
    amount: z.number().positive(),
    entityId: z.string().uuid(),
    fromAccountId: z.string().uuid().optional(),
    toAccountId: z.string().uuid().optional(),
    expenseTypeId: z.string().uuid().optional(),
    expenseArticleId: z.string().uuid().optional(),
    incomeTypeId: z.string().uuid().optional(),
    incomeArticleId: z.string().uuid().optional(),
    orderNumber: z.string().max(255).optional(),
    comment: z.string().max(1000).optional(),
    customFieldValues: z.array(customFieldValueSchema).optional(),
  })
  // Note: account requirements are relaxed — dds_only companies don't use accounts.
  // Server-side route handler checks company mode for stricter validation if needed.

export const updateOperationSchema = z.object({
  amount: z.number().positive().optional(),
  fromAccountId: z.string().uuid().optional().nullable(),
  toAccountId: z.string().uuid().optional().nullable(),
  expenseTypeId: z.string().uuid().optional().nullable(),
  expenseArticleId: z.string().uuid().optional().nullable(),
  incomeTypeId: z.string().uuid().optional().nullable(),
  incomeArticleId: z.string().uuid().optional().nullable(),
  orderNumber: z.string().max(255).optional().nullable(),
  comment: z.string().max(1000).optional().nullable(),
  customFieldValues: z.array(customFieldValueSchema).optional(),
});

export const listOperationsSchema = z.object({
  entityId: z.string().uuid().optional(),
  operationType: z.enum(["income", "expense", "transfer"]).optional(),
  accountId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().max(255).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  operationType: z.enum(["income", "expense", "transfer"]),
  entityId: z.string().uuid(),
  fromAccountId: z.string().uuid().optional(),
  toAccountId: z.string().uuid().optional(),
  expenseTypeId: z.string().uuid().optional(),
  expenseArticleId: z.string().uuid().optional(),
  incomeTypeId: z.string().uuid().optional(),
  incomeArticleId: z.string().uuid().optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  fromAccountId: z.string().uuid().optional().nullable(),
  toAccountId: z.string().uuid().optional().nullable(),
  expenseTypeId: z.string().uuid().optional().nullable(),
  expenseArticleId: z.string().uuid().optional().nullable(),
  incomeTypeId: z.string().uuid().optional().nullable(),
  incomeArticleId: z.string().uuid().optional().nullable(),
});
