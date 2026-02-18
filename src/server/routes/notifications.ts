import { Router, Request, Response } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

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

export default router;
