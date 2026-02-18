import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import app from "../../src/server/index.js";

const prisma = new PrismaClient();
const userEmail = `notif-user-${Date.now()}@test.com`;
let userToken: string;
let userId: string;
let notifId: string;
let notifId2: string;

beforeAll(async () => {
  await prisma.notification.deleteMany({ where: { user: { email: userEmail } } });
  await prisma.permission.deleteMany({ where: { user: { email: userEmail } } });
  await prisma.user.deleteMany({ where: { email: userEmail } });

  // Register user
  const res = await request(app).post("/api/auth/register").send({
    email: userEmail,
    password: "Test1234!",
    name: "Notif User",
  });
  userToken = res.body.accessToken;
  userId = res.body.user.id;

  // Create some notifications directly
  const n1 = await prisma.notification.create({
    data: { userId, type: "info", title: "Welcome", body: "Welcome to the app!" },
  });
  const n2 = await prisma.notification.create({
    data: { userId, type: "warning", title: "Update", body: "New version available" },
  });
  notifId = n1.id;
  notifId2 = n2.id;
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { user: { email: userEmail } } });
  await prisma.permission.deleteMany({ where: { user: { email: userEmail } } });
  await prisma.user.deleteMany({ where: { email: userEmail } });
  await prisma.$disconnect();
});

describe("GET /api/notifications", () => {
  it("should list notifications for user", async () => {
    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
  });

  it("should support pagination", async () => {
    const res = await request(app)
      .get("/api/notifications?page=1&limit=1")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.totalPages).toBe(2);
  });
});

describe("GET /api/notifications/count", () => {
  it("should return unread count", async () => {
    const res = await request(app)
      .get("/api/notifications/count")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.unread).toBe(2);
  });
});

describe("PUT /api/notifications/:id/read", () => {
  it("should mark notification as read", async () => {
    const res = await request(app)
      .put(`/api/notifications/${notifId}/read`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.read).toBe(true);
  });

  it("should reflect in unread count", async () => {
    const res = await request(app)
      .get("/api/notifications/count")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.body.unread).toBe(1);
  });

  it("should return 404 for non-existent", async () => {
    const res = await request(app)
      .put("/api/notifications/00000000-0000-0000-0000-000000000000/read")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/notifications/read-all", () => {
  it("should mark all as read", async () => {
    const res = await request(app)
      .put("/api/notifications/read-all")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify
    const countRes = await request(app)
      .get("/api/notifications/count")
      .set("Authorization", `Bearer ${userToken}`);
    expect(countRes.body.unread).toBe(0);
  });
});

describe("DELETE /api/notifications/:id", () => {
  it("should delete notification", async () => {
    const res = await request(app)
      .delete(`/api/notifications/${notifId2}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(204);
  });

  it("should return 404 after deletion", async () => {
    const res = await request(app)
      .put(`/api/notifications/${notifId2}/read`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });
});
