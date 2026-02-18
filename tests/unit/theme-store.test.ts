import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// Must mock BEFORE module loads — use vi.hoisted
const { storage, setAttributeSpy } = vi.hoisted(() => {
  const storage: Record<string, string> = {};
  const setAttributeSpy = vi.fn();

  // Set globals before any module code runs
  (globalThis as any).localStorage = {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, val: string) => {
      storage[key] = val;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
  };

  (globalThis as any).document = {
    documentElement: {
      setAttribute: setAttributeSpy,
    },
  };

  return { storage, setAttributeSpy };
});

// Import after mocks are in place
import { useThemeStore } from "../../src/client/stores/theme.js";

describe("theme store", () => {
  beforeEach(() => {
    Object.keys(storage).forEach((key) => delete storage[key]);
    setAttributeSpy.mockClear();
    useThemeStore.setState({ theme: "dark" });
  });

  it("defaults to dark theme", () => {
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("toggles from dark to light", () => {
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("light");
    expect(setAttributeSpy).toHaveBeenCalledWith("data-theme", "light");
    expect(storage["theme"]).toBe("light");
  });

  it("toggles from light to dark", () => {
    useThemeStore.setState({ theme: "light" });
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("dark");
    expect(setAttributeSpy).toHaveBeenCalledWith("data-theme", "dark");
  });

  it("setTheme applies and persists", () => {
    useThemeStore.getState().setTheme("light");
    expect(useThemeStore.getState().theme).toBe("light");
    expect(setAttributeSpy).toHaveBeenCalledWith("data-theme", "light");
    expect(storage["theme"]).toBe("light");
  });
});
