import { api } from "./client.js";

export interface DirExpenseType {
  id: string;
  name: string;
  sortOrder: number;
  articles: DirExpenseArticle[];
}

export interface DirExpenseArticle {
  id: string;
  name: string;
  expenseTypeId: string;
  sortOrder: number;
  directions: DirArticleDirection[];
}

export interface DirArticleDirection {
  id: string;
  name: string;
  expenseArticleId: string;
  sortOrder: number;
}

export interface DirIncomeType {
  id: string;
  name: string;
  sortOrder: number;
  articles: { id: string; name: string; incomeTypeId: string; sortOrder: number }[];
}

export interface DirAccount {
  id: string;
  name: string;
  type: string;
  bank: string | null;
  accountNumber: string | null;
  enabled: boolean;
  entityName: string;
  entityId: string;
  initialBalance: number | null;
  initialBalanceDate: string | null;
  linkedAccountId: string | null;
  linkedAccountName: string | null;
  linkedFromAccounts: { id: string; name: string }[];
}

export interface DirDirectionItem {
  name: string;
  articleName: string;
}

export interface DirCategoryRule {
  id: string;
  companyId: string;
  pattern: string;
  matchField: string;
  direction: string | null;
  expenseTypeName: string | null;
  expenseArticleName: string | null;
  directionName: string | null;
  priority: number;
  createdAt: string;
}

export interface DirEntity {
  id: string;
  name: string;
}

export const directoryApi = {
  canEdit: () => api.get<{ canEdit: boolean }>("/directory/can-edit"),
  listEntities: () => api.get<DirEntity[]>("/directory/entities"),

  // Expense types
  listExpenseTypes: () => api.get<DirExpenseType[]>("/directory/expense-types"),
  createExpenseType: (name: string) => api.post<DirExpenseType>("/directory/expense-types", { name }),
  updateExpenseType: (id: string, name: string) => api.put<DirExpenseType>(`/directory/expense-types/${id}`, { name }),
  deleteExpenseType: (id: string) => api.delete<void>(`/directory/expense-types/${id}`),

  // Articles
  createArticle: (typeId: string, name: string) => api.post<DirExpenseArticle>(`/directory/expense-types/${typeId}/articles`, { name }),
  updateArticle: (id: string, name: string) => api.put<DirExpenseArticle>(`/directory/articles/${id}`, { name }),
  deleteArticle: (id: string) => api.delete<void>(`/directory/articles/${id}`),

  // Directions
  createDirection: (articleId: string, name: string) => api.post<DirArticleDirection>(`/directory/articles/${articleId}/directions`, { name }),
  updateDirection: (id: string, name: string) => api.put<DirArticleDirection>(`/directory/directions/${id}`, { name }),
  deleteDirection: (id: string) => api.delete<void>(`/directory/directions/${id}`),

  // Accounts
  listAccounts: () => api.get<DirAccount[]>("/directory/accounts"),
  listOwnAccounts: () => api.get<DirAccount[]>("/directory/accounts?own=true"),
  createAccount: (data: { entityId: string; name: string; type: string; bank?: string; accountNumber?: string; initialBalance?: number | null; initialBalanceDate?: string | null }) =>
    api.post<DirAccount>("/directory/accounts", data),
  updateAccount: (id: string, data: { name?: string; type?: string; bank?: string; accountNumber?: string; initialBalance?: number | null; initialBalanceDate?: string | null }) =>
    api.put<DirAccount>(`/directory/accounts/${id}`, data),
  deleteAccount: (id: string) => api.delete<void>(`/directory/accounts/${id}`),
  toggleAccount: (id: string) => api.put<{ id: string; enabled: boolean }>(`/directory/accounts/${id}/toggle`),
  linkAccount: (id: string, linkedAccountId: string | null) =>
    api.put<{ id: string; linkedAccountId: string | null; linkedAccountName: string | null }>(`/directory/accounts/${id}/link`, { linkedAccountId }),

  // Income types
  listIncomeTypes: () => api.get<DirIncomeType[]>("/directory/income-types"),

  // Directions list (unique)
  listDirections: () => api.get<DirDirectionItem[]>("/directory/directions-list"),

  // Category rules
  listCategoryRules: () => api.get<DirCategoryRule[]>("/directory/category-rules"),
  createCategoryRule: (data: Omit<DirCategoryRule, "id" | "companyId" | "createdAt">) =>
    api.post<DirCategoryRule>("/directory/category-rules", data),
  updateCategoryRule: (id: string, data: Partial<Omit<DirCategoryRule, "id" | "companyId" | "createdAt">>) =>
    api.put<DirCategoryRule>(`/directory/category-rules/${id}`, data),
  deleteCategoryRule: (id: string) => api.delete<void>(`/directory/category-rules/${id}`),
};
