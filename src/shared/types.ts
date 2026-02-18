// Shared types between client and server

export interface User {
  id: string;
  email: string;
  name: string;
  language: string;
  theme: string;
  role: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  name?: string;
  language?: "ru" | "en";
  theme?: "dark" | "light";
}

export interface ApiError {
  message: string;
  errors?: { field: string; message: string }[];
}
