import { Router, Request, Response } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { createExcelResponse } from "../utils/excel.js";

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

// Helper: get entity IDs for current user
async function getUserEntityIds(userId: string, role: string, filterEntityId?: string): Promise<string[]> {
  let entityIds: string[];
  if (role === "owner") {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const entities = await prisma.entity.findMany({
      where: user?.companyId ? { companyId: user.companyId } : { ownerId: userId },
      select: { id: true },
    });
    entityIds = entities.map((e) => e.id);
  } else {
    const access = await prisma.entityAccess.findMany({ where: { userId }, select: { entityId: true } });
    entityIds = access.map((a) => a.entityId);
  }
  if (filterEntityId) return entityIds.filter((id) => id === filterEntityId);
  return entityIds;
}

// Helper: check export permission
async function checkExportPermission(userId: string, role: string): Promise<boolean> {
  if (role !== "employee") return true;
  const perm = await prisma.permission.findUnique({ where: { userId } });
  return !!perm?.export;
}

// GET /api/export/dds-excel — DDS operations as Excel
router.get("/dds-excel", async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.user!;
    if (!(await checkExportPermission(userId, role))) {
      res.status(403).json({ message: "Export permission required" });
      return;
    }

    const { entityId, from, to } = req.query as Record<string, string>;
    const entityIds = await getUserEntityIds(userId, role, entityId);

    const where: Record<string, unknown> = { entityId: { in: entityIds } };
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as any).gte = new Date(from);
      if (to) (where.createdAt as any).lte = new Date(to + "T23:59:59");
    }

    const ops = await prisma.ddsOperation.findMany({
      where,
      include: {
        entity: { select: { name: true } },
        user: { select: { name: true } },
        fromAccount: { select: { name: true } },
        toAccount: { select: { name: true } },
        expenseType: { select: { name: true } },
        expenseArticle: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const typeLabels: Record<string, string> = { income: "Приход", expense: "Расход", transfer: "Перевод" };

    const rows = ops.map((op) => ({
      date: op.createdAt.toLocaleDateString("ru-RU"),
      user: op.user?.name ?? "",
      entity: op.entity.name,
      type: typeLabels[op.operationType] ?? op.operationType,
      from: op.fromAccount?.name ?? "",
      to: op.toAccount?.name ?? "",
      amount: op.amount.toNumber(),
      category: op.expenseType?.name ?? "",
      article: op.expenseArticle?.name ?? "",
      orderNumber: op.orderNumber ?? "",
      comment: op.comment ?? "",
    }));

    await createExcelResponse(res, `dds-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { header: "Дата", key: "date", width: 12 },
      { header: "Пользователь", key: "user", width: 20 },
      { header: "Юрлицо", key: "entity", width: 22 },
      { header: "Тип", key: "type", width: 10 },
      { header: "Со счёта", key: "from", width: 22 },
      { header: "На счёт", key: "to", width: 22 },
      { header: "Сумма", key: "amount", width: 15 },
      { header: "Категория", key: "category", width: 18 },
      { header: "Статья", key: "article", width: 18 },
      { header: "№ заказа", key: "orderNumber", width: 14 },
      { header: "Комментарий", key: "comment", width: 30 },
    ], rows);
  } catch (error) {
    console.error("Export DDS Excel error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/export/statements-excel — PDF bank transactions as Excel
router.get("/statements-excel", async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.user!;
    if (!(await checkExportPermission(userId, role))) {
      res.status(403).json({ message: "Export permission required" });
      return;
    }

    const { bankCode, from, to } = req.query as Record<string, string>;
    const entityIds = await getUserEntityIds(userId, role);

    const where: Record<string, unknown> = {
      pdfUploadId: { not: null },
      account: { entityId: { in: entityIds } },
    };
    if (bankCode) where.pdfUpload = { bankCode };
    if (from || to) {
      where.date = {};
      if (from) (where.date as any).gte = new Date(from);
      if (to) (where.date as any).lte = new Date(to + "T23:59:59");
    }

    const txs = await prisma.bankTransaction.findMany({
      where,
      include: { account: { select: { name: true } } },
      orderBy: { date: "desc" },
    });

    const rows = txs.map((tx) => ({
      date: tx.date.toLocaleDateString("ru-RU"),
      time: tx.time ?? "",
      account: tx.account.name,
      amount: tx.amount.toNumber(),
      direction: tx.direction === "income" ? "Приход" : "Расход",
      counterparty: tx.counterparty ?? "",
      purpose: tx.purpose ?? "",
      balance: tx.balance?.toNumber() ?? "",
    }));

    const bankLabel = bankCode ?? "all";
    await createExcelResponse(res, `statements-${bankLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { header: "Дата", key: "date", width: 12 },
      { header: "Время", key: "time", width: 8 },
      { header: "Счёт", key: "account", width: 25 },
      { header: "Сумма", key: "amount", width: 15 },
      { header: "Направление", key: "direction", width: 12 },
      { header: "Контрагент", key: "counterparty", width: 30 },
      { header: "Назначение", key: "purpose", width: 40 },
      { header: "Остаток", key: "balance", width: 15 },
    ], rows);
  } catch (error) {
    console.error("Export statements Excel error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/export/bank-tx-excel — Bank connection transactions as Excel
router.get("/bank-tx-excel", async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.user!;
    if (!(await checkExportPermission(userId, role))) {
      res.status(403).json({ message: "Export permission required" });
      return;
    }

    const { connectionId, from, to, accountId } = req.query as Record<string, string>;
    if (!connectionId) {
      res.status(400).json({ message: "connectionId required" });
      return;
    }

    const conn = await prisma.bankConnection.findUnique({ where: { id: connectionId } });
    if (!conn) {
      res.status(404).json({ message: "Connection not found" });
      return;
    }

    const where: Record<string, unknown> = {
      account: { entityId: conn.entityId },
      pdfUploadId: null,
    };
    if (accountId) where.accountId = accountId;
    if (from || to) {
      where.date = {};
      if (from) (where.date as any).gte = new Date(from);
      if (to) (where.date as any).lte = new Date(to + "T23:59:59");
    }

    const txs = await prisma.bankTransaction.findMany({
      where,
      include: { account: { select: { name: true } } },
      orderBy: { date: "desc" },
    });

    const rows = txs.map((tx) => ({
      date: tx.date.toLocaleDateString("ru-RU"),
      time: tx.time ?? "",
      account: tx.account.name,
      amount: tx.amount.toNumber(),
      direction: tx.direction === "income" ? "Приход" : "Расход",
      counterparty: tx.counterparty ?? "",
      purpose: tx.purpose ?? "",
      balance: tx.balance?.toNumber() ?? "",
    }));

    await createExcelResponse(res, `bank-tx-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { header: "Дата", key: "date", width: 12 },
      { header: "Время", key: "time", width: 8 },
      { header: "Счёт", key: "account", width: 25 },
      { header: "Сумма", key: "amount", width: 15 },
      { header: "Направление", key: "direction", width: 12 },
      { header: "Контрагент", key: "counterparty", width: 30 },
      { header: "Назначение", key: "purpose", width: 40 },
      { header: "Остаток", key: "balance", width: 15 },
    ], rows);
  } catch (error) {
    console.error("Export bank-tx Excel error:", error);
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
