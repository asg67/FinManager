import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { config } from "../config.js";
import { authMiddleware, JwtPayload } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createCompanySchema, updateCompanySchema, registerInviteSchema } from "../schemas/company.js";

const router = Router();

function generateTokens(userId: string, role: string) {
  const accessToken = jwt.sign(
    { userId, role } satisfies JwtPayload,
    config.JWT_SECRET,
    { expiresIn: "15m" },
  );
  const refreshToken = jwt.sign(
    { userId, role, type: "refresh" },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN },
  );
  return { accessToken, refreshToken };
}

// ===== PUBLIC: Invite validation =====

// GET /api/company/invite/:token — check invite validity (no auth required)
router.get("/invite/:token", async (req: Request, res: Response) => {
  try {
    const invite = await prisma.invite.findUnique({
      where: { token: req.params.token },
      include: { company: { select: { name: true } } },
    });

    if (!invite || invite.expiresAt < new Date()) {
      res.status(404).json({ message: "Invite not found or expired" });
      return;
    }

    res.json({ companyName: invite.company.name, companyId: invite.companyId });
  } catch (error) {
    console.error("Check invite error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/company/register-invite — register via invite link (no auth required)
router.post("/register-invite", validate(registerInviteSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name, token } = req.body;

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { company: true },
    });

    if (!invite || invite.expiresAt < new Date()) {
      res.status(400).json({ message: "Invite not found or expired" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: "member",
        companyId: invite.companyId,
        invitedById: invite.createdById,
        permission: {
          create: {
            dds: true,
            pdfUpload: true,
            analytics: true,
            export: true,
          },
        },
      },
      include: { company: true },
    });

    const tokens = generateTokens(user.id, user.role);

    res.status(201).json({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        language: user.language,
        theme: user.theme,
        role: user.role,
        companyId: user.companyId,
        company: user.company ? {
          id: user.company.id,
          name: user.company.name,
          onboardingDone: user.company.onboardingDone,
          createdAt: user.company.createdAt.toISOString(),
        } : null,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Register invite error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== AUTHENTICATED ROUTES =====

router.use(authMiddleware);

// POST /api/company/join — join company via invite token (existing user)
router.post("/join", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ message: "Token is required" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (user.companyId) {
      res.status(400).json({ message: "You already belong to a company" });
      return;
    }

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { company: true },
    });

    if (!invite || invite.expiresAt < new Date()) {
      res.status(400).json({ message: "Invite not found or expired" });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        companyId: invite.companyId,
        role: "member",
        invitedById: invite.createdById,
      },
      include: { company: true },
    });

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      language: updatedUser.language,
      theme: updatedUser.theme,
      role: updatedUser.role,
      companyId: updatedUser.companyId,
      company: updatedUser.company ? {
        id: updatedUser.company.id,
        name: updatedUser.company.name,
        onboardingDone: updatedUser.company.onboardingDone,
        createdAt: updatedUser.company.createdAt.toISOString(),
      } : null,
      createdAt: updatedUser.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Join company error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/company — create company
router.post("/", validate(createCompanySchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Check for duplicate name
    const existing = await prisma.company.findUnique({ where: { name: req.body.name } });
    if (existing) {
      res.status(409).json({ message: "Company with this name already exists" });
      return;
    }

    const company = await prisma.company.create({
      data: {
        name: req.body.name,
        createdById: userId,
        users: { connect: { id: userId } },
      },
    });

    // Switch user to the new company
    await prisma.user.update({
      where: { id: userId },
      data: { companyId: company.id },
    });

    res.status(201).json({
      id: company.id,
      name: company.name,
      onboardingDone: company.onboardingDone,
      createdAt: company.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Create company error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/company — get current user's company
router.get("/", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { company: true },
    });

    if (!user?.company) {
      res.status(404).json({ message: "No company" });
      return;
    }

    res.json({
      id: user.company.id,
      name: user.company.name,
      onboardingDone: user.company.onboardingDone,
      createdAt: user.company.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Get company error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/company — update company name (owner only)
router.put("/", validate(updateCompanySchema), async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== "owner") {
      res.status(403).json({ message: "Only owners can update company" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.companyId) {
      res.status(404).json({ message: "No company" });
      return;
    }

    const company = await prisma.company.update({
      where: { id: user.companyId },
      data: { name: req.body.name },
    });

    res.json({
      id: company.id,
      name: company.name,
      onboardingDone: company.onboardingDone,
      createdAt: company.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Update company error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/company/onboarding-status
router.get("/onboarding-status", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { company: true },
    });

    if (!user?.company) {
      res.json({ hasEntities: false, hasAccounts: false, hasExpenseTypes: false, done: false });
      return;
    }

    const [entityCount, accountCount, expenseTypeCount] = await Promise.all([
      prisma.entity.count({ where: { companyId: user.companyId! } }),
      prisma.account.count({ where: { entity: { companyId: user.companyId! } } }),
      prisma.expenseType.count({ where: { entity: { companyId: user.companyId! } } }),
    ]);

    res.json({
      hasEntities: entityCount > 0,
      hasAccounts: accountCount > 0,
      hasExpenseTypes: expenseTypeCount > 0,
      done: user.company.onboardingDone,
    });
  } catch (error) {
    console.error("Onboarding status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/company/complete-onboarding
router.post("/complete-onboarding", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { company: true },
    });

    if (!user?.companyId) {
      res.status(400).json({ message: "No company" });
      return;
    }

    // Verify all steps are done
    const [entityCount, accountCount, expenseTypeCount] = await Promise.all([
      prisma.entity.count({ where: { companyId: user.companyId } }),
      prisma.account.count({ where: { entity: { companyId: user.companyId } } }),
      prisma.expenseType.count({ where: { entity: { companyId: user.companyId } } }),
    ]);

    if (entityCount === 0 || accountCount === 0 || expenseTypeCount === 0) {
      res.status(400).json({ message: "Please complete all onboarding steps first" });
      return;
    }

    await prisma.company.update({
      where: { id: user.companyId },
      data: { onboardingDone: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Complete onboarding error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/company/invites — create invite link (owner only)
router.post("/invites", async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== "owner") {
      res.status(403).json({ message: "Only owners can create invites" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.companyId) {
      res.status(400).json({ message: "No company" });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invite = await prisma.invite.create({
      data: {
        companyId: user.companyId,
        createdById: user.id,
        expiresAt,
      },
    });

    res.status(201).json({
      id: invite.id,
      token: invite.token,
      expiresAt: invite.expiresAt.toISOString(),
      used: false,
      createdAt: invite.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Create invite error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/company/invites — list invites (owner only)
router.get("/invites", async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== "owner") {
      res.status(403).json({ message: "Only owners can view invites" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.companyId) {
      res.status(400).json({ message: "No company" });
      return;
    }

    const invites = await prisma.invite.findMany({
      where: { companyId: user.companyId },
      include: { usedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(invites.map((inv) => ({
      id: inv.id,
      token: inv.token,
      expiresAt: inv.expiresAt.toISOString(),
      used: !!inv.usedById,
      usedByName: inv.usedBy?.name,
      createdAt: inv.createdAt.toISOString(),
    })));
  } catch (error) {
    console.error("List invites error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/company/invites/:id — delete invite (owner only)
router.delete("/invites/:id", async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== "owner") {
      res.status(403).json({ message: "Only owners can delete invites" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.companyId) {
      res.status(400).json({ message: "No company" });
      return;
    }

    const invite = await prisma.invite.findFirst({
      where: { id: req.params.id, companyId: user.companyId },
    });
    if (!invite) {
      res.status(404).json({ message: "Invite not found" });
      return;
    }

    await prisma.invite.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Delete invite error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/company/members — list company members
router.get("/members", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.companyId) {
      res.status(400).json({ message: "No company" });
      return;
    }

    const members = await prisma.user.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    res.json(members.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })));
  } catch (error) {
    console.error("List members error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/company/expense-types — list all expense types across all entities in the company
router.get("/expense-types", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.companyId) {
      res.status(400).json({ message: "No company" });
      return;
    }

    const types = await prisma.expenseType.findMany({
      where: { entity: { companyId: user.companyId } },
      include: { articles: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    });

    res.json(types.map((t) => ({
      id: t.id,
      name: t.name,
      entityId: t.entityId,
      articles: t.articles.map((a) => ({
        id: a.id,
        name: a.name,
        expenseTypeId: a.expenseTypeId,
      })),
    })));
  } catch (error) {
    console.error("List company expense types error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/company/my-companies — list companies created by this user
router.get("/my-companies", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const companies = await prisma.company.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true, entities: true } },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });

    res.json(companies.map((c) => ({
      id: c.id,
      name: c.name,
      onboardingDone: c.onboardingDone,
      isActive: c.id === user?.companyId,
      usersCount: c._count.users,
      entitiesCount: c._count.entities,
      createdAt: c.createdAt.toISOString(),
    })));
  } catch (error) {
    console.error("My companies error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/company/switch/:id — switch active company
router.post("/switch/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const companyId = req.params.id;

    const company = await prisma.company.findFirst({
      where: { id: companyId, createdById: userId },
    });

    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { companyId: company.id },
      include: { company: true },
    });

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      language: updatedUser.language,
      theme: updatedUser.theme,
      role: updatedUser.role,
      companyId: updatedUser.companyId,
      company: updatedUser.company ? {
        id: updatedUser.company.id,
        name: updatedUser.company.name,
        onboardingDone: updatedUser.company.onboardingDone,
        createdAt: updatedUser.company.createdAt.toISOString(),
      } : null,
      createdAt: updatedUser.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Switch company error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
