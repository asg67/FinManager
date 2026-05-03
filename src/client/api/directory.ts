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
}

export interface DirDirectionItem {
  name: string;
  articleName: string;
}

export const directoryApi = {
  canEdit: () => api.get<{ canEdit: boolean }>("/directory/can-edit"),

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
  toggleAccount: (id: string) => api.put<{ id: string; enabled: boolean }>(`/directory/accounts/${id}/toggle`),

  // Income types
  listIncomeTypes: () => api.get<DirIncomeType[]>("/directory/income-types"),

  // Directions list (unique)
  listDirections: () => api.get<DirDirectionItem[]>("/directory/directions-list"),
};
