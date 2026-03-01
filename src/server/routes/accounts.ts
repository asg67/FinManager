import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createAccountSchema, updateAccountSchema } from "../schemas/account.js";

const router = Router({ mergeParams: true });

router.use(authMiddleware);

// Helper: check entity access via company or personal ownership
async function checkEntityAccess(entityId: string, userId: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) return { error: 404 as const, message: "Entity not found" };

  const user = await prisma.user.findUnique({ where: { id: userId } });

  // Company access: user and entity in same company
  if (user?.companyId && entity.companyId === user.companyId) {
    return { entity };
  }

  // Personal access: entity has no company and user owns it
  if (entity.companyId === null && entity.ownerId === userId) {
    return { entity };
  }

  return { error: 403 as const, message: "Access denied" };
}

// GET /api/entities/:entityId/accounts
router.get("/", async (req: Request, res: Response) => {
  try {
    const check = await checkEntityAccess(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const where: Record<string, unknown> = { entityId: req.params.entityId };
    if (req.query.source) where.source = req.query.source;

    const accounts = await prisma.account.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

    res.json(accounts);
  } catch (error) {
    console.error("List accounts error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/entities/:entityId/accounts
router.post("/", validate(createAccountSchema), async (req: Request, res: Response) => {
  try {
    const check = await checkEntityAccess(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    // In company mode, only owners can create accounts
    if (check.entity.companyId && req.user!.role !== "owner") {
      res.status(403).json({ message: "Only owners can create accounts" });
      return;
    }

    const data: any = {
      name: req.body.name,
      type: req.body.type,
      bank: req.body.bank,
      accountNumber: req.body.accountNumber,
      contractNumber: req.body.contractNumber,
      entityId: req.params.entityId,
    };
    if (req.body.initialBalance != null) {
      data.initialBalance = new Prisma.Decimal(String(req.body.initialBalance));
    }
    if (req.body.initialBalanceDate) {
      data.initialBalanceDate = new Date(req.body.initialBalanceDate);
    }

    const account = await prisma.account.create({ data });

    res.status(201).json(account);
  } catch (error) {
    console.error("Create account error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/entities/:entityId/accounts/:id
router.put("/:id", validate(updateAccountSchema), async (req: Request, res: Response) => {
  try {
    const check = await checkEntityAccess(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    // In company mode, only owners can update accounts
    if (check.entity.companyId && req.user!.role !== "owner") {
      res.status(403).json({ message: "Only owners can update accounts" });
      return;
    }

    const account = await prisma.account.findFirst({
      where: { id: req.params.id, entityId: req.params.entityId },
    });
    if (!account) {
      res.status(404).json({ message: "Account not found" });
      return;
    }

    const updateData: any = { ...req.body };
    if (updateData.initialBalance !== undefined) {
      updateData.initialBalance = updateData.initialBalance != null
        ? new Prisma.Decimal(String(updateData.initialBalance))
        : null;
    }
    if (updateData.initialBalanceDate !== undefined) {
      updateData.initialBalanceDate = updateData.initialBalanceDate
        ? new Date(updateData.initialBalanceDate)
        : null;
    }

    const updated = await prisma.account.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(updated);
  } catch (error) {
    console.error("Update account error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/entities/:entityId/accounts/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const check = await checkEntityAccess(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    // In company mode, only owners can delete accounts
    if (check.entity.companyId && req.user!.role !== "owner") {
      res.status(403).json({ message: "Only owners can delete accounts" });
      return;
    }

    const account = await prisma.account.findFirst({
      where: { id: req.params.id, entityId: req.params.entityId },
    });
    if (!account) {
      res.status(404).json({ message: "Account not found" });
      return;
    }

    await prisma.account.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
