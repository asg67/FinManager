import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import app from "../../src/server/index.js";

const prisma = new PrismaClient();
const email = `dds-${Date.now()}@test.com`;
let token: string;
let entityId: string;
let checkingId: string;
let cardId: string;
let cashId: string;
let expenseTypeId: string;
let expenseArticleId: string;
let operationId: string;
let templateId: string;

beforeAll(async () => {
  // Cleanup
  await prisma.ddsTemplate.deleteMany({ where: { user: { email } } });
  await prisma.ddsOperation.deleteMany({ where: { user: { email } } });
  await prisma.expenseArticle.deleteMany({ where: { expenseType: { entity: { owner: { email } } } } });
  await prisma.expenseType.deleteMany({ where: { entity: { owner: { email } } } });
  await prisma.account.deleteMany({ where: { entity: { owner: { email } } } });
  await prisma.entity.deleteMany({ where: { owner: { email } } });
  await prisma.permission.deleteMany({ where: { user: { email } } });
  await prisma.user.deleteMany({ where: { email } });

  // Register
  const res = await request(app).post("/api/auth/register").send({
    email,
    password: "Test1234!",
    name: "DDS Tester",
  });
  token = res.body.accessToken;

  // Create entity
  const ent = await request(app)
    .post("/api/entities")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "ИП ДДС" });
  entityId = ent.body.id;

  // Create accounts
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

  const cash = await request(app)
    .post(`/api/entities/${entityId}/accounts`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Наличные", type: "cash" });
  cashId = cash.body.id;

  // Create expense type + article
  const expType = await request(app)
    .post(`/api/entities/${entityId}/expense-types`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Аренда" });
  expenseTypeId = expType.body.id;

  const article = await request(app)
    .post(`/api/entities/${entityId}/expense-types/${expenseTypeId}/articles`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Офис" });
  expenseArticleId = article.body.id;
});

afterAll(async () => {
  await prisma.ddsTemplate.deleteMany({ where: { user: { email } } });
  await prisma.ddsOperation.deleteMany({ where: { user: { email } } });
  await prisma.expenseArticle.deleteMany({ where: { expenseType: { entity: { owner: { email } } } } });
  await prisma.expenseType.deleteMany({ where: { entity: { owner: { email } } } });
  await prisma.account.deleteMany({ where: { entity: { owner: { email } } } });
  await prisma.entity.deleteMany({ where: { owner: { email } } });
  await prisma.permission.deleteMany({ where: { user: { email } } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe("POST /api/dds/operations", () => {
  it("should create income operation", async () => {
    const res = await request(app)
      .post("/api/dds/operations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        operationType: "income",
        amount: 50000,
        entityId,
        toAccountId: checkingId,
        comment: "Оплата от клиента",
      });

    expect(res.status).toBe(201);
    expect(res.body.operationType).toBe("income");
    expect(res.body.amount).toBe("50000");
    expect(res.body.toAccount.name).toBe("Расчётный");
    operationId = res.body.id;
  });

  it("should create expense operation", async () => {
    const res = await request(app)
      .post("/api/dds/operations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        operationType: "expense",
        amount: 15000,
        entityId,
        fromAccountId: checkingId,
        expenseTypeId,
        expenseArticleId,
        orderNumber: "ORD-001",
        comment: "Аренда за январь",
      });

    expect(res.status).toBe(201);
    expect(res.body.operationType).toBe("expense");
    expect(res.body.expenseType.name).toBe("Аренда");
    expect(res.body.expenseArticle.name).toBe("Офис");
  });

  it("should create transfer operation", async () => {
    const res = await request(app)
      .post("/api/dds/operations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        operationType: "transfer",
        amount: 10000,
        entityId,
        fromAccountId: checkingId,
        toAccountId: cashId,
      });

    expect(res.status).toBe(201);
    expect(res.body.operationType).toBe("transfer");
  });

  it("should reject income without toAccountId", async () => {
    const res = await request(app)
      .post("/api/dds/operations")
      .set("Authorization", `Bearer ${token}`)
      .send({ operationType: "income", amount: 1000, entityId });

    expect(res.status).toBe(400);
  });

  it("should reject expense without fromAccountId", async () => {
    const res = await request(app)
      .post("/api/dds/operations")
      .set("Authorization", `Bearer ${token}`)
      .send({ operationType: "expense", amount: 1000, entityId, expenseTypeId });

    expect(res.status).toBe(400);
  });

  it("should reject negative amount", async () => {
    const res = await request(app)
      .post("/api/dds/operations")
      .set("Authorization", `Bearer ${token}`)
      .send({ operationType: "income", amount: -100, entityId, toAccountId: checkingId });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/dds/operations", () => {
  it("should list operations with pagination", async () => {
    const res = await request(app)
      .get("/api/dds/operations")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
  });

  it("should filter by entityId", async () => {
    const res = await request(app)
      .get(`/api/dds/operations?entityId=${entityId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
  });

  it("should filter by operationType", async () => {
    const res = await request(app)
      .get("/api/dds/operations?operationType=income")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].operationType).toBe("income");
  });
});

describe("PUT /api/dds/operations/:id", () => {
  it("should update operation amount", async () => {
    const res = await request(app)
      .put(`/api/dds/operations/${operationId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 75000, comment: "Обновлено" });

    expect(res.status).toBe(200);
    expect(res.body.amount).toBe("75000");
    expect(res.body.comment).toBe("Обновлено");
  });

  it("should return 404 for non-existent", async () => {
    const res = await request(app)
      .put("/api/dds/operations/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 1 });

    expect(res.status).toBe(404);
  });
});

describe("DDS Templates", () => {
  it("POST should create template", async () => {
    const res = await request(app)
      .post("/api/dds/templates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Аренда офиса",
        operationType: "expense",
        entityId,
        fromAccountId: checkingId,
        expenseTypeId,
        expenseArticleId,
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Аренда офиса");
    templateId = res.body.id;
  });

  it("GET should list templates", async () => {
    const res = await request(app)
      .get("/api/dds/templates")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe("Аренда офиса");
  });

  it("PUT should update template name", async () => {
    const res = await request(app)
      .put(`/api/dds/templates/${templateId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Аренда офиса (ежемесячно)" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Аренда офиса (ежемесячно)");
  });

  it("DELETE should remove template", async () => {
    const res = await request(app)
      .delete(`/api/dds/templates/${templateId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
  });
});

describe("DELETE /api/dds/operations/:id", () => {
  it("should delete operation", async () => {
    const res = await request(app)
      .delete(`/api/dds/operations/${operationId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
  });
});
