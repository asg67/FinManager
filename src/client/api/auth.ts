import { api, getAccessToken } from "./client.js";
import type {
  AuthResponse,
  AuthTokens,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
  User,
} from "@shared/types.js";

export const authApi = {
  register: (data: RegisterPayload) =>
    api.post<AuthResponse>("/auth/register", data, { noAuth: true }),

  login: (data: LoginPayload) =>
    api.post<AuthResponse>("/auth/login", data, { noAuth: true }),

  refresh: (refreshToken: string) =>
    api.post<AuthTokens>("/auth/refresh", { refreshToken }, { noAuth: true }),

  getMe: () => api.get<User>("/auth/me"),

  updateProfile: (data: UpdateProfilePayload) => api.put<User>("/auth/me", data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put<{ message: string }>("/auth/password", data),

  uploadAvatar: async (file: File): Promise<User> => {
    const formData = new FormData();
    formData.append("avatar", file);
    const token = getAccessToken();
    const res = await fetch("/api/auth/avatar", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Upload failed" }));
      throw new Error(err.message);
    }
    return res.json();
  },
};
