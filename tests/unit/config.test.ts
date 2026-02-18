import { describe, it, expect } from "vitest";

describe("Server Config", () => {
  it("should have DATABASE_URL defined", () => {
    expect(process.env.DATABASE_URL).toBeDefined();
  });

  it("should have JWT_SECRET defined", () => {
    expect(process.env.JWT_SECRET).toBeDefined();
  });

  it("should have PORT as a number", () => {
    const port = Number(process.env.PORT);
    expect(port).toBeGreaterThan(0);
  });
});

describe("Project Structure", () => {
  it("should have src/server directory", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("src/server")).toBe(true);
  });

  it("should have src/client directory", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("src/client")).toBe(true);
  });

  it("should have src/shared directory", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("src/shared")).toBe(true);
  });

  it("should have prisma directory", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("prisma")).toBe(true);
  });
});
