import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import app from "../../src/server/index.js";

const prisma = new PrismaClient();
const ownerEmail = `exp-owner-${Date.now()}@test.com`;
let ownerToken: string;
let entityId: string;
let typeId: string;
let articleId: string;

beforeAll(async () => {
  await prisma.expenseArticle.deleteMany({ where: { expenseType: { entity: { owner: { email: ownerEmail } } } } });
  await prisma.expenseType.deleteMany({ where: { entity: { owner: { email: ownerEmail } } } });
  await prisma.entity.deleteMany({ where: { owner: { email: ownerEmail } } });
  await prisma.permission.deleteMany({ where: { user: { email: ownerEmail } } });
  await prisma.user.deleteMany({ where: { email: ownerEmail } });

  const res = await request(app).post("/api/auth/register").send({
    email: ownerEmail,
    password: "Test1234!",
    name: "Expense Owner",
  });
  ownerToken = res.body.accessToken;

  const entRes = await request(app)
    .post("/api/entities")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "ИП Расходы" });
  entityId = entRes.body.id;
});

afterAll(async () => {
  await prisma.expenseArticle.deleteMany({ where: { expenseType: { entity: { owner: { email: ownerEmail } } } } });
  await prisma.expenseType.deleteMany({ where: { entity: { owner: { email: ownerEmail } } } });
  await prisma.entity.deleteMany({ where: { owner: { email: ownerEmail } } });
  await prisma.permission.deleteMany({ where: { user: { email: ownerEmail } } });
  await prisma.user.deleteMany({ where: { email: ownerEmail } });
  await prisma.$disconnect();
});

describe("Expense Types CRUD", () => {
  it("POST should create expense type", async () => {
    const res = await request(app)
      .post(`/api/entities/${entityId}/expense-types`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Аренда", sortOrder: 1 });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Аренда");
    expect(res.body.sortOrder).toBe(1);
    typeId = res.body.id;
  });

  it("POST should create second type with default sortOrder", async () => {
    const res = await request(app)
      .post(`/api/entities/${entityId}/expense-types`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Зарплата" });

    expect(res.status).toBe(201);
    expect(res.body.sortOrder).toBe(0);
  });

  it("GET should list types with articles", async () => {
    const res = await request(app)
      .get(`/api/entities/${entityId}/expense-types`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    // Sorted by sortOrder: Зарплата (0), Аренда (1)
    expect(res.body[0].name).toBe("Зарплата");
    expect(res.body[1].name).toBe("Аренда");
    expect(Array.isArray(res.body[0].articles)).toBe(true);
  });

  it("PUT should update type name", async () => {
    const res = await request(app)
      .put(`/api/entities/${entityId}/expense-types/${typeId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Аренда офиса" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Аренда офиса");
  });

  it("PUT should return 404 for non-existent type", async () => {
    const res = await request(app)
      .put(`/api/entities/${entityId}/expense-types/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Nope" });

    expect(res.status).toBe(404);
  });
});

describe("Expense Articles CRUD", () => {
  it("POST should create article under type", async () => {
    const res = await request(app)
      .post(`/api/entities/${entityId}/expense-types/${typeId}/articles`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Основной офис", sortOrder: 0 });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Основной офис");
    expect(res.body.expenseTypeId).toBe(typeId);
    articleId = res.body.id;
  });

  it("POST should create second article", async () => {
    const res = await request(app)
      .post(`/api/entities/${entityId}/expense-types/${typeId}/articles`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Склад", sortOrder: 1 });

    expect(res.status).toBe(201);
  });

  it("GET types should include articles", async () => {
    const res = await request(app)
      .get(`/api/entities/${entityId}/expense-types`)
      .set("Authorization", `Bearer ${ownerToken}`);

    const typeWithArticles = res.body.find((t: any) => t.id === typeId);
    expect(typeWithArticles.articles.length).toBe(2);
    expect(typeWithArticles.articles[0].name).toBe("Основной офис");
  });

  it("PUT should update article", async () => {
    const res = await request(app)
      .put(`/api/entities/${entityId}/expense-types/${typeId}/articles/${articleId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Офис центр" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Офис центр");
  });

  it("DELETE should remove article", async () => {
    const res = await request(app)
      .delete(`/api/entities/${entityId}/expense-types/${typeId}/articles/${articleId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(204);
  });
});

describe("Expense Type DELETE", () => {
  it("should cascade delete type with remaining articles", async () => {
    const res = await request(app)
      .delete(`/api/entities/${entityId}/expense-types/${typeId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(204);
  });
});
