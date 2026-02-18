import { Router, Request, Response } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { confirmSchema } from "../schemas/pdf.js";
import { config } from "../config.js";
import { Prisma } from "@prisma/client";

const router = Router();
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// POST /api/pdf/upload — upload PDF, parse via Python service, return preview
router.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const accountId = req.body.accountId;
    const bankCode = req.body.bankCode;

    if (!accountId || !bankCode) {
      res.status(400).json({ message: "accountId and bankCode are required" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: "PDF file is required" });
      return;
    }

    // Verify account access
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { entity: true },
    });

    if (!account) {
      res.status(404).json({ message: "Account not found" });
      return;
    }

    if (req.user!.role === "owner" && account.entity.ownerId !== userId) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    // Send to Python PDF service
    const formData = new FormData();
    formData.append("file", new Blob([req.file.buffer], { type: "application/pdf" }), req.file.originalname);
    formData.append("bank_code", bankCode);

    const pdfResponse = await fetch(`${config.PDF_SERVICE_URL}/parse`, {
      method: "POST",
      body: formData,
    });

    if (!pdfResponse.ok) {
      const errBody = await pdfResponse.json().catch(() => ({ detail: "PDF service error" }));
      res.status(422).json({ message: errBody.detail || "Failed to parse PDF" });
      return;
    }

    const parseResult = await pdfResponse.json();

    // Create PdfUpload record
    const pdfUpload = await prisma.pdfUpload.create({
      data: {
        fileName: req.file.originalname,
        bankCode,
        accountId,
        status: "pending",
        userId,
      },
    });

    // Check for duplicates
    const transactions = parseResult.transactions as Array<{
      date: string;
      time: string | null;
      amount: string;
      direction: string;
      counterparty: string | null;
      purpose: string | null;
      balance: string | null;
    }>;

    const enriched = await Promise.all(
      transactions.map(async (tx) => {
        const dedupeKey = `${accountId}|${tx.date}|${tx.amount}|${tx.direction}`;
        const existing = await prisma.bankTransaction.findFirst({
          where: { dedupeKey },
        });
        return {
          ...tx,
          dedupeKey,
          isDuplicate: !!existing,
        };
      }),
    );

    res.json({
      pdfUploadId: pdfUpload.id,
      fileName: pdfUpload.fileName,
      bankCode: pdfUpload.bankCode,
      transactions: enriched,
      totalCount: enriched.length,
      duplicateCount: enriched.filter((t) => t.isDuplicate).length,
    });
  } catch (error) {
    console.error("PDF upload error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/pdf/confirm — save selected transactions
router.post("/confirm", validate(confirmSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { pdfUploadId, transactions } = req.body;

    const pdfUpload = await prisma.pdfUpload.findUnique({
      where: { id: pdfUploadId },
    });

    if (!pdfUpload || pdfUpload.userId !== userId) {
      res.status(404).json({ message: "Upload not found" });
      return;
    }

    let saved = 0;
    let skipped = 0;

    for (const tx of transactions) {
      const dedupeKey = `${pdfUpload.accountId}|${tx.date}|${tx.amount}|${tx.direction}`;

      // Check for duplicate
      const existing = await prisma.bankTransaction.findFirst({
        where: { dedupeKey },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.bankTransaction.create({
        data: {
          date: new Date(tx.date),
          time: tx.time ?? null,
          amount: new Prisma.Decimal(tx.amount),
          direction: tx.direction,
          counterparty: tx.counterparty ?? null,
          purpose: tx.purpose ?? null,
          balance: tx.balance ? new Prisma.Decimal(tx.balance) : null,
          accountId: pdfUpload.accountId,
          pdfUploadId: pdfUpload.id,
          dedupeKey,
        },
      });
      saved++;
    }

    // Update upload status
    await prisma.pdfUpload.update({
      where: { id: pdfUploadId },
      data: { status: "confirmed" },
    });

    res.json({ saved, skipped, total: transactions.length });
  } catch (error) {
    console.error("Confirm error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/pdf/uploads — list upload history
router.get("/uploads", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const uploads = await prisma.pdfUpload.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { transactions: true } },
      },
    });

    res.json(uploads);
  } catch (error) {
    console.error("List uploads error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/pdf/transactions — list bank transactions
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { accountId, direction, from, to, page, limit } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const entFilter = user?.companyId
      ? {
          companyId: user.companyId,
          OR: [{ ownerId: userId }, { entityAccess: { some: { userId } } }],
        }
      : { ownerId: userId };

    const where: Prisma.BankTransactionWhereInput = {
      account: { entity: entFilter },
    };

    if (accountId) where.accountId = accountId;
    if (direction) where.direction = direction;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const [transactions, total] = await Promise.all([
      prisma.bankTransaction.findMany({
        where,
        include: {
          account: { select: { name: true, type: true, bank: true } },
        },
        orderBy: { date: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.bankTransaction.count({ where }),
    ]);

    res.json({
      data: transactions,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("List transactions error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
