import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import app from "../../src/server/index.js";

const prisma = new PrismaClient();
const email = `pdf-${Date.now()}@test.com`;
let token: string;
let entityId: string;
let accountId: string;
let pdfUploadId: string;

beforeAll(async () => {
  await prisma.bankTransaction.deleteMany({ where: { account: { entity: { owner: { email } } } } });
  await prisma.pdfUpload.deleteMany({ where: { user: { email } } });
  await prisma.account.deleteMany({ where: { entity: { owner: { email } } } });
  await prisma.entity.deleteMany({ where: { owner: { email } } });
  await prisma.permission.deleteMany({ where: { user: { email } } });
  await prisma.user.deleteMany({ where: { email } });

  // Register
  const res = await request(app).post("/api/auth/register").send({
    email,
    password: "Test1234!",
    name: "PDF Tester",
  });
  token = res.body.accessToken;

  // Create entity + account
  const ent = await request(app)
    .post("/api/entities")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "ИП PDF" });
  entityId = ent.body.id;

  const acc = await request(app)
    .post(`/api/entities/${entityId}/accounts`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Расчётный Сбер", type: "checking", bank: "sber" });
  accountId = acc.body.id;
});

afterAll(async () => {
  await prisma.bankTransaction.deleteMany({ where: { account: { entity: { owner: { email } } } } });
  await prisma.pdfUpload.deleteMany({ where: { user: { email } } });
  await prisma.account.deleteMany({ where: { entity: { owner: { email } } } });
  await prisma.entity.deleteMany({ where: { owner: { email } } });
  await prisma.permission.deleteMany({ where: { user: { email } } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe("POST /api/pdf/upload", () => {
  it("should reject without file", async () => {
    const res = await request(app)
      .post("/api/pdf/upload")
      .set("Authorization", `Bearer ${token}`)
      .field("accountId", accountId)
      .field("bankCode", "sber");

    expect(res.status).toBe(400);
  });

  it("should reject without accountId", async () => {
    const res = await request(app)
      .post("/api/pdf/upload")
      .set("Authorization", `Bearer ${token}`)
      .field("bankCode", "sber")
      .attach("file", Buffer.from("fake pdf"), "test.pdf");

    expect(res.status).toBe(400);
  });
});

describe("PDF Upload lifecycle (manual)", () => {
  it("should create PdfUpload record directly and confirm", async () => {
    // Manually create a PdfUpload (simulating what /upload does)
    const user = await prisma.user.findUnique({ where: { email } });
    const upload = await prisma.pdfUpload.create({
      data: {
        fileName: "test-statement.pdf",
        bankCode: "sber",
        accountId,
        status: "pending",
        userId: user!.id,
      },
    });
    pdfUploadId = upload.id;

    // Confirm with transactions
    const res = await request(app)
      .post("/api/pdf/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({
        pdfUploadId: upload.id,
        transactions: [
          {
            date: "2025-01-15",
            time: "14:30",
            amount: "50000.50",
            direction: "income",
            counterparty: "ООО Клиент",
            purpose: "Оплата по договору",
            balance: "150000.00",
          },
          {
            date: "2025-01-16",
            amount: "15000",
            direction: "expense",
            counterparty: "ООО Арендатор",
            purpose: "Аренда офиса",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(2);
    expect(res.body.skipped).toBe(0);
    expect(res.body.total).toBe(2);
  });

  it("should skip duplicates on re-confirm", async () => {
    // Create another upload
    const user = await prisma.user.findUnique({ where: { email } });
    const upload2 = await prisma.pdfUpload.create({
      data: {
        fileName: "test-statement-2.pdf",
        bankCode: "sber",
        accountId,
        status: "pending",
        userId: user!.id,
      },
    });

    const res = await request(app)
      .post("/api/pdf/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({
        pdfUploadId: upload2.id,
        transactions: [
          {
            date: "2025-01-15",
            time: "14:30",
            amount: "50000.50",
            direction: "income",
            counterparty: "ООО Клиент",
            purpose: "Оплата по договору",
          },
          {
            date: "2025-01-20",
            amount: "25000",
            direction: "income",
            counterparty: "ООО Новый",
            purpose: "Новая оплата",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(1);
    expect(res.body.skipped).toBe(1);
  });
});

describe("GET /api/pdf/uploads", () => {
  it("should list upload history", async () => {
    const res = await request(app)
      .get("/api/pdf/uploads")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].fileName).toBeDefined();
    expect(res.body[0]._count.transactions).toBeDefined();
  });
});

describe("GET /api/pdf/transactions", () => {
  it("should list bank transactions", async () => {
    const res = await request(app)
      .get("/api/pdf/transactions")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
    expect(res.body.total).toBe(3);
  });

  it("should filter by direction", async () => {
    const res = await request(app)
      .get("/api/pdf/transactions?direction=income")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data.every((t: any) => t.direction === "income")).toBe(true);
  });

  it("should filter by accountId", async () => {
    const res = await request(app)
      .get(`/api/pdf/transactions?accountId=${accountId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
  });

  it("should include account info", async () => {
    const res = await request(app)
      .get("/api/pdf/transactions")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].account.name).toBe("Расчётный Сбер");
  });
});
