import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createBankConnectionSchema,
  updateBankConnectionSchema,
  syncBankConnectionSchema,
} from "../schemas/bankConnection.js";
import { bankAdapters } from "../bank-api/index.js";

const router = Router();
router.use(authMiddleware);

// ---------- Helpers ----------

function maskToken(token: string): string {
  if (token.length <= 4) return "****";
  return "****" + token.slice(-4);
}

function toClientConnection(conn: {
  id: string;
  entityId: string;
  bankCode: string;
  token: string;
  label: string | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: Date;
}) {
  return {
    id: conn.id,
    entityId: conn.entityId,
    bankCode: conn.bankCode,
    label: conn.label,
    tokenMasked: maskToken(conn.token),
    lastSyncAt: conn.lastSyncAt?.toISOString() ?? null,
    lastSyncStatus: conn.lastSyncStatus,
    lastSyncError: conn.lastSyncError,
    createdAt: conn.createdAt.toISOString(),
  };
}

async function checkEntityAccess(entityId: string, userId: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) return { error: 404 as const, message: "Entity not found" };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.companyId || entity.companyId !== user.companyId) {
    return { error: 403 as const, message: "Access denied" };
  }
  return { entity };
}

async function loadConnection(id: string, userId: string) {
  const conn = await prisma.bankConnection.findUnique({
    where: { id },
    include: { entity: true },
  });
  if (!conn) return { error: 404 as const, message: "Connection not found" };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.companyId || conn.entity.companyId !== user.companyId) {
    return { error: 403 as const, message: "Access denied" };
  }
  return { conn };
}

// ---------- CRUD ----------

// GET /api/bank-connections?entityId=
router.get("/", async (req: Request, res: Response) => {
  try {
    const entityId = req.query.entityId as string;
    if (!entityId) {
      res.status(400).json({ message: "entityId required" });
      return;
    }

    const check = await checkEntityAccess(entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const connections = await prisma.bankConnection.findMany({
      where: { entityId },
      orderBy: { createdAt: "asc" },
    });

    res.json(connections.map(toClientConnection));
  } catch (error) {
    console.error("List bank connections error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/bank-connections
router.post(
  "/",
  validate(createBankConnectionSchema),
  async (req: Request, res: Response) => {
    try {
      const { entityId, bankCode, token, label } = req.body;

      const check = await checkEntityAccess(entityId, req.user!.userId);
      if ("error" in check) {
        res.status(check.error).json({ message: check.message });
        return;
      }

      const conn = await prisma.bankConnection.create({
        data: { entityId, bankCode, token, label: label || null },
      });

      res.status(201).json(toClientConnection(conn));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        res.status(409).json({ message: "Connection for this bank already exists for this entity" });
        return;
      }
      console.error("Create bank connection error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// PUT /api/bank-connections/:id
router.put(
  "/:id",
  validate(updateBankConnectionSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await loadConnection(req.params.id, req.user!.userId);
      if ("error" in result) {
        res.status(result.error).json({ message: result.message });
        return;
      }

      const data: Record<string, unknown> = {};
      if (req.body.token) data.token = req.body.token;
      if (req.body.label !== undefined) data.label = req.body.label || null;

      const updated = await prisma.bankConnection.update({
        where: { id: req.params.id },
        data,
      });

      res.json(toClientConnection(updated));
    } catch (error) {
      console.error("Update bank connection error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// DELETE /api/bank-connections/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const result = await loadConnection(req.params.id, req.user!.userId);
    if ("error" in result) {
      res.status(result.error).json({ message: result.message });
      return;
    }

    await prisma.bankConnection.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Delete bank connection error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------- Test ----------

// POST /api/bank-connections/:id/test
router.post("/:id/test", async (req: Request, res: Response) => {
  try {
    const result = await loadConnection(req.params.id, req.user!.userId);
    if ("error" in result) {
      res.status(result.error).json({ message: result.message });
      return;
    }

    const adapter = bankAdapters[result.conn.bankCode];
    if (!adapter) {
      res.status(400).json({ message: `Unknown bank: ${result.conn.bankCode}` });
      return;
    }

    const ok = await adapter.testConnection(result.conn.token);
    let accountCount: number | undefined;
    if (ok) {
      try {
        const accounts = await adapter.fetchAccounts(result.conn.token);
        accountCount = accounts.length;
      } catch {
        // ok but can't list accounts
      }
    }

    res.json({ ok, accountCount });
  } catch (error) {
    console.error("Test bank connection error:", error);
    res.json({ ok: false });
  }
});

// ---------- Accounts ----------

// GET /api/bank-connections/:id/accounts
router.get("/:id/accounts", async (req: Request, res: Response) => {
  try {
    const result = await loadConnection(req.params.id, req.user!.userId);
    if ("error" in result) {
      res.status(result.error).json({ message: result.message });
      return;
    }

    const adapter = bankAdapters[result.conn.bankCode];
    if (!adapter) {
      res.status(400).json({ message: `Unknown bank: ${result.conn.bankCode}` });
      return;
    }

    const accounts = await adapter.fetchAccounts(result.conn.token);
    res.json(accounts);
  } catch (error) {
    console.error("Fetch bank accounts error:", error);
    res.status(500).json({ message: "Failed to fetch bank accounts" });
  }
});

// ---------- Sync ----------

// POST /api/bank-connections/:id/sync
router.post(
  "/:id/sync",
  validate(syncBankConnectionSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await loadConnection(req.params.id, req.user!.userId);
      if ("error" in result) {
        res.status(result.error).json({ message: result.message });
        return;
      }

      const { conn } = result;
      const adapter = bankAdapters[conn.bankCode];
      if (!adapter) {
        res.status(400).json({ message: `Unknown bank: ${conn.bankCode}` });
        return;
      }

      const { from, to } = req.body;
      const fromDate = new Date(from);
      const toDate = new Date(to);

      // Bank display names for auto-created accounts
      const bankNames: Record<string, string> = {
        tbank: "Т-Банк",
        modulbank: "Модульбанк",
        tochka: "Точка",
      };

      // 1. Fetch remote accounts
      let remoteAccounts;
      try {
        remoteAccounts = await adapter.fetchAccounts(conn.token);
      } catch (err) {
        await prisma.bankConnection.update({
          where: { id: conn.id },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: "error",
            lastSyncError: `Failed to fetch accounts: ${err instanceof Error ? err.message : String(err)}`,
          },
        });
        res.status(502).json({ message: "Failed to fetch bank accounts" });
        return;
      }

      let totalSaved = 0;
      let totalSkipped = 0;
      const errors: string[] = [];

      // 2. For each remote account
      for (const remoteAcc of remoteAccounts) {
        try {
          // Find or create local Account
          let localAccount = await prisma.account.findFirst({
            where: {
              entityId: conn.entityId,
              accountNumber: remoteAcc.accountNumber,
            },
          });

          if (!localAccount) {
            localAccount = await prisma.account.create({
              data: {
                name: `${bankNames[conn.bankCode] || conn.bankCode} ${remoteAcc.name || remoteAcc.accountNumber}`,
                type: "checking",
                bank: bankNames[conn.bankCode] || conn.bankCode,
                accountNumber: remoteAcc.accountNumber,
                entityId: conn.entityId,
              },
            });
          }

          // Fetch transactions
          const transactions = await adapter.fetchTransactions(
            conn.token,
            remoteAcc,
            fromDate,
            toDate,
          );

          // Save with deduplication (same pattern as pdf.ts:170-198)
          for (const tx of transactions) {
            const dedupeKey = `${localAccount.id}|${tx.date}|${tx.amount}|${tx.direction}`;

            const existing = await prisma.bankTransaction.findFirst({
              where: { dedupeKey },
            });

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

      res.json({
        accountsSynced: remoteAccounts.length - errors.length,
        transactionsSaved: totalSaved,
        transactionsSkipped: totalSkipped,
        errors,
      });
    } catch (error) {
      console.error("Sync bank connection error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default router;
