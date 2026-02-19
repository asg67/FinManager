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
import { syncConnection, BANK_NAMES } from "../bank-api/sync.js";

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

// GET /api/bank-connections/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const result = await loadConnection(req.params.id, req.user!.userId);
    if ("error" in result) {
      res.status(result.error).json({ message: result.message });
      return;
    }
    res.json(toClientConnection(result.conn));
  } catch (error) {
    console.error("Get bank connection error:", error);
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

// ---------- Local Accounts ----------

// GET /api/bank-connections/:id/local-accounts
router.get("/:id/local-accounts", async (req: Request, res: Response) => {
  try {
    const result = await loadConnection(req.params.id, req.user!.userId);
    if ("error" in result) {
      res.status(result.error).json({ message: result.message });
      return;
    }

    const { conn } = result;
    const bankName = BANK_NAMES[conn.bankCode] || conn.bankCode;

    const accounts = await prisma.account.findMany({
      where: { entityId: conn.entityId, bank: bankName },
      orderBy: { name: "asc" },
    });

    res.json(accounts);
  } catch (error) {
    console.error("List local accounts error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------- Transactions ----------

// GET /api/bank-connections/:id/transactions
router.get("/:id/transactions", async (req: Request, res: Response) => {
  try {
    const result = await loadConnection(req.params.id, req.user!.userId);
    if ("error" in result) {
      res.status(result.error).json({ message: result.message });
      return;
    }

    const { conn } = result;
    const bankName = BANK_NAMES[conn.bankCode] || conn.bankCode;

    const { direction, from, to, accountId, page, limit } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Find all local accounts for this connection
    const connAccounts = await prisma.account.findMany({
      where: { entityId: conn.entityId, bank: bankName },
      select: { id: true },
    });
    const accountIds = connAccounts.map((a) => a.id);

    if (accountIds.length === 0) {
      res.json({ data: [], total: 0, page: pageNum, limit: limitNum, totalPages: 0 });
      return;
    }

    const where: Prisma.BankTransactionWhereInput = {
      accountId: accountId ? accountId : { in: accountIds },
    };
    if (direction) where.direction = direction;
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, Date>).gte = new Date(from);
      if (to) (where.date as Record<string, Date>).lte = new Date(to);
    }

    const [transactions, total] = await Promise.all([
      prisma.bankTransaction.findMany({
        where,
        include: { account: { select: { name: true, type: true, bank: true } } },
        orderBy: { date: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.bankTransaction.count({ where }),
    ]);

    res.json({
      data: transactions,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("List connection transactions error:", error);
    res.status(500).json({ message: "Internal server error" });
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

      const { from, to } = req.body;
      const syncResult = await syncConnection(req.params.id, new Date(from), new Date(to));
      res.json(syncResult);
    } catch (error) {
      console.error("Sync bank connection error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default router;
