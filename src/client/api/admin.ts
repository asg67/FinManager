import { api } from "./client.js";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  companyName: string | null;
  lastAction: { type: string; date: string } | null;
  createdAt: string;
}

export interface AdminCompanyDetail {
  id: string;
  name: string;
  onboardingDone: boolean;
  createdAt: string;
  members: { id: string; name: string; email: string; role: string; createdAt: string }[];
  entities: { id: string; name: string; accountsCount: number }[];
}

export interface AdminOperation {
  id: string;
  operationType: string;
  amount: number;
  comment: string | null;
  orderNumber: string | null;
  createdAt: string;
  entity: { name: string };
  fromAccount: { name: string; type: string } | null;
  toAccount: { name: string; type: string } | null;
  expenseType: { name: string } | null;
  expenseArticle: { name: string } | null;
  user: { name: string };
}

export interface AdminEntityDetail {
  id: string;
  name: string;
  accounts: {
    id: string;
    name: string;
    type: string;
    bank: string | null;
    accountNumber: string | null;
    enabled: boolean;
    transactionCount: number;
  }[];
  recentTransactions: {
    id: string;
    date: string;
    amount: number;
    direction: string;
    counterparty: string | null;
    purpose: string | null;
    accountName: string;
    bank: string | null;
  }[];
}

export interface AdminCompanyListItem {
  id: string;
  name: string;
  onboardingDone: boolean;
  usersCount: number;
  entitiesCount: number;
  createdAt: string;
}

export interface AdminExpenseArticle {
  id: string;
  name: string;
  expenseTypeId: string;
  sortOrder: number;
}

export interface AdminExpenseType {
  id: string;
  name: string;
  entityId: string;
  sortOrder: number;
  articles: AdminExpenseArticle[];
}

export const adminApi = {
  getStats: () =>
    api.get<{ companiesCount: number; usersCount: number }>("/admin/stats"),

  listCompanies: () =>
    api.get<AdminCompanyListItem[]>("/admin/companies"),

  listUsers: () =>
    api.get<AdminUser[]>("/admin/users"),

  getCompany: (id: string) =>
    api.get<AdminCompanyDetail>(`/admin/companies/${id}`),

  getCompanyOperations: (id: string, params?: { page?: number; limit?: number; entityId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.entityId) qs.set("entityId", params.entityId);
    const q = qs.toString();
    return api.get<{ data: AdminOperation[]; total: number; page: number; totalPages: number }>(
      `/admin/companies/${id}/operations${q ? `?${q}` : ""}`,
    );
  },

  getEntity: (companyId: string, entityId: string) =>
    api.get<AdminEntityDetail>(`/admin/companies/${companyId}/entities/${entityId}`),

  deleteOperation: (id: string) =>
    api.delete<void>(`/admin/operations/${id}`),

  // Invites
  createInvite: (companyId: string) =>
    api.post<{ id: string; token: string; expiresAt: string; createdAt: string }>(
      `/admin/companies/${companyId}/invites`,
    ),

  // Accounts
  toggleAccount: (accountId: string) =>
    api.put<{ id: string; enabled: boolean }>(`/admin/accounts/${accountId}/toggle`),

  // Entity CRUD
  createEntity: (companyId: string, name: string) =>
    api.post<{ id: string; name: string }>(`/admin/companies/${companyId}/entities`, { name }),

  updateEntity: (id: string, name: string) =>
    api.put<{ id: string; name: string }>(`/admin/entities/${id}`, { name }),

  deleteEntity: (id: string) =>
    api.delete<void>(`/admin/entities/${id}`),

  // Expense Types CRUD (company-wide)
  getCompanyExpenseTypes: (companyId: string) =>
    api.get<AdminExpenseType[]>(`/admin/companies/${companyId}/expense-types`),

  createCompanyExpenseType: (companyId: string, name: string) =>
    api.post<AdminExpenseType>(`/admin/companies/${companyId}/expense-types`, { name }),

  // Expense Types CRUD (per entity — kept for entity detail view)
  getExpenseTypes: (entityId: string) =>
    api.get<AdminExpenseType[]>(`/admin/entities/${entityId}/expense-types`),

  createExpenseType: (entityId: string, name: string) =>
    api.post<AdminExpenseType>(`/admin/entities/${entityId}/expense-types`, { name }),

  updateExpenseType: (id: string, name: string) =>
    api.put<AdminExpenseType>(`/admin/expense-types/${id}`, { name }),

  deleteExpenseType: (id: string) =>
    api.delete<void>(`/admin/expense-types/${id}`),

  // Expense Articles CRUD
  createArticle: (typeId: string, name: string) =>
    api.post<AdminExpenseArticle>(`/admin/expense-types/${typeId}/articles`, { name }),

  updateArticle: (id: string, name: string) =>
    api.put<AdminExpenseArticle>(`/admin/articles/${id}`, { name }),

  deleteArticle: (id: string) =>
    api.delete<void>(`/admin/articles/${id}`),
};
