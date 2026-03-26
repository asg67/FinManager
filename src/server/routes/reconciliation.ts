import { Router, Request, Response } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { buildEntityFilter } from "../helpers/entityAccess.js";

const router = Router();
router.use(authMiddleware);

// POST /api/reconciliation/auto-match — find and link matching DDS ↔ Bank transactions
router.post("/auto-match", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const entityWhere = await buildEntityFilter(userId);

    // Find unlinked DDS operations (income/expense, not transfers)
    const unlinkedDds = await prisma.ddsOperation.findMany({
      where: {
        linkedBankTxId: null,
        operationType: { in: ["income", "expense"] },
        entity: entityWhere,
      },
      include: {
        fromAccount: { select: { id: true, entityId: true } },
        toAccount: { select: { id: true, entityId: true } },
      },
    });

    // Find unlinked bank transactions
    const unlinkedBank = await prisma.bankTransaction.findMany({
      where: {
        linkedDdsOp: { is: null },
        account: { entity: entityWhere },
      },
      select: {
        id: true,
        date: true,
        amount: true,
        direction: true,
        accountId: true,
        account: { select: { entityId: true } },
      },
    });

    let matched = 0;

    for (const dds of unlinkedDds) {
      // Determine the account for matching
      const ddsAccountId = dds.operationType === "expense"
        ? dds.fromAccountId
        : dds.toAccountId;
      if (!ddsAccountId) continue;

      const ddsEntityId = dds.entityId;
      const ddsAmount = Number(dds.amount);
      const ddsDate = new Date(dds.createdAt);
      ddsDate.setHours(0, 0, 0, 0);

      // Find matching bank transaction: same entity, same direction, same amount, date ±1 day
      const match = unlinkedBank.find((bt) => {
        if (bt.account.entityId !== ddsEntityId) return false;
        if (bt.direction !== dds.operationType) return false;
        if (Math.abs(Number(bt.amount) - ddsAmount) > 0.01) return false;

        const btDate = new Date(bt.date);
        btDate.setHours(0, 0, 0, 0);
        const diffDays = Math.abs(ddsDate.getTime() - btDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 1;
      });

      if (match) {
        await prisma.ddsOperation.update({
          where: { id: dds.id },
          data: { linkedBankTxId: match.id },
        });
        // Remove from candidates
        const idx = unlinkedBank.indexOf(match);
        if (idx >= 0) unlinkedBank.splice(idx, 1);
        matched++;
      }
    }

    res.json({ matched });
  } catch (error) {
    console.error("Auto-match error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/reconciliation/link — manually link a DDS operation to a bank transaction
router.post("/link", async (req: Request, res: Response) => {
  try {
    const { ddsOperationId, bankTransactionId } = req.body;
    if (!ddsOperationId || !bankTransactionId) {
      res.status(400).json({ message: "ddsOperationId and bankTransactionId required" });
      return;
    }

    // Verify both exist and belong to user
    const dds = await prisma.ddsOperation.findUnique({ where: { id: ddsOperationId } });
    const bt = await prisma.bankTransaction.findUnique({ where: { id: bankTransactionId } });

    if (!dds || !bt) {
      res.status(404).json({ message: "Operation or transaction not found" });
      return;
    }

    await prisma.ddsOperation.update({
      where: { id: ddsOperationId },
      data: { linkedBankTxId: bankTransactionId },
    });

    res.json({ linked: true });
  } catch (error) {
    console.error("Link error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/reconciliation/unlink — unlink a DDS operation from its bank transaction
router.post("/unlink", async (req: Request, res: Response) => {
  try {
    const { ddsOperationId } = req.body;
    if (!ddsOperationId) {
      res.status(400).json({ message: "ddsOperationId required" });
      return;
    }

    await prisma.ddsOperation.update({
      where: { id: ddsOperationId },
      data: { linkedBankTxId: null },
    });

    res.json({ unlinked: true });
  } catch (error) {
    console.error("Unlink error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/reconciliation/status — get reconciliation stats
router.get("/status", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const entityWhere = await buildEntityFilter(userId);

    const [totalDds, linkedDds, totalBank, linkedBank] = await Promise.all([
      prisma.ddsOperation.count({
        where: { entity: entityWhere, operationType: { in: ["income", "expense"] } },
      }),
      prisma.ddsOperation.count({
        where: { entity: entityWhere, linkedBankTxId: { not: null } },
      }),
      prisma.bankTransaction.count({
        where: { account: { entity: entityWhere } },
      }),
      prisma.bankTransaction.count({
        where: { account: { entity: entityWhere }, linkedDdsOp: { isNot: null } },
      }),
    ]);

    res.json({
      dds: { total: totalDds, linked: linkedDds, unlinked: totalDds - linkedDds },
      bank: { total: totalBank, linked: linkedBank, unlinked: totalBank - linkedBank },
    });
  } catch (error) {
    console.error("Reconciliation status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
