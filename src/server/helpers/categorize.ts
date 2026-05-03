import { prisma } from "../prisma.js";

export async function applyCategorizationRules(
  companyId: string,
  transactions: Array<{ id: string; direction: string; counterparty: string | null; purpose: string | null }>,
): Promise<number> {
  if (transactions.length === 0) return 0;

  const rules = await prisma.categoryRule.findMany({
    where: { companyId },
    orderBy: { priority: "desc" },
  });
  if (rules.length === 0) return 0;

  let applied = 0;

  for (const tx of transactions) {
    for (const rule of rules) {
      if (rule.direction && rule.direction !== tx.direction) continue;

      const pat = rule.pattern.toLowerCase();
      let text = "";
      if (rule.matchField === "counterparty") text = (tx.counterparty || "").toLowerCase();
      else if (rule.matchField === "purpose") text = (tx.purpose || "").toLowerCase();
      else text = `${tx.counterparty || ""} ${tx.purpose || ""}`.toLowerCase();

      if (!text.includes(pat)) continue;

      const parts = [rule.expenseTypeName, rule.expenseArticleName, rule.directionName].filter(Boolean);
      if (parts.length === 0) continue;
      const label = parts.join(" > ");

      await prisma.bankTransaction.update({ where: { id: tx.id }, data: { ddsArticle: label } });
      applied++;
      break;
    }
  }

  return applied;
}
