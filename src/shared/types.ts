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

// === Entities ===

export interface Entity {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { accounts: number };
}

// === Accounts ===

export type AccountType = "checking" | "card" | "cash" | "deposit";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  bank: string | null;
  accountNumber: string | null;
  contractNumber: string | null;
  entityId: string;
  createdAt: string;
}

// === Expense Types & Articles ===

export interface ExpenseArticle {
  id: string;
  name: string;
  expenseTypeId: string;
  sortOrder: number;
}

export interface ExpenseType {
  id: string;
  name: string;
  entityId: string;
  sortOrder: number;
  createdAt: string;
  articles: ExpenseArticle[];
}

// === DDS ===

export type OperationType = "income" | "expense" | "transfer";

export interface DdsOperation {
  id: string;
  operationType: OperationType;
  amount: string; // Decimal comes as string
  fromAccountId: string | null;
  fromAccount: { name: string; type: string } | null;
  toAccountId: string | null;
  toAccount: { name: string; type: string } | null;
  expenseTypeId: string | null;
  expenseType: { name: string } | null;
  expenseArticleId: string | null;
  expenseArticle: { name: string } | null;
  orderNumber: string | null;
  comment: string | null;
  entityId: string;
  entity: { name: string };
  userId: string;
  createdAt: string;
}

export interface DdsTemplate {
  id: string;
  name: string;
  operationType: OperationType;
  entityId: string;
  entity?: { name: string };
  fromAccountId: string | null;
  toAccountId: string | null;
  expenseTypeId: string | null;
  expenseType?: { name: string } | null;
  expenseArticleId: string | null;
  expenseArticle?: { name: string } | null;
  userId: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
