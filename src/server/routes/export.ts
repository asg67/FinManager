import { Router, Request, Response } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.use(authMiddleware);

// GET /api/export/dds — export DDS operations as CSV
router.get("/dds", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    // Check export permission for employees
    if (role === "employee") {
      const permission = await prisma.permission.findUnique({ where: { userId } });
      if (!permission?.export) {
        res.status(403).json({ message: "Export permission required" });
        return;
      }
    }

    const { entityId, from, to } = req.query;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (role === "owner") {
      // Owner sees their own entities
      const ownerEntities = await prisma.entity.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      const entityIds = ownerEntities.map((e) => e.id);
      where.entityId = entityId ? { in: [entityId as string].filter((id) => entityIds.includes(id)) } : { in: entityIds };
    } else {
      // Employee sees entities they have access to
      const accessEntities = await prisma.entityAccess.findMany({
        where: { userId },
        select: { entityId: true },
      });
      const entityIds = accessEntities.map((ea) => ea.entityId);
      where.entityId = entityId ? { in: [entityId as string].filter((id) => entityIds.includes(id)) } : { in: entityIds };
    }

    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from as string);
      if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to as string);
    }

    const operations = await prisma.ddsOperation.findMany({
      where,
      include: {
        entity: { select: { name: true } },
        fromAccount: { select: { name: true } },
        toAccount: { select: { name: true } },
        expenseType: { select: { name: true } },
        expenseArticle: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Build CSV
    const BOM = "\uFEFF"; // UTF-8 BOM for Excel
    const header = "Date,Type,Entity,Amount,From Account,To Account,Category,Article,Order Number,Comment";
    const rows = operations.map((op) => {
      const date = op.createdAt.toISOString().slice(0, 10);
      const type = op.operationType;
      const entity = csvEscape(op.entity.name);
      const amount = op.amount.toString();
      const fromAcc = csvEscape(op.fromAccount?.name ?? "");
      const toAcc = csvEscape(op.toAccount?.name ?? "");
      const category = csvEscape(op.expenseType?.name ?? "");
      const article = csvEscape(op.expenseArticle?.name ?? "");
      const orderNum = csvEscape(op.orderNumber ?? "");
      const comment = csvEscape(op.comment ?? "");
      return `${date},${type},${entity},${amount},${fromAcc},${toAcc},${category},${article},${orderNum},${comment}`;
    });

    const csv = BOM + header + "\n" + rows.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="dds-export-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error("Export DDS error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default router;
