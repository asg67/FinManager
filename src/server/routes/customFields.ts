import { Router, Request, Response } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.use(authMiddleware);

// GET /api/custom-fields — list custom fields for user's company
router.get("/", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.companyId) {
      res.json([]);
      return;
    }

    const fields = await prisma.customField.findMany({
      where: { companyId: user.companyId },
      orderBy: { sortOrder: "asc" },
    });

    res.json(fields);
  } catch (error) {
    console.error("List custom fields error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
