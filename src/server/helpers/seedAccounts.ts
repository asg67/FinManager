import { prisma } from "../prisma.js";

// Standard accounts matching available bank statement types
const STANDARD_ACCOUNTS = [
  { type: "card", bank: "sber", name: "Карта Сбер" },
  { type: "card", bank: "tbank", name: "Карта Т-Банк" },
  { type: "deposit", bank: "tbank", name: "Депозит Т-Банк" },
  { type: "card", bank: "ozon", name: "Карта ОЗОН" },
];

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
