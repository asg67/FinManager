import crypto from "crypto";
import type { BankAdapter, BankAccount, BankTransactionRaw } from "./types.js";

const BASE = "https://business.tbank.ru/openapi";

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "X-Request-Id": crypto.randomUUID(),
  };
}

// Currency numeric code → ISO mapping (from reference script)
const NUMCODE_TO_ISO: Record<string, string> = {
  "643": "RUB", "840": "USD", "978": "EUR", "826": "GBP",
  "392": "JPY", "756": "CHF", "124": "CAD", "036": "AUD",
};

function toFloat(x: unknown): number | null {
  if (x == null) return null;
  const n = Number(String(x).replace(",", ".").trim());
  return isNaN(n) ? null : n;
}

function extractAmount(op: Record<string, unknown>): number | null {
  // accountAmount is the primary amount field
  const amt = toFloat(op.accountAmount);
  if (amt != null) return Math.abs(amt);
  const opAmt = toFloat(op.operationAmount);
  if (opAmt != null) return Math.abs(opAmt);
  const rub = toFloat(op.rubleAmount);
  if (rub != null) return Math.abs(rub);
  return toFloat(op.amount) != null ? Math.abs(toFloat(op.amount)!) : null;
}

function extractCounterparty(op: Record<string, unknown>): string {
  // Direct name fields
  const nameKeys = [
    "counterpartyName", "contragentName", "beneficiaryName",
    "recipientName", "payerName", "payeeName",
  ];
  for (const k of nameKeys) {
    const v = op[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  // Nested objects
  const objKeys = ["counterparty", "contragent", "beneficiary", "recipient", "payer", "payee", "receiver", "sender"];
  for (const k of objKeys) {
    const node = op[k];
    if (node && typeof node === "object") {
      for (const nk of [...nameKeys, "name", "fullName", "shortName"]) {
        const v = (node as Record<string, unknown>)[nk];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    }
  }
  const purpose = String(op.paymentPurpose || op.description || "").toLowerCase();
  if (purpose.includes("комисс")) return 'АО "ТБанк"';
  return "";
}

function mapDirection(op: Record<string, unknown>, ourAccount: string): "income" | "expense" {
  const payerAcct = ((op.payer as Record<string, unknown> | undefined)?.acct as string) || "";
  const receiverAcct = ((op.receiver as Record<string, unknown> | undefined)?.acct as string) || "";
  if (receiverAcct && String(receiverAcct) === ourAccount) return "income";
  if (payerAcct && String(payerAcct) === ourAccount) return "expense";

  const purpose = String(op.paymentPurpose || op.description || "").toLowerCase();
  if (["получение кредита", "зачисление кредита"].some((k) => purpose.includes(k))) return "income";
  if (["погашение кредита", "комиссия"].some((k) => purpose.includes(k))) return "expense";

  const cat = String(op.category || "").toLowerCase();
  if (cat.startsWith("income") || cat.startsWith("debet")) return "income";
  return "expense";
}

function parseDateMsk(dtStr: string | null): { date: string; time: string | null } {
  if (!dtStr) return { date: "", time: null };
  try {
    const dt = new Date(dtStr);
    // Convert to Moscow time (UTC+3)
    const msk = new Date(dt.getTime() + 3 * 60 * 60 * 1000);
    const date = msk.toISOString().slice(0, 10);
    const time = msk.toISOString().slice(11, 19);
    return { date, time };
  } catch {
    return { date: dtStr.split("T")[0] || "", time: null };
  }
}

export const tbankAdapter: BankAdapter = {
  async testConnection(token) {
    try {
      const res = await fetch(`${BASE}/api/v4/bank-accounts?withInvest=false`, {
        headers: headers(token),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async fetchAccounts(token) {
    const res = await fetch(`${BASE}/api/v4/bank-accounts?withInvest=false`, {
      headers: headers(token),
    });
    if (!res.ok) throw new Error(`T-Bank accounts error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((a: Record<string, unknown>) => ({
      accountNumber: String(a.accountNumber || ""),
      name: String(a.name || a.accountType || a.accountNumber || ""),
    }));
  },

  async fetchTransactions(token, account, from, to) {
    const transactions: BankTransactionRaw[] = [];
    let cursor: string | null = null;

    // Convert dates to UTC ISO strings (T-Bank expects UTC ISO)
    const fromMskStart = new Date(from);
    fromMskStart.setHours(0, 0, 0, 0);
    const toMskEnd = new Date(to);
    toMskEnd.setHours(23, 59, 59, 999);

    // Adjust MSK→UTC: subtract 3 hours
    const fromUtc = new Date(fromMskStart.getTime() - 3 * 60 * 60 * 1000);
    const toUtc = new Date(toMskEnd.getTime() - 3 * 60 * 60 * 1000 + 1);

    do {
      const params = new URLSearchParams({
        accountNumber: account.accountNumber,
        from: fromUtc.toISOString().replace(/\.\d+Z$/, "Z"),
        to: toUtc.toISOString().replace(/\.\d+Z$/, "Z"),
        limit: "5000",
        operationStatus: "Transaction",
      });
      if (!cursor) params.set("withBalances", "true");
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`${BASE}/api/v1/statement?${params}`, {
        headers: headers(token),
      });
      if (!res.ok) throw new Error(`T-Bank statement error: ${res.status}`);

      const body = await res.json();
      cursor = body.nextCursor || null;

      for (const op of body.operations || []) {
        const dtStr = op.operationDate || op.postingDate || op.createdAt;
        const { date, time } = parseDateMsk(dtStr);
        if (!date) continue;

        const amount = extractAmount(op);
        if (amount == null) continue;

        const direction = mapDirection(op, account.accountNumber);
        const counterparty = extractCounterparty(op);
        const purpose = String(op.paymentPurpose || op.description || op.payPurpose || "").trim();

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
    } while (cursor);

    return transactions;
  },
};
