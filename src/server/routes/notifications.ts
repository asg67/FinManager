import { Router, Request, Response } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { config } from "../config.js";
import { notifyCompany } from "../utils/pushNotify.js";

const router = Router();

// GET /api/notifications/vapid-key — public VAPID key (no auth)
router.get("/vapid-key", (_req: Request, res: Response) => {
  res.json({ publicKey: config.VAPID_PUBLIC_KEY || null });
});

router.use(authMiddleware);

// GET /api/notifications — list notifications for current user (paginated)
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    res.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("List notifications error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/notifications/count — unread count
router.get("/count", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const count = await prisma.notification.count({
      where: { userId, read: false },
    });
    res.json({ unread: count });
  } catch (error) {
    console.error("Notification count error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/notifications/:id/read — mark as read
router.put("/:id/read", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id as string, userId },
    });

    if (!notification) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { read: true },
    });

    res.json(updated);
  } catch (error) {
    console.error("Mark read error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/notifications/read-all — mark all as read
router.put("/read-all", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Mark all read error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/notifications/:id — delete notification
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id as string, userId },
    });

    if (!notification) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    await prisma.notification.delete({ where: { id: notification.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/notifications/subscribe — save push subscription
router.post("/subscribe", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ message: "Invalid subscription" });
      return;
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Subscribe error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/notifications/unsubscribe — remove push subscription
router.post("/unsubscribe", async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      res.status(400).json({ message: "Missing endpoint" });
      return;
    }

    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    res.json({ success: true });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/notifications/broadcast — owner sends notification to all company users
router.post("/broadcast", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "owner" || !user.companyId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const { title, body } = req.body;
    if (!title || !body) {
      res.status(400).json({ message: "Title and body required" });
      return;
    }

    await notifyCompany(user.companyId, { type: "broadcast", title, body });
    res.json({ success: true });
  } catch (error) {
    console.error("Broadcast error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
