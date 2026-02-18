import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import app from "../../src/server/index.js";

const prisma = new PrismaClient();
const ownerEmail = `export-owner-${Date.now()}@test.com`;
const empEmail = `export-emp-${Date.now()}@test.com`;
const empNoExportEmail = `export-noperm-${Date.now()}@test.com`;
let ownerToken: string;
let empToken: string;
let empNoExportToken: string;
let entityId: string;

beforeAll(async () => {
  const emails = [ownerEmail, empEmail, empNoExportEmail];
  await prisma.ddsOperation.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.account.deleteMany({ where: { entity: { owner: { email: ownerEmail } } } });
  await prisma.entityAccess.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.entity.deleteMany({ where: { owner: { email: ownerEmail } } });
  await prisma.permission.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });

  // Register owner
  const ownerRes = await request(app).post("/api/auth/register").send({
    email: ownerEmail,
    password: "Test1234!",
    name: "Export Owner",
  });
  ownerToken = ownerRes.body.accessToken;
  const ownerId = ownerRes.body.user.id;

  // Create entity + account
  const entRes = await request(app)
    .post("/api/entities")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Export Entity" });
  entityId = entRes.body.id;

  const accRes = await request(app)
    .post(`/api/entities/${entityId}/accounts`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Export Account", type: "checking" });
  const accountId = accRes.body.id;

  // Create a DDS operation
  await request(app)
    .post("/api/dds/operations")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      operationType: "income",
      amount: 50000,
      entityId,
      toAccountId: accountId,
      comment: "Export test income",
    });

  // Create employee with export permission
  const hash = await bcrypt.hash("Test1234!", 10);
  const emp = await prisma.user.create({
    data: {
      email: empEmail,
      passwordHash: hash,
      name: "Export Emp",
      role: "employee",
      invitedById: ownerId,
      permission: { create: { dds: true, pdfUpload: false, analytics: false, export: true } },
      entityAccess: { create: [{ entityId }] },
    },
  });
  const empLoginRes = await request(app).post("/api/auth/login").send({ email: empEmail, password: "Test1234!" });
  empToken = empLoginRes.body.accessToken;

  // Create employee without export permission
  await prisma.user.create({
    data: {
      email: empNoExportEmail,
      passwordHash: hash,
      name: "No Export Emp",
      role: "employee",
      invitedById: ownerId,
      permission: { create: { dds: true, pdfUpload: false, analytics: false, export: false } },
      entityAccess: { create: [{ entityId }] },
    },
  });
  const empNoRes = await request(app).post("/api/auth/login").send({ email: empNoExportEmail, password: "Test1234!" });
  empNoExportToken = empNoRes.body.accessToken;
});

afterAll(async () => {
  const emails = [ownerEmail, empEmail, empNoExportEmail];
  await prisma.ddsOperation.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.account.deleteMany({ where: { entity: { owner: { email: ownerEmail } } } });
  await prisma.entityAccess.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.entity.deleteMany({ where: { owner: { email: ownerEmail } } });
  await prisma.permission.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

describe("GET /api/export/dds", () => {
  it("should export CSV for owner", async () => {
    const res = await request(app)
      .get("/api/export/dds")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("dds-export");
    expect(res.text).toContain("Date,Type,Entity,Amount");
    expect(res.text).toContain("income");
    expect(res.text).toContain("Export Entity");
  });

  it("should export CSV for employee with export permission", async () => {
    const res = await request(app)
      .get("/api/export/dds")
      .set("Authorization", `Bearer ${empToken}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Date,Type,Entity,Amount");
  });

  it("should reject employee without export permission", async () => {
    const res = await request(app)
      .get("/api/export/dds")
      .set("Authorization", `Bearer ${empNoExportToken}`);

    expect(res.status).toBe(403);
  });

  it("should reject unauthenticated", async () => {
    const res = await request(app).get("/api/export/dds");
    expect(res.status).toBe(401);
  });

  it("should filter by entityId", async () => {
    const res = await request(app)
      .get(`/api/export/dds?entityId=${entityId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Export Entity");
  });
});
