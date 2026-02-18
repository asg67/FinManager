import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import app from "../../src/server/index.js";

const prisma = new PrismaClient();
const ownerEmail = `ent-owner-${Date.now()}@test.com`;
const employeeEmail = `ent-emp-${Date.now()}@test.com`;
let ownerToken: string;
let employeeToken: string;
let entityId: string;

beforeAll(async () => {
  // Clean up
  await prisma.entityAccess.deleteMany({
    where: { user: { email: { in: [ownerEmail, employeeEmail] } } },
  });
  await prisma.entity.deleteMany({
    where: { owner: { email: ownerEmail } },
  });
  await prisma.permission.deleteMany({
    where: { user: { email: { in: [ownerEmail, employeeEmail] } } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: [ownerEmail, employeeEmail] } },
  });

  // Register owner
  const ownerRes = await request(app).post("/api/auth/register").send({
    email: ownerEmail,
    password: "Test1234!",
    name: "Entity Owner",
  });
  ownerToken = ownerRes.body.accessToken;

  // Create employee directly
  const hash = await bcrypt.hash("Test1234!", 10);
  const employee = await prisma.user.create({
    data: {
      email: employeeEmail,
      passwordHash: hash,
      name: "Entity Employee",
      role: "employee",
      permission: {
        create: { dds: true, pdfUpload: false, analytics: false, export: false },
      },
    },
  });

  // Login employee
  const empRes = await request(app).post("/api/auth/login").send({
    email: employeeEmail,
    password: "Test1234!",
  });
  employeeToken = empRes.body.accessToken;
});

afterAll(async () => {
  await prisma.entityAccess.deleteMany({
    where: { user: { email: { in: [ownerEmail, employeeEmail] } } },
  });
  await prisma.entity.deleteMany({
    where: { owner: { email: ownerEmail } },
  });
  await prisma.permission.deleteMany({
    where: { user: { email: { in: [ownerEmail, employeeEmail] } } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: [ownerEmail, employeeEmail] } },
  });
  await prisma.$disconnect();
});

describe("POST /api/entities", () => {
  it("should create entity for owner", async () => {
    const res = await request(app)
      .post("/api/entities")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "ИП Тестов" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("ИП Тестов");
    expect(res.body.id).toBeDefined();
    entityId = res.body.id;
  });

  it("should reject empty name", async () => {
    const res = await request(app)
      .post("/api/entities")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "" });

    expect(res.status).toBe(400);
  });

  it("should reject employee creating entity", async () => {
    const res = await request(app)
      .post("/api/entities")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ name: "ИП Нельзя" });

    expect(res.status).toBe(403);
  });

  it("should reject unauthenticated", async () => {
    const res = await request(app)
      .post("/api/entities")
      .send({ name: "ИП Без Токена" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/entities", () => {
  it("should list owner entities", async () => {
    const res = await request(app)
      .get("/api/entities")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.find((e: any) => e.id === entityId)).toBeDefined();
  });

  it("should return empty for employee without access", async () => {
    const res = await request(app)
      .get("/api/entities")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /api/entities/:id", () => {
  it("should return entity with accounts and expense types", async () => {
    const res = await request(app)
      .get(`/api/entities/${entityId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(entityId);
    expect(res.body.name).toBe("ИП Тестов");
    expect(Array.isArray(res.body.accounts)).toBe(true);
    expect(Array.isArray(res.body.expenseTypes)).toBe(true);
  });

  it("should return 404 for non-existent", async () => {
    const res = await request(app)
      .get("/api/entities/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
  });

  it("should deny access to employee without EntityAccess", async () => {
    const res = await request(app)
      .get(`/api/entities/${entityId}`)
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
  });
});

describe("PUT /api/entities/:id", () => {
  it("should update entity name", async () => {
    const res = await request(app)
      .put(`/api/entities/${entityId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "ИП Тестов (обновлён)" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("ИП Тестов (обновлён)");
  });

  it("should reject empty name", async () => {
    const res = await request(app)
      .put(`/api/entities/${entityId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "" });

    expect(res.status).toBe(400);
  });

  it("should deny non-owner", async () => {
    const res = await request(app)
      .put(`/api/entities/${entityId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ name: "Hack" });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/entities/:id", () => {
  it("should deny non-owner", async () => {
    const res = await request(app)
      .delete(`/api/entities/${entityId}`)
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
  });

  it("should delete entity", async () => {
    const res = await request(app)
      .delete(`/api/entities/${entityId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(204);
  });

  it("should return 404 after deletion", async () => {
    const res = await request(app)
      .get(`/api/entities/${entityId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
  });
});
