import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import app from "../../src/server/index.js";

const prisma = new PrismaClient();
const testEmail = `auth-test-${Date.now()}@test.com`;
let accessToken: string;
let refreshToken: string;

beforeAll(async () => {
  // Clean up test user if exists
  await prisma.permission.deleteMany({ where: { user: { email: testEmail } } });
  await prisma.user.deleteMany({ where: { email: testEmail } });
});

afterAll(async () => {
  await prisma.permission.deleteMany({ where: { user: { email: testEmail } } });
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
});

describe("POST /api/auth/register", () => {
  it("should register a new user", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: testEmail,
      password: "Test1234!",
      name: "Test User",
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.name).toBe("Test User");
    expect(res.body.user).not.toHaveProperty("passwordHash");

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it("should reject duplicate email", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: testEmail,
      password: "Test1234!",
      name: "Duplicate",
    });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty("message");
  });

  it("should reject invalid email", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "not-an-email",
      password: "Test1234!",
      name: "Bad Email",
    });

    expect(res.status).toBe(400);
  });

  it("should reject short password", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "short-pw@test.com",
      password: "123",
      name: "Short PW",
    });

    expect(res.status).toBe(400);
  });

  it("should reject missing name", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "noname@test.com",
      password: "Test1234!",
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("should login with correct credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: testEmail,
      password: "Test1234!",
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body.user.email).toBe(testEmail);

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it("should reject wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: testEmail,
      password: "WrongPassword!",
    });

    expect(res.status).toBe(401);
  });

  it("should reject non-existent email", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "nonexistent@test.com",
      password: "Test1234!",
    });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("should return current user with valid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(testEmail);
    expect(res.body.name).toBe("Test User");
    expect(res.body).toHaveProperty("id");
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("should reject request without token", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });

  it("should reject invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token-here");

    expect(res.status).toBe(401);
  });
});

describe("PUT /api/auth/me", () => {
  it("should update user profile", async () => {
    const res = await request(app)
      .put("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Updated Name", language: "en", theme: "light" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Name");
    expect(res.body.language).toBe("en");
    expect(res.body.theme).toBe("light");
  });

  it("should reject invalid language", async () => {
    const res = await request(app)
      .put("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ language: "fr" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/refresh", () => {
  it("should return new tokens with valid refresh token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
  });

  it("should reject invalid refresh token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "garbage" });

    expect(res.status).toBe(401);
  });
});
