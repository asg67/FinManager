import { api } from "./client.js";
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
};
