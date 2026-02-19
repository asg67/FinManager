import type { BankAdapter, BankAccount, BankTransactionRaw } from "./types.js";

const BASE = "https://api.modulbank.ru/v1";

function hdrs(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function parseDatetime(raw: string | null): { date: string; time: string | null } {
  if (!raw) return { date: "", time: null };
  try {
    const s = raw.replace("Z", "+00:00");
    const dt = new Date(s);
    if (isNaN(dt.getTime())) {
      const d = raw.split("T")[0] || "";
      return { date: d, time: null };
    }
    // Convert to Moscow
    const msk = new Date(dt.getTime() + 3 * 60 * 60 * 1000);
    return {
      date: msk.toISOString().slice(0, 10),
      time: msk.toISOString().slice(11, 19),
    };
  } catch {
    return { date: raw.split("T")[0] || "", time: null };
  }
}

function pickCounterparty(op: Record<string, unknown>): string {
  const directKeys = [
    "contragentName", "counterpartyName", "recipientName",
    "payerName", "payeeName", "receiverName",
  ];
  for (const k of directKeys) {
    const v = op[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const objKeys = ["counterparty", "payer", "payee", "recipient"];
  for (const k of objKeys) {
    const node = op[k];
    if (node && typeof node === "object") {
      for (const nk of ["name", "fullName", "legalName"]) {
        const v = (node as Record<string, unknown>)[nk];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    }
  }
  const text = String(op.paymentPurpose || "") + " " + String(op.description || "");
  if (text.toLowerCase().includes("комисс")) return "Модульбанк";
  return "";
}

export const modulbankAdapter: BankAdapter = {
  async testConnection(token) {
    try {
      const res = await fetch(`${BASE}/account-info`, {
        method: "POST",
        headers: hdrs(token),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async fetchAccounts(token) {
    const res = await fetch(`${BASE}/account-info`, {
      method: "POST",
      headers: hdrs(token),
    });
    if (!res.ok) throw new Error(`Modulbank account-info error: ${res.status}`);
    const companies: Array<Record<string, unknown>> = await res.json();
    const accounts: BankAccount[] = [];

    for (const company of companies) {
      const companyName = String(company.companyName || company.companyId || "");
      // Normalize company name: "Индивидуальный предприниматель Скобелев" → "ИП Скобелев"
      const shortName = companyName.replace("Индивидуальный предприниматель", "ИП").trim();

      const bankAccounts = (company.bankAccounts as Array<Record<string, unknown>>) || [];
      for (const ba of bankAccounts) {
        accounts.push({
          accountNumber: String(ba.number || ""),
          name: String(ba.accountName || ba.number || ""),
          bankAccountId: String(ba.id || ""),
        });
      }
    }
    return accounts;
  },

  async fetchTransactions(token, account, from, to) {
    const transactions: BankTransactionRaw[] = [];
    const accId = account.bankAccountId || account.accountNumber;
    const dateFrom = from.toISOString().slice(0, 10);
    const dateTill = to.toISOString().slice(0, 10);

    let skip = 0;
    const batchSize = 50;

    while (true) {
      const body = {
        from: dateFrom,
        till: dateTill,
        records: batchSize,
        skip,
      };

      const res = await fetch(`${BASE}/operation-history/${accId}`, {
        method: "POST",
        headers: hdrs(token),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Modulbank operations error: ${res.status}`);

      const batch: Array<Record<string, unknown>> = await res.json();

      for (const op of batch) {
        const dtRaw = String(op.executed || op.created || "");
        const { date, time } = parseDatetime(dtRaw);
        if (!date) continue;

        // Direction: category debet/debit → income, credit → expense
        const cat = String(op.category || "").toLowerCase();
        let direction: "income" | "expense";
        if (cat === "debet" || cat === "debit") {
          direction = "income";
        } else if (cat === "credit") {
          direction = "expense";
        } else {
          direction = "expense"; // default
        }

        const rawAmount = Number(String(op.amount || "0").replace(",", "."));
        const amount = Math.abs(rawAmount);
        const counterparty = pickCounterparty(op);
        const purpose = String(op.paymentPurpose || op.description || op.comment || "").trim();

        transactions.push({
          date,
          time,
          amount: amount.toFixed(2),
          direction,
          counterparty: counterparty || null,
          purpose: purpose || null,
          balance: null,
        });
      }

      if (batch.length < batchSize) break;
      skip += batchSize;
    }

    return transactions;
  },
};
