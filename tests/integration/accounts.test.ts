import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import app from "../../src/server/index.js";

const prisma = new PrismaClient();
const ownerEmail = `acc-owner-${Date.now()}@test.com`;
let ownerToken: string;
let entityId: string;
let accountId: string;

beforeAll(async () => {
  await prisma.account.deleteMany({ where: { entity: { owner: { email: ownerEmail } } } });
  await prisma.entity.deleteMany({ where: { owner: { email: ownerEmail } } });
  await prisma.permission.deleteMany({ where: { user: { email: ownerEmail } } });
  await prisma.user.deleteMany({ where: { email: ownerEmail } });

  // Register owner
  const res = await request(app).post("/api/auth/register").send({
    email: ownerEmail,
    password: "Test1234!",
    name: "Account Owner",
  });
  ownerToken = res.body.accessToken;

  // Create entity
  const entRes = await request(app)
    .post("/api/entities")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "ИП Аккаунт Тест" });
  entityId = entRes.body.id;
});

afterAll(async () => {
  await prisma.account.deleteMany({ where: { entity: { owner: { email: ownerEmail } } } });
  await prisma.entity.deleteMany({ where: { owner: { email: ownerEmail } } });
  await prisma.permission.deleteMany({ where: { user: { email: ownerEmail } } });
  await prisma.user.deleteMany({ where: { email: ownerEmail } });
  await prisma.$disconnect();
});

describe("POST /api/entities/:entityId/accounts", () => {
  it("should create a checking account", async () => {
    const res = await request(app)
      .post(`/api/entities/${entityId}/accounts`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Расчётный Сбер", type: "checking", bank: "sber" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Расчётный Сбер");
    expect(res.body.type).toBe("checking");
    expect(res.body.bank).toBe("sber");
    expect(res.body.entityId).toBe(entityId);
    accountId = res.body.id;
  });

  it("should create a card account", async () => {
    const res = await request(app)
      .post(`/api/entities/${entityId}/accounts`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Карта Т-Банк", type: "card", bank: "tbank" });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("card");
  });

  it("should create a cash account", async () => {
    const res = await request(app)
      .post(`/api/entities/${entityId}/accounts`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Наличные", type: "cash" });

    expect(res.status).toBe(201);
  });

  it("should reject invalid type", async () => {
    const res = await request(app)
      .post(`/api/entities/${entityId}/accounts`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Bad", type: "invalid" });

    expect(res.status).toBe(400);
  });

  it("should reject empty name", async () => {
    const res = await request(app)
      .post(`/api/entities/${entityId}/accounts`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "", type: "checking" });

    expect(res.status).toBe(400);
  });

  it("should reject non-existent entity", async () => {
    const res = await request(app)
      .post("/api/entities/00000000-0000-0000-0000-000000000000/accounts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Test", type: "checking" });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/entities/:entityId/accounts", () => {
  it("should list accounts for entity", async () => {
    const res = await request(app)
      .get(`/api/entities/${entityId}/accounts`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);
  });
});

describe("PUT /api/entities/:entityId/accounts/:id", () => {
  it("should update account name", async () => {
    const res = await request(app)
      .put(`/api/entities/${entityId}/accounts/${accountId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Расчётный Сбер (обновлён)" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Расчётный Сбер (обновлён)");
  });

  it("should return 404 for non-existent account", async () => {
    const res = await request(app)
      .put(`/api/entities/${entityId}/accounts/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Nope" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/entities/:entityId/accounts/:id", () => {
  it("should delete account", async () => {
    const res = await request(app)
      .delete(`/api/entities/${entityId}/accounts/${accountId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(204);
  });

  it("should return 404 after deletion", async () => {
    const res = await request(app)
      .put(`/api/entities/${entityId}/accounts/${accountId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Ghost" });

    expect(res.status).toBe(404);
  });
});
