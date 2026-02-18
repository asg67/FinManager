// Shared types between client and server

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  parentId: string | null;
}

export type TransactionType = "INCOME" | "EXPENSE";

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  note: string | null;
  date: string;
  categoryId: string;
  category?: Category;
  accountId: string;
  createdAt: string;
}

export interface Account {
  id: string;
  name: string;
  userId: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  category?: Category;
  amount: number;
  month: number;
  year: number;
  userId: string;
}

export interface AuthPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  message: string;
  code?: string;
}
