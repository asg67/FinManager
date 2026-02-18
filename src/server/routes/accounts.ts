import { Router, Request, Response } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createAccountSchema, updateAccountSchema } from "../schemas/account.js";

const router = Router({ mergeParams: true });

router.use(authMiddleware);

// Helper: check entity ownership
async function checkEntityAccess(entityId: string, userId: string, role: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) return { error: 404 as const, message: "Entity not found" };

  if (role === "owner") {
    if (entity.ownerId !== userId) return { error: 403 as const, message: "Access denied" };
  } else {
    const access = await prisma.entityAccess.findUnique({
      where: { userId_entityId: { userId, entityId } },
    });
    if (!access) return { error: 403 as const, message: "Access denied" };
  }

  return { entity };
}

// GET /api/entities/:entityId/accounts
router.get("/", async (req: Request, res: Response) => {
  try {
    const check = await checkEntityAccess(req.params.entityId, req.user!.userId, req.user!.role);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const accounts = await prisma.account.findMany({
      where: { entityId: req.params.entityId },
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
    if (req.user!.role !== "owner") {
      res.status(403).json({ message: "Only owners can create accounts" });
      return;
    }

    const check = await checkEntityAccess(req.params.entityId, req.user!.userId, req.user!.role);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const account = await prisma.account.create({
      data: {
        name: req.body.name,
        type: req.body.type,
        bank: req.body.bank,
        accountNumber: req.body.accountNumber,
        contractNumber: req.body.contractNumber,
        entityId: req.params.entityId,
      },
    });

    res.status(201).json(account);
  } catch (error) {
    console.error("Create account error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/entities/:entityId/accounts/:id
router.put("/:id", validate(updateAccountSchema), async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== "owner") {
      res.status(403).json({ message: "Only owners can update accounts" });
      return;
    }

    const check = await checkEntityAccess(req.params.entityId, req.user!.userId, req.user!.role);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const account = await prisma.account.findFirst({
      where: { id: req.params.id, entityId: req.params.entityId },
    });
    if (!account) {
      res.status(404).json({ message: "Account not found" });
      return;
    }

    const updated = await prisma.account.update({
      where: { id: req.params.id },
      data: req.body,
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
    if (req.user!.role !== "owner") {
      res.status(403).json({ message: "Only owners can delete accounts" });
      return;
    }

    const check = await checkEntityAccess(req.params.entityId, req.user!.userId, req.user!.role);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
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
