import { prisma } from "../prisma.js";

// Standard accounts matching available bank statement types
const STANDARD_ACCOUNTS = [
  { name: "Карта Сбер", type: "card", bank: "sber" },
  { name: "Карта Т-Банк", type: "card", bank: "tbank" },
  { name: "Депозит Т-Банк", type: "deposit", bank: "tbank" },
  { name: "Карта ОЗОН", type: "card", bank: "ozon" },
];

export async function seedEntityAccounts(entityId: string) {
  const existing = await prisma.account.count({ where: { entityId } });
  if (existing > 0) return;

  await prisma.account.createMany({
    data: STANDARD_ACCOUNTS.map((acc) => ({
      ...acc,
      entityId,
    })),
  });
}
