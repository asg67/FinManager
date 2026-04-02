import { api } from "./client.js";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  mode: string | null;
  companyId: string | null;
  disabledBanks: string[];
  ddsViewAll: boolean;
  companyName: string | null;
  entityAccess: { entityId: string; entityName: string }[];
  lastAction: { type: string; date: string } | null;
  createdAt: string;
}

export interface AdminManager {
  id: string;
  name: string;
  email: string;
  lastLoginAt: string | null;
  createdAt: string;
  companies: { id: string; name: string }[];
  assignedUsers: { id: string; name: string; email: string; companyId: string | null }[];
}

export interface AdminCompanyDetail {
  id: string;
  name: string;
  mode: string;
  hiddenFields: string[];
  incomeDirections: boolean;
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
  mode: string;
  onboardingDone: boolean;
  usersCount: number;
  entitiesCount: number;
  createdAt: string;
}

export interface AdminArticleDirection {
  id: string;
  name: string;
  expenseArticleId: string;
  sortOrder: number;
}

export interface AdminExpenseArticle {
  id: string;
  name: string;
  expenseTypeId: string;
  sortOrder: number;
  directions: AdminArticleDirection[];
}

export interface AdminExpenseType {
  id: string;
  name: string;
  entityId: string;
  sortOrder: number;
  articles: AdminExpenseArticle[];
}

export interface AdminIncomeArticle {
  id: string;
  name: string;
  incomeTypeId: string;
  sortOrder: number;
}

export interface AdminIncomeType {
  id: string;
  name: string;
  entityId: string;
  sortOrder: number;
  articles: AdminIncomeArticle[];
}

export interface AdminCustomField {
  id: string;
  companyId: string;
  name: string;
  fieldType: string;
  options: string[] | null;
  showWhen: Record<string, string> | null;
  required: boolean;
  sortOrder: number;
  createdAt: string;
}

export const adminApi = {
  getStats: () =>
    api.get<{ companiesCount: number; usersCount: number }>("/admin/stats"),

  listCompanies: () =>
    api.get<AdminCompanyListItem[]>("/admin/companies"),

  listUsers: () =>
    api.get<AdminUser[]>("/admin/users"),

  setUserMode: (userId: string, mode: string | null) =>
    api.put<{ ok: boolean }>(`/admin/users/${userId}/mode`, { mode }),

  setUserDisabledBanks: (userId: string, disabledBanks: string[]) =>
    api.put<{ ok: boolean }>(`/admin/users/${userId}/disabled-banks`, { disabledBanks }),

  setUserDdsViewAll: (userId: string, ddsViewAll: boolean) =>
    api.put<{ ok: boolean }>(`/admin/users/${userId}/dds-view-all`, { ddsViewAll }),

  setUserEntityAccess: (userId: string, entityIds: string[]) =>
    api.put<{ entityId: string; entityName: string }[]>(`/admin/users/${userId}/entity-access`, { entityIds }),

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

  createAccount: (entityId: string, data: { name: string; type: string; bank?: string }) =>
    api.post<{ id: string; name: string; type: string; bank: string | null }>(`/admin/entities/${entityId}/accounts`, data),

  deleteAccount: (accountId: string) =>
    api.delete<void>(`/admin/accounts/${accountId}`),

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

  // Article Directions CRUD
  createDirection: (articleId: string, name: string) =>
    api.post<AdminArticleDirection>(`/admin/articles/${articleId}/directions`, { name }),

  updateDirection: (id: string, name: string) =>
    api.put<AdminArticleDirection>(`/admin/directions/${id}`, { name }),

  deleteDirection: (id: string) =>
    api.delete<void>(`/admin/directions/${id}`),

  // Company mode
  setCompanyMode: (companyId: string, mode: string) =>
    api.put<{ id: string; mode: string }>(`/admin/companies/${companyId}/mode`, { mode }),

  setCompanyHiddenFields: (companyId: string, hiddenFields: string[]) =>
    api.put<{ id: string; hiddenFields: string[] }>(`/admin/companies/${companyId}/hidden-fields`, { hiddenFields }),

  setCompanyIncomeDirections: (companyId: string, enabled: boolean) =>
    api.put<{ id: string; incomeDirections: boolean }>(`/admin/companies/${companyId}/income-directions`, { enabled }),

  // Income Types CRUD (company-wide)
  getCompanyIncomeTypes: (companyId: string) =>
    api.get<AdminIncomeType[]>(`/admin/companies/${companyId}/income-types`),

  createCompanyIncomeType: (companyId: string, name: string) =>
    api.post<AdminIncomeType>(`/admin/companies/${companyId}/income-types`, { name }),

  updateIncomeType: (id: string, name: string) =>
    api.put<AdminIncomeType>(`/admin/income-types/${id}`, { name }),

  deleteIncomeType: (id: string) =>
    api.delete<void>(`/admin/income-types/${id}`),

  // Income Articles CRUD
  createIncomeArticle: (typeId: string, name: string) =>
    api.post<AdminIncomeArticle>(`/admin/income-types/${typeId}/articles`, { name }),

  updateIncomeArticle: (id: string, name: string) =>
    api.put<AdminIncomeArticle>(`/admin/income-articles/${id}`, { name }),

  deleteIncomeArticle: (id: string) =>
    api.delete<void>(`/admin/income-articles/${id}`),

  // Custom Fields CRUD
  getCustomFields: (companyId: string) =>
    api.get<AdminCustomField[]>(`/admin/companies/${companyId}/custom-fields`),

  createCustomField: (companyId: string, data: {
    name: string;
    fieldType?: string;
    options?: string[];
    showWhen?: Record<string, string> | null;
    required?: boolean;
  }) =>
    api.post<AdminCustomField>(`/admin/companies/${companyId}/custom-fields`, data),

  updateCustomField: (id: string, data: Partial<{
    name: string;
    fieldType: string;
    options: string[];
    showWhen: Record<string, string> | null;
    required: boolean;
    sortOrder: number;
  }>) =>
    api.put<AdminCustomField>(`/admin/custom-fields/${id}`, data),

  deleteCustomField: (id: string) =>
    api.delete<void>(`/admin/custom-fields/${id}`),

  // Managers CRUD
  getManagers: () =>
    api.get<AdminManager[]>("/admin/managers"),

  createManager: (data: { email: string; password: string; name: string }) =>
    api.post<{ id: string; name: string; email: string }>("/admin/managers", data),

  setManagerCompanies: (managerId: string, companyIds: string[]) =>
    api.put<{ companyIds: string[] }>(`/admin/managers/${managerId}/companies`, { companyIds }),

  deleteManager: (managerId: string) =>
    api.delete<void>(`/admin/managers/${managerId}`),

  setManagerUsers: (managerId: string, userIds: string[]) =>
    api.put<{ userIds: string[] }>(`/admin/managers/${managerId}/users`, { userIds }),
};
