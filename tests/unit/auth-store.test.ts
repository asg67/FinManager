import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock localStorage
const storage: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, val: string) => {
    storage[key] = val;
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
});

// Import after mocks
import { useAuthStore } from "../../src/client/stores/auth.js";
import { getAccessToken } from "../../src/client/api/client.js";

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

const fakeUser = {
  id: "u1",
  email: "test@test.com",
  name: "Test",
  language: "ru",
  theme: "dark",
  role: "owner",
  createdAt: "2025-01-01T00:00:00.000Z",
};

describe("auth store", () => {
  beforeEach(() => {
    // Reset store
    useAuthStore.setState({
      user: null,
      isLoading: false,
      isInitialized: false,
      error: null,
    });
    // Reset mocks
    mockFetch.mockReset();
    // Reset storage
    Object.keys(storage).forEach((key) => delete storage[key]);
  });

  describe("login", () => {
    it("sets user and tokens on success", async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({
          accessToken: "at-123",
          refreshToken: "rt-123",
          user: fakeUser,
        }),
      );

      await useAuthStore.getState().login({ email: "test@test.com", password: "123456" });

      expect(useAuthStore.getState().user).toEqual(fakeUser);
      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().error).toBeNull();
      expect(getAccessToken()).toBe("at-123");
      expect(storage["refreshToken"]).toBe("rt-123");
    });

    it("sets error on failure", async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ message: "Invalid credentials" }, 401),
      );

      await expect(
        useAuthStore.getState().login({ email: "test@test.com", password: "wrong" }),
      ).rejects.toThrow();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().error).toBe("Invalid credentials");
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe("register", () => {
    it("sets user and tokens on success", async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({
          accessToken: "at-new",
          refreshToken: "rt-new",
          user: fakeUser,
        }),
      );

      await useAuthStore.getState().register({
        email: "test@test.com",
        password: "123456",
        name: "Test",
      });

      expect(useAuthStore.getState().user).toEqual(fakeUser);
      expect(getAccessToken()).toBe("at-new");
      expect(storage["refreshToken"]).toBe("rt-new");
    });

    it("sets error on duplicate email", async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ message: "Email already registered" }, 409),
      );

      await expect(
        useAuthStore.getState().register({
          email: "dup@test.com",
          password: "123456",
          name: "Dup",
        }),
      ).rejects.toThrow();

      expect(useAuthStore.getState().error).toBe("Email already registered");
    });
  });

  describe("logout", () => {
    it("clears user and tokens", async () => {
      // First login
      mockFetch.mockReturnValueOnce(
        jsonResponse({
          accessToken: "at-123",
          refreshToken: "rt-123",
          user: fakeUser,
        }),
      );
      await useAuthStore.getState().login({ email: "test@test.com", password: "123456" });

      // Then logout
      useAuthStore.getState().logout();

      expect(useAuthStore.getState().user).toBeNull();
      expect(getAccessToken()).toBeNull();
      expect(storage["refreshToken"]).toBeUndefined();
    });
  });

  describe("init", () => {
    it("restores session from refresh token", async () => {
      storage["refreshToken"] = "rt-saved";

      // Mock refresh call
      mockFetch.mockReturnValueOnce(
        jsonResponse({ accessToken: "at-refreshed", refreshToken: "rt-refreshed" }),
      );
      // Mock getMe call
      mockFetch.mockReturnValueOnce(jsonResponse(fakeUser));

      await useAuthStore.getState().init();

      expect(useAuthStore.getState().user).toEqual(fakeUser);
      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(getAccessToken()).toBe("at-refreshed");
    });

    it("marks initialized without user when no refresh token", async () => {
      await useAuthStore.getState().init();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isInitialized).toBe(true);
    });

    it("clears tokens and initializes on refresh failure", async () => {
      storage["refreshToken"] = "rt-expired";

      mockFetch.mockReturnValueOnce(
        jsonResponse({ message: "Invalid or expired refresh token" }, 401),
      );

      await useAuthStore.getState().init();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(storage["refreshToken"]).toBeUndefined();
    });
  });

  describe("updateProfile", () => {
    it("updates user in store", async () => {
      // Set up logged-in state
      useAuthStore.setState({ user: fakeUser });

      const updatedUser = { ...fakeUser, name: "Updated" };
      mockFetch.mockReturnValueOnce(jsonResponse(updatedUser));

      await useAuthStore.getState().updateProfile({ name: "Updated" });

      expect(useAuthStore.getState().user).toEqual(updatedUser);
    });
  });

  describe("clearError", () => {
    it("clears the error", () => {
      useAuthStore.setState({ error: "some error" });
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
