import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
const schema = fs.readFileSync(schemaPath, "utf-8");

describe("Prisma Schema", () => {
  const expectedModels = [
    "User",
    "Permission",
    "Entity",
    "EntityAccess",
    "Account",
    "ExpenseType",
    "ExpenseArticle",
    "DdsOperation",
    "DdsTemplate",
    "PdfUpload",
    "BankTransaction",
    "Notification",
  ];

  for (const model of expectedModels) {
    it(`should define model ${model}`, () => {
      const regex = new RegExp(`model\\s+${model}\\s*\\{`);
      expect(schema).toMatch(regex);
    });
  }

  it("should have exactly 12 models", () => {
    const matches = schema.match(/^model\s+\w+\s*\{/gm);
    expect(matches).toHaveLength(12);
  });

  it("should use PostgreSQL provider", () => {
    expect(schema).toContain('provider = "postgresql"');
  });

  it("should use uuid for IDs", () => {
    expect(schema).toContain("@default(uuid())");
  });
});

describe("Seed file", () => {
  it("should exist at prisma/seed.ts", () => {
    const seedPath = path.resolve(process.cwd(), "prisma/seed.ts");
    expect(fs.existsSync(seedPath)).toBe(true);
  });
});
