import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import app from "../../src/server/index.js";

const prisma = new PrismaClient();
const email = `analytics-${Date.now()}@test.com`;
let token: string;
let entityId: string;
let checkingId: string;
let cardId: string;
let expenseTypeId: string;

beforeAll(async () => {
  await prisma.ddsOperation.deleteMany({ where: { user: { email } } });
  await prisma.expenseArticle.deleteMany({ where: { expenseType: { entity: { owner: { email } } } } });
  await prisma.expenseType.deleteMany({ where: { entity: { owner: { email } } } });
  await prisma.account.deleteMany({ where: { entity: { owner: { email } } } });
  await prisma.entity.deleteMany({ where: { owner: { email } } });
  await prisma.permission.deleteMany({ where: { user: { email } } });
  await prisma.user.deleteMany({ where: { email } });

  const res = await request(app).post("/api/auth/register").send({
    email,
    password: "Test1234!",
    name: "Analytics Tester",
  });
  token = res.body.accessToken;

  const ent = await request(app)
    .post("/api/entities")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "ИП Аналитика" });
  entityId = ent.body.id;

  const checking = await request(app)
    .post(`/api/entities/${entityId}/accounts`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Расчётный", type: "checking", bank: "sber" });
  checkingId = checking.body.id;

  const card = await request(app)
    .post(`/api/entities/${entityId}/accounts`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Карта", type: "card", bank: "tbank" });
  cardId = card.body.id;

  const expType = await request(app)
    .post(`/api/entities/${entityId}/expense-types`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Аренда" });
  expenseTypeId = expType.body.id;

  // Create operations
  await request(app)
    .post("/api/dds/operations")
    .set("Authorization", `Bearer ${token}`)
    .send({ operationType: "income", amount: 100000, entityId, toAccountId: checkingId, comment: "Оплата 1" });

  await request(app)
    .post("/api/dds/operations")
    .set("Authorization", `Bearer ${token}`)
    .send({ operationType: "income", amount: 50000, entityId, toAccountId: checkingId, comment: "Оплата 2" });

  await request(app)
    .post("/api/dds/operations")
    .set("Authorization", `Bearer ${token}`)
    .send({ operationType: "expense", amount: 30000, entityId, fromAccountId: checkingId, expenseTypeId, comment: "Аренда" });

  await request(app)
    .post("/api/dds/operations")
    .set("Authorization", `Bearer ${token}`)
    .send({ operationType: "transfer", amount: 20000, entityId, fromAccountId: checkingId, toAccountId: cardId });
});

afterAll(async () => {
  await prisma.ddsOperation.deleteMany({ where: { user: { email } } });
  await prisma.expenseArticle.deleteMany({ where: { expenseType: { entity: { owner: { email } } } } });
  await prisma.expenseType.deleteMany({ where: { entity: { owner: { email } } } });
  await prisma.account.deleteMany({ where: { entity: { owner: { email } } } });
  await prisma.entity.deleteMany({ where: { owner: { email } } });
  await prisma.permission.deleteMany({ where: { user: { email } } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe("GET /api/analytics/summary", () => {
  it("should return summary stats", async () => {
    const res = await request(app)
      .get("/api/analytics/summary")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalIncome).toBe(150000);
    expect(res.body.totalExpense).toBe(30000);
    expect(res.body.balance).toBe(120000);
    expect(res.body.operationsCount).toBe(4);
  });

  it("should filter by entityId", async () => {
    const res = await request(app)
      .get(`/api/analytics/summary?entityId=${entityId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.operationsCount).toBe(4);
  });
});

describe("GET /api/analytics/by-category", () => {
  it("should return expenses by category", async () => {
    const res = await request(app)
      .get("/api/analytics/by-category")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe("Аренда");
    expect(res.body[0].total).toBe(30000);
    expect(res.body[0].count).toBe(1);
  });
});

describe("GET /api/analytics/timeline", () => {
  it("should return daily timeline", async () => {
    const res = await request(app)
      .get("/api/analytics/timeline?days=7")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    // Each entry should have date, income, expense, balance
    const entry = res.body[res.body.length - 1];
    expect(entry).toHaveProperty("date");
    expect(entry).toHaveProperty("income");
    expect(entry).toHaveProperty("expense");
    expect(entry).toHaveProperty("balance");
  });
});

describe("GET /api/analytics/account-balances", () => {
  it("should return balance per account", async () => {
    const res = await request(app)
      .get("/api/analytics/account-balances")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);

    const checking = res.body.find((a: any) => a.name === "Расчётный");
    // income 150000 - expense 30000 - transfer out 20000 = 100000
    expect(checking.balance).toBe(100000);

    const card = res.body.find((a: any) => a.name === "Карта");
    // transfer in 20000
    expect(card.balance).toBe(20000);
  });
});

describe("GET /api/analytics/recent", () => {
  it("should return recent operations", async () => {
    const res = await request(app)
      .get("/api/analytics/recent?limit=10")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(4);
    expect(res.body[0]).toHaveProperty("source", "dds");
    expect(res.body[0]).toHaveProperty("amount");
    expect(res.body[0]).toHaveProperty("type");
  });
});
