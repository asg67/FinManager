import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { prisma } from "../prisma.js";
import { config } from "../config.js";
import { validate } from "../middleware/validate.js";
import { authMiddleware, JwtPayload } from "../middleware/auth.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateProfileSchema,
  changePasswordSchema,
} from "../schemas/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../../uploads/avatars");
fs.mkdirSync(uploadsDir, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${(_req as any).user?.userId || "unknown"}_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

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

function sanitizeUser(user: {
  id: string;
  email: string;
  name: string;
  language: string;
  theme: string;
  role: string;
  companyId: string | null;
  company?: { id: string; name: string; onboardingDone: boolean; createdAt: Date } | null;
  avatar?: string | null;
  sberAccountNumber?: string | null;
  tbankCardCode?: string | null;
  tbankDepositContract?: string | null;
  createdAt: Date;
}) {
  return {
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
    avatar: user.avatar ?? null,
    sberAccountNumber: user.sberAccountNumber ?? null,
    tbankCardCode: user.tbankCardCode ?? null,
    tbankDepositContract: user.tbankDepositContract ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

// POST /api/auth/register
router.post("/register", validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // First user in the system becomes owner, all others become members
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? "owner" : "member";

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role,
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
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });
    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const tokens = generateTokens(user.id, user.role);

    res.json({
      ...tokens,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/auth/refresh
router.post("/refresh", validate(refreshSchema), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    const payload = jwt.verify(refreshToken, config.JWT_SECRET) as JwtPayload & { type?: string };

    if (payload.type !== "refresh") {
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    const tokens = generateTokens(user.id, user.role);

    res.json(tokens);
  } catch {
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { company: true },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json(sanitizeUser(user));
  } catch (error) {
    console.error("Me error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/auth/me
router.put(
  "/me",
  authMiddleware,
  validate(updateProfileSchema),
  async (req: Request, res: Response) => {
    try {
      const updates: Record<string, string | null> = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.language !== undefined) updates.language = req.body.language;
      if (req.body.theme !== undefined) updates.theme = req.body.theme;
      if (req.body.sberAccountNumber !== undefined) updates.sberAccountNumber = req.body.sberAccountNumber;
      if (req.body.tbankCardCode !== undefined) updates.tbankCardCode = req.body.tbankCardCode;
      if (req.body.tbankDepositContract !== undefined) updates.tbankDepositContract = req.body.tbankDepositContract;

      const user = await prisma.user.update({
        where: { id: req.user!.userId },
        data: updates,
        include: { company: true },
      });

      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// PUT /api/auth/password
router.put(
  "/password",
  authMiddleware,
  validate(changePasswordSchema),
  async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const valid = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
      if (!valid) {
        res.status(400).json({ message: "Wrong current password" });
        return;
      }

      const passwordHash = await bcrypt.hash(req.body.newPassword, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      res.json({ message: "Password changed" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// POST /api/auth/avatar
router.post(
  "/avatar",
  authMiddleware,
  avatarUpload.single("avatar"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ message: "Image file is required" });
        return;
      }

      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      // Delete old avatar file if exists
      const oldUser = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (oldUser?.avatar) {
        const oldPath = path.resolve(__dirname, "../../..", oldUser.avatar);
        fs.unlink(oldPath, () => {});
      }

      const user = await prisma.user.update({
        where: { id: req.user!.userId },
        data: { avatar: avatarUrl },
        include: { company: true },
      });

      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Avatar upload error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default router;
