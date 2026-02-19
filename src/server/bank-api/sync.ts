import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { bankAdapters } from "./index.js";

export interface SyncResultData {
  accountsSynced: number;
  transactionsSaved: number;
  transactionsSkipped: number;
  errors: string[];
}

export const BANK_NAMES: Record<string, string> = {
  tbank: "Т-Банк",
  modulbank: "Модульбанк",
  tochka: "Точка",
};

/**
 * Sync a single bank connection for a given date range.
 * Reusable from both the API route and the cron job.
 */
export async function syncConnection(
  connectionId: string,
  fromDate: Date,
  toDate: Date,
): Promise<SyncResultData> {
  const conn = await prisma.bankConnection.findUnique({ where: { id: connectionId } });
  if (!conn) throw new Error("Connection not found");

  const adapter = bankAdapters[conn.bankCode];
  if (!adapter) throw new Error(`Unknown bank: ${conn.bankCode}`);

  // 1. Fetch remote accounts
  let remoteAccounts;
  try {
    remoteAccounts = await adapter.fetchAccounts(conn.token);
  } catch (err) {
    const errMsg = `Failed to fetch accounts: ${err instanceof Error ? err.message : String(err)}`;
    await prisma.bankConnection.update({
      where: { id: conn.id },
      data: { lastSyncAt: new Date(), lastSyncStatus: "error", lastSyncError: errMsg },
    });
    throw new Error(errMsg);
  }

  let totalSaved = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  // 2. For each remote account
  for (const remoteAcc of remoteAccounts) {
    try {
      // Find or create local Account
      let localAccount = await prisma.account.findFirst({
        where: { entityId: conn.entityId, accountNumber: remoteAcc.accountNumber },
      });

      if (!localAccount) {
        localAccount = await prisma.account.create({
          data: {
            name: `${BANK_NAMES[conn.bankCode] || conn.bankCode} ${remoteAcc.name || remoteAcc.accountNumber}`,
            type: "checking",
            bank: BANK_NAMES[conn.bankCode] || conn.bankCode,
            accountNumber: remoteAcc.accountNumber,
            source: "bank_sync",
            entityId: conn.entityId,
          },
        });
      }

      // Fetch transactions
      const transactions = await adapter.fetchTransactions(conn.token, remoteAcc, fromDate, toDate);

      // Save with deduplication
      for (const tx of transactions) {
        const dedupeKey = `${localAccount.id}|${tx.date}|${tx.amount}|${tx.direction}`;
        const existing = await prisma.bankTransaction.findFirst({ where: { dedupeKey } });
        if (existing) {
          totalSkipped++;
          continue;
        }

        await prisma.bankTransaction.create({
          data: {
            date: new Date(tx.date),
            time: tx.time ?? null,
            amount: new Prisma.Decimal(tx.amount),
            direction: tx.direction,
            counterparty: tx.counterparty ?? null,
            purpose: tx.purpose ?? null,
            balance: tx.balance ? new Prisma.Decimal(tx.balance) : null,
            accountId: localAccount.id,
            pdfUploadId: null,
            dedupeKey,
          },
        });
        totalSaved++;
      }
    } catch (err) {
      const msg = `Account ${remoteAcc.accountNumber}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.error("Sync account error:", msg);
    }
  }

  // 3. Update connection status
  const status =
    errors.length === 0
      ? "success"
      : errors.length < remoteAccounts.length
        ? "partial"
        : "error";

  await prisma.bankConnection.update({
    where: { id: conn.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: status,
      lastSyncError: errors.length > 0 ? errors.join("; ") : null,
    },
  });

  return {
    accountsSynced: remoteAccounts.length - errors.length,
    transactionsSaved: totalSaved,
    transactionsSkipped: totalSkipped,
    errors,
  };
}

/**
 * Sync all bank connections for yesterday (MSK).
 * Called by the daily cron job.
 */
export async function syncAllForYesterday(): Promise<void> {
  // Yesterday in MSK (UTC+3)
  const nowMsk = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const yesterday = new Date(nowMsk);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  const fromDate = new Date(dateStr);
  const toDate = new Date(dateStr);

  const connections = await prisma.bankConnection.findMany();
  console.log(`[cron] Daily bank sync: ${connections.length} connections, date=${dateStr}`);

  for (const conn of connections) {
    try {
      const result = await syncConnection(conn.id, fromDate, toDate);
      console.log(
        `[cron] ${conn.bankCode} (${conn.id}): saved=${result.transactionsSaved}, skipped=${result.transactionsSkipped}`,
      );
    } catch (err) {
      console.error(`[cron] ${conn.bankCode} (${conn.id}) error:`, err instanceof Error ? err.message : err);
    }
  }
}
