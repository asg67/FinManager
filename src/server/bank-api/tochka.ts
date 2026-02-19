import type { BankAdapter, BankAccount, BankTransactionRaw } from "./types.js";

const BASE = "https://enter.tochka.com/uapi/open-banking/v1.0";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 60; // 2 minutes max

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function jsonHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseDateMsk(dtStr: string | null): { date: string; time: string | null } {
  if (!dtStr) return { date: "", time: null };
  try {
    const s = dtStr.replace("Z", "+00:00");
    const dt = new Date(s);
    if (isNaN(dt.getTime())) {
      return { date: dtStr.split("T")[0] || "", time: null };
    }
    const msk = new Date(dt.getTime() + 3 * 60 * 60 * 1000);
    return {
      date: msk.toISOString().slice(0, 10),
      time: msk.toISOString().slice(11, 19),
    };
  } catch {
    return { date: dtStr.split("T")[0] || "", time: null };
  }
}

function extractAmount(op: Record<string, unknown>): number | null {
  for (const key of ["amount", "accountAmount", "operationAmount", "transactionAmount", "sum", "value"]) {
    const v = op[key];
    if (v != null) {
      const n = Number(String(v).replace(",", ".").trim());
      if (!isNaN(n)) return Math.abs(n);
    }
  }
  // Check nested amount objects
  for (const key of ["amount", "Amount"]) {
    const node = op[key];
    if (node && typeof node === "object") {
      for (const inner of ["value", "amount", "sum", "total"]) {
        const v = (node as Record<string, unknown>)[inner];
        if (v != null) {
          const n = Number(String(v).replace(",", ".").trim());
          if (!isNaN(n)) return Math.abs(n);
        }
      }
    }
  }
  return null;
}

function extractDirection(op: Record<string, unknown>): "income" | "expense" {
  const cdi = String(op.creditDebitIndicator || "").toLowerCase();
  if (cdi === "credit") return "income";
  if (cdi === "debit") return "expense";

  const sign = op.sign;
  if (sign === "+") return "income";
  if (sign === "-") return "expense";

  return "expense";
}

function extractCounterparty(op: Record<string, unknown>): string {
  const cdi = String(op.creditDebitIndicator || "").toLowerCase();
  // For income (credit), debtor is the counterparty; for expense (debit), creditor is
  if (cdi === "credit" || cdi === "debit") {
    const partyKey = cdi === "credit" ? "DebtorParty" : "CreditorParty";
    const party = op[partyKey] as Record<string, unknown> | undefined;
    const name = String(party?.name || "").trim();
    if (name) return name;
  }

  const nameKeys = [
    "counterpartyName", "contragentName", "beneficiaryName",
    "recipientName", "payerName", "payeeName",
  ];
  for (const k of nameKeys) {
    const v = op[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  const objKeys = ["CreditorParty", "DebtorParty", "counterparty", "contragent"];
  for (const k of objKeys) {
    const node = op[k];
    if (node && typeof node === "object") {
      const name = String((node as Record<string, unknown>).name || "").trim();
      if (name) return name;
    }
  }

  const purpose = String(op.paymentPurpose || op.description || "").toLowerCase();
  if (purpose.includes("комисс")) return "Банк Точка";
  return "";
}

function extractTransactionsBlock(resp: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(resp)) return resp;
  if (!resp || typeof resp !== "object") return [];

  const r = resp as Record<string, unknown>;

  // Try common paths
  const data = r.Data as Record<string, unknown> | undefined;
  if (data) {
    const txns = data.Transactions || data.Transaction;
    if (Array.isArray(txns)) return txns;

    const stmt = data.Statement;
    if (stmt && typeof stmt === "object" && !Array.isArray(stmt)) {
      const s = stmt as Record<string, unknown>;
      const inner = s.Transactions || s.Transaction;
      if (Array.isArray(inner)) return inner;
    }
    if (Array.isArray(stmt)) {
      const all: Array<Record<string, unknown>> = [];
      for (const item of stmt) {
        if (item && typeof item === "object") {
          const inner = (item as Record<string, unknown>).Transactions || (item as Record<string, unknown>).Transaction;
          if (Array.isArray(inner)) all.push(...inner);
        }
      }
      if (all.length) return all;
    }
  }

  for (const key of ["transactions", "items"]) {
    if (Array.isArray(r[key])) return r[key] as Array<Record<string, unknown>>;
  }

  return [];
}

export const tochkaAdapter: BankAdapter = {
  async testConnection(token) {
    try {
      const res = await fetch(`${BASE}/balances`, { headers: authHeader(token) });
      return res.ok;
    } catch {
      return false;
    }
  },

  async fetchAccounts(token) {
    const res = await fetch(`${BASE}/balances`, { headers: authHeader(token) });
    if (!res.ok) throw new Error(`Tochka balances error: ${res.status}`);
    const body = await res.json();

    const data = (body as Record<string, unknown>).Data as Record<string, unknown> | undefined;
    const balances: Array<Record<string, unknown>> =
      (data?.Balances || data?.Balance || (body as Record<string, unknown>).balances || []) as Array<Record<string, unknown>>;

    const accounts: BankAccount[] = [];
    const seen = new Set<string>();

    for (const b of balances) {
      const accId = String(b.accountId || b.AccountId || b.id || "");
      if (!accId.includes("/")) continue;
      if (seen.has(accId)) continue;
      seen.add(accId);

      const [num, bic] = accId.split("/", 2);
      accounts.push({
        accountNumber: num,
        name: `р/с ${num}`,
        bic,
      });
    }
    return accounts;
  },

  async fetchTransactions(token, account, from, to) {
    const accNum = account.accountNumber;
    const bic = account.bic;
    if (!bic) throw new Error("Tochka account requires BIC");

    const accountId = `${accNum}/${bic}`;
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    // Next day for endDateTime to cover the full last day
    const endDate = new Date(to);
    endDate.setDate(endDate.getDate() + 1);
    const endStr = endDate.toISOString().slice(0, 10);

    // Step 1: Initiate statement
    const initBody = {
      Data: {
        Statement: {
          accountId,
          startDateTime: `${fromStr}T00:00:00+03:00`,
          endDateTime: `${endStr}T00:00:00+03:00`,
        },
      },
    };

    const initRes = await fetch(`${BASE}/statements`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify(initBody),
    });
    if (!initRes.ok) {
      const errText = await initRes.text().catch(() => "");
      throw new Error(`Tochka init statement error: ${initRes.status} ${errText.slice(0, 500)}`);
    }
    const initData = await initRes.json();
    const statementId =
      (initData as Record<string, unknown>).Data &&
      ((initData as Record<string, unknown>).Data as Record<string, unknown>).Statement
        ? (((initData as Record<string, unknown>).Data as Record<string, unknown>).Statement as Record<string, unknown>).statementId
        : null;
    if (!statementId) throw new Error("No statementId from Tochka");

    // Step 2: Poll until ready
    let ready = false;
    let stmtBody: unknown = null;

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);

      try {
        const listRes = await fetch(`${BASE}/statements`, {
          headers: authHeader(token),
        });
        if (!listRes.ok) continue;
        const listData = await listRes.json();
        const ld = listData as Record<string, unknown>;
        const dataObj = ld.Data as Record<string, unknown> | undefined;
        const items: Array<Record<string, unknown>> =
          (dataObj?.Statements || dataObj?.Statement || ld.statements || ld.items || []) as Array<Record<string, unknown>>;

        for (const item of items) {
          const sid = item.statementId || item.id;
          const status = String(item.status || item.Status || "").toLowerCase();
          if (String(sid) === String(statementId) && status === "ready") {
            // Fetch the actual statement body
            const stmtRes = await fetch(
              `${BASE}/accounts/${accNum}/${bic}/statements/${statementId}`,
              { headers: authHeader(token) },
            );
            if (stmtRes.ok) stmtBody = await stmtRes.json();
            ready = true;
            break;
          }
        }
      } catch {
        // retry
      }
      if (ready) break;
    }

    if (!ready) {
      // Try direct fetch as fallback
      const directRes = await fetch(
        `${BASE}/accounts/${accNum}/${bic}/statements/${statementId}`,
        { headers: authHeader(token) },
      );
      if (directRes.ok) stmtBody = await directRes.json();
    }

    // Step 3: Extract transactions
    let ops = stmtBody ? extractTransactionsBlock(stmtBody) : [];

    if (ops.length === 0) {
      // Try /transactions endpoint
      const txRes = await fetch(
        `${BASE}/accounts/${accNum}/${bic}/statements/${statementId}/transactions`,
        { headers: authHeader(token) },
      );
      if (txRes.ok) {
        const txBody = await txRes.json();
        ops = extractTransactionsBlock(txBody);
      }
    }

    const transactions: BankTransactionRaw[] = [];
    for (const op of ops) {
      const dtStr = String(op.documentProcessDate || op.operationDate || op.postingDate || op.createdAt || op.date || "");
      const { date, time } = parseDateMsk(dtStr);
      if (!date) continue;

      // Filter by requested date range
      if (date < fromStr || date > toStr) continue;

      const amount = extractAmount(op);
      if (amount == null) continue;

      const direction = extractDirection(op);
      const counterparty = extractCounterparty(op);
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

    return transactions;
  },
};
