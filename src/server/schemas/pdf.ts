import { z } from "zod";

export const uploadQuerySchema = z.object({
  accountId: z.string().uuid(),
  bankCode: z.enum(["sber", "tbank", "tbank_deposit"]),
});

export const confirmSchema = z.object({
  pdfUploadId: z.string().uuid(),
  transactions: z.array(
    z.object({
      date: z.string(),
      time: z.string().nullable().optional(),
      amount: z.string(),
      direction: z.enum(["income", "expense"]),
      counterparty: z.string().nullable().optional(),
      purpose: z.string().nullable().optional(),
      balance: z.string().nullable().optional(),
    }),
  ),
});
