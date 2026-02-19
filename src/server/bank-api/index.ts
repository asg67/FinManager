import type { BankAdapter } from "./types.js";
import { tbankAdapter } from "./tbank.js";
import { modulbankAdapter } from "./modulbank.js";
import { tochkaAdapter } from "./tochka.js";

export const bankAdapters: Record<string, BankAdapter> = {
  tbank: tbankAdapter,
  modulbank: modulbankAdapter,
  tochka: tochkaAdapter,
};

export type { BankAdapter, BankAccount, BankTransactionRaw } from "./types.js";
