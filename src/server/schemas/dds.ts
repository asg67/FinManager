import { z } from "zod";

export const createOperationSchema = z
  .object({
    operationType: z.enum(["income", "expense", "transfer"]),
    amount: z.number().positive(),
    entityId: z.string().uuid(),
    fromAccountId: z.string().uuid().optional(),
    toAccountId: z.string().uuid().optional(),
    expenseTypeId: z.string().uuid().optional(),
    expenseArticleId: z.string().uuid().optional(),
    orderNumber: z.string().max(255).optional(),
    comment: z.string().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.operationType === "income" && !data.toAccountId) {
      ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Required for income" });
    }
    if (data.operationType === "expense") {
      if (!data.fromAccountId)
        ctx.addIssue({ code: "custom", path: ["fromAccountId"], message: "Required for expense" });
      if (!data.expenseTypeId)
        ctx.addIssue({ code: "custom", path: ["expenseTypeId"], message: "Required for expense" });
    }
    if (data.operationType === "transfer") {
      if (!data.fromAccountId)
        ctx.addIssue({ code: "custom", path: ["fromAccountId"], message: "Required for transfer" });
      if (!data.toAccountId)
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Required for transfer" });
    }
  });

export const updateOperationSchema = z.object({
  amount: z.number().positive().optional(),
  fromAccountId: z.string().uuid().optional().nullable(),
  toAccountId: z.string().uuid().optional().nullable(),
  expenseTypeId: z.string().uuid().optional().nullable(),
  expenseArticleId: z.string().uuid().optional().nullable(),
  orderNumber: z.string().max(255).optional().nullable(),
  comment: z.string().max(1000).optional().nullable(),
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
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  fromAccountId: z.string().uuid().optional().nullable(),
  toAccountId: z.string().uuid().optional().nullable(),
  expenseTypeId: z.string().uuid().optional().nullable(),
  expenseArticleId: z.string().uuid().optional().nullable(),
});
