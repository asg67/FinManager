import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import app from "../../src/server/index.js";

const prisma = new PrismaClient();
const ownerEmail = `emp-owner-${Date.now()}@test.com`;
const empEmail = `emp-invited-${Date.now()}@test.com`;
const empEmail2 = `emp-invited2-${Date.now()}@test.com`;
let ownerToken: string;
let employeeId: string;
let entityId: string;
let entityId2: string;

beforeAll(async () => {
  // Clean up
  await prisma.entityAccess.deleteMany({ where: { user: { email: { in: [ownerEmail, empEmail, empEmail2] } } } });
  await prisma.entity.deleteMany({ where: { owner: { email: ownerEmail } } });
  await prisma.permission.deleteMany({ where: { user: { email: { in: [ownerEmail, empEmail, empEmail2] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, empEmail, empEmail2] } } });

  // Register owner
  const ownerRes = await request(app).post("/api/auth/register").send({
    email: ownerEmail,
    password: "Test1234!",
    name: "Emp Owner",
  });
  ownerToken = ownerRes.body.accessToken;

  // Create two entities
  const e1 = await request(app)
    .post("/api/entities")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "ИП Один" });
  entityId = e1.body.id;

  const e2 = await request(app)
    .post("/api/entities")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "ИП Два" });
  entityId2 = e2.body.id;
});

afterAll(async () => {
  await prisma.entityAccess.deleteMany({ where: { user: { email: { in: [ownerEmail, empEmail, empEmail2] } } } });
  await prisma.entity.deleteMany({ where: { owner: { email: ownerEmail } } });
  await prisma.permission.deleteMany({ where: { user: { email: { in: [ownerEmail, empEmail, empEmail2] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, empEmail, empEmail2] } } });
  await prisma.$disconnect();
});

describe("POST /api/employees/invite", () => {
  it("should invite employee with permissions and entity access", async () => {
    const res = await request(app)
      .post("/api/employees/invite")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        email: empEmail,
        password: "Emp1234!",
        name: "Test Employee",
        entityIds: [entityId],
        permissions: { dds: true, pdfUpload: false, analytics: true, export: false },
      });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(empEmail);
    expect(res.body.name).toBe("Test Employee");
    expect(res.body.role).toBe("employee");
    expect(res.body.permissions.dds).toBe(true);
    expect(res.body.permissions.analytics).toBe(true);
    expect(res.body.permissions.export).toBe(false);
    expect(res.body.entities).toHaveLength(1);
    expect(res.body.entities[0].id).toBe(entityId);
    employeeId = res.body.id;
  });

  it("should reject duplicate email", async () => {
    const res = await request(app)
      .post("/api/employees/invite")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        email: empEmail,
        password: "Emp1234!",
        name: "Duplicate",
        entityIds: [entityId],
        permissions: { dds: false, pdfUpload: false, analytics: false, export: false },
      });

    expect(res.status).toBe(409);
  });

  it("should reject unauthenticated", async () => {
    const res = await request(app)
      .post("/api/employees/invite")
      .send({
        email: empEmail2,
        password: "Emp1234!",
        name: "No Auth",
        entityIds: [entityId],
        permissions: { dds: false, pdfUpload: false, analytics: false, export: false },
      });

    expect(res.status).toBe(401);
  });

  it("should reject invalid entity IDs", async () => {
    const res = await request(app)
      .post("/api/employees/invite")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        email: empEmail2,
        password: "Emp1234!",
        name: "Bad Entity",
        entityIds: ["00000000-0000-0000-0000-000000000000"],
        permissions: { dds: false, pdfUpload: false, analytics: false, export: false },
      });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/employees", () => {
  it("should list employees invited by owner", async () => {
    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const emp = res.body.find((e: any) => e.id === employeeId);
    expect(emp).toBeDefined();
    expect(emp.permissions.dds).toBe(true);
  });

  it("should reject non-owner", async () => {
    // Login as the employee
    const loginRes = await request(app).post("/api/auth/login").send({
      email: empEmail,
      password: "Emp1234!",
    });
    const empToken = loginRes.body.accessToken;

    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${empToken}`);

    expect(res.status).toBe(403);
  });
});

describe("PUT /api/employees/:id", () => {
  it("should update employee permissions and entities", async () => {
    const res = await request(app)
      .put(`/api/employees/${employeeId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Updated Employee",
        entityIds: [entityId, entityId2],
        permissions: { dds: true, pdfUpload: true, analytics: true, export: true },
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Employee");
    expect(res.body.permissions.pdfUpload).toBe(true);
    expect(res.body.permissions.export).toBe(true);
    expect(res.body.entities).toHaveLength(2);
  });

  it("should return 404 for non-existent employee", async () => {
    const res = await request(app)
      .put("/api/employees/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Ghost" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/employees/:id", () => {
  it("should return 404 for non-existent employee", async () => {
    const res = await request(app)
      .delete("/api/employees/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
  });

  it("should delete employee", async () => {
    const res = await request(app)
      .delete(`/api/employees/${employeeId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(204);
  });

  it("should return empty list after deletion", async () => {
    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.find((e: any) => e.id === employeeId)).toBeUndefined();
  });
});
