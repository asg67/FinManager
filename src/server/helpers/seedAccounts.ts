import { prisma } from "../prisma.js";

// Standard accounts: bank API (checking) + PDF statements (cards/deposits)
const STANDARD_ACCOUNTS = [
  // Bank API — checking accounts
  { type: "checking", bank: "tbank", name: "р/с Т-Банк" },
  { type: "checking", bank: "module", name: "р/с Модуль" },
  { type: "checking", bank: "tochka", name: "р/с Точка" },
  // PDF statements — cards & deposits
  { type: "card", bank: "sber", name: "Карта Сбер" },
  { type: "card", bank: "tbank", name: "Карта Т-Банк" },
  { type: "deposit", bank: "tbank", name: "Депозит Т-Банк" },
  { type: "card", bank: "ozon", name: "Карта ОЗОН" },
];

/** Known bank codes — only these appear in initial balances */
export const STANDARD_BANK_CODES = STANDARD_ACCOUNTS.map((a) => a.bank);

/** Creates only missing standard accounts for an entity */
export async function seedEntityAccounts(entityId: string) {
  const existing = await prisma.account.findMany({
    where: { entityId },
    select: { type: true, bank: true },
  });

  const missing = STANDARD_ACCOUNTS.filter(
    (std) => !existing.some((e) => e.type === std.type && e.bank === std.bank),
  );

  if (missing.length === 0) return;

  await prisma.account.createMany({
    data: missing.map((acc) => ({ ...acc, entityId })),
  });
}
