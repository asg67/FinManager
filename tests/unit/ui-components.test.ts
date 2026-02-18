import { describe, it, expect } from "vitest";

// We test the component modules can be imported and export correctly.
// Full rendering tests would require jsdom + @testing-library/react,
// which we'll add in later phases. For now, verify exports and types.

describe("UI Kit exports", () => {
  it("Button exports default function", async () => {
    const mod = await import("../../src/client/components/ui/Button.js");
    expect(typeof mod.default).toBe("function");
  });

  it("Input exports default with forwardRef", async () => {
    const mod = await import("../../src/client/components/ui/Input.js");
    expect(mod.default).toBeDefined();
    expect(mod.default.displayName).toBe("Input");
  });

  it("Select exports default with forwardRef", async () => {
    const mod = await import("../../src/client/components/ui/Select.js");
    expect(mod.default).toBeDefined();
    expect(mod.default.displayName).toBe("Select");
  });

  it("Card exports default with sub-components", async () => {
    const mod = await import("../../src/client/components/ui/Card.js");
    expect(typeof mod.default).toBe("function");
    expect(typeof mod.default.Label).toBe("function");
    expect(typeof mod.default.Value).toBe("function");
  });

  it("Modal exports default with Footer sub-component", async () => {
    const mod = await import("../../src/client/components/ui/Modal.js");
    expect(typeof mod.default).toBe("function");
    expect(typeof mod.default.Footer).toBe("function");
  });

  it("Table exports default function", async () => {
    const mod = await import("../../src/client/components/ui/Table.js");
    expect(typeof mod.default).toBe("function");
  });

  it("barrel index re-exports all components", async () => {
    const mod = await import("../../src/client/components/ui/index.js");
    expect(mod.Button).toBeDefined();
    expect(mod.Input).toBeDefined();
    expect(mod.Select).toBeDefined();
    expect(mod.Card).toBeDefined();
    expect(mod.Modal).toBeDefined();
    expect(mod.Table).toBeDefined();
  });
});
