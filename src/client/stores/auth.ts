import { create } from "zustand";
import type {
  User,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
} from "@shared/types.js";
import { authApi } from "../api/auth.js";
import { setAccessToken, ApiError } from "../api/client.js";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  login: (data: LoginPayload) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => void;
  init: () => Promise<void>;
  updateProfile: (data: UpdateProfilePayload) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  login: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.login(data);
      setAccessToken(res.accessToken);
      localStorage.setItem("refreshToken", res.refreshToken);
      set({ user: res.user, isLoading: false });
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Login failed";
      set({ isLoading: false, error: message });
      throw e;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.register(data);
      setAccessToken(res.accessToken);
      localStorage.setItem("refreshToken", res.refreshToken);
      set({ user: res.user, isLoading: false });
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Registration failed";
      set({ isLoading: false, error: message });
      throw e;
    }
  },

  logout: () => {
    setAccessToken(null);
    localStorage.removeItem("refreshToken");
    set({ user: null, error: null });
  },

  init: async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      set({ isInitialized: true });
      return;
    }

    try {
      const tokens = await authApi.refresh(refreshToken);
      setAccessToken(tokens.accessToken);
      localStorage.setItem("refreshToken", tokens.refreshToken);

      const user = await authApi.getMe();
      set({ user, isInitialized: true });
    } catch {
      localStorage.removeItem("refreshToken");
      setAccessToken(null);
      set({ isInitialized: true });
    }
  },

  updateProfile: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const user = await authApi.updateProfile(data);
      set({ user, isLoading: false });
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Update failed";
      set({ isLoading: false, error: message });
      throw e;
    }
  },

  clearError: () => set({ error: null }),
}));
