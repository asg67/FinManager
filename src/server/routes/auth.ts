import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { config } from "../config.js";
import { validate } from "../middleware/validate.js";
import { authMiddleware, JwtPayload } from "../middleware/auth.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateProfileSchema,
} from "../schemas/auth.js";

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
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    language: user.language,
    theme: user.theme,
    role: user.role,
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

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: "owner",
        permission: {
          create: {
            dds: true,
            pdfUpload: true,
            analytics: true,
            export: true,
          },
        },
      },
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

    const user = await prisma.user.findUnique({ where: { email } });
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
      const updates: Record<string, string> = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.language !== undefined) updates.language = req.body.language;
      if (req.body.theme !== undefined) updates.theme = req.body.theme;

      const user = await prisma.user.update({
        where: { id: req.user!.userId },
        data: updates,
      });

      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default router;
