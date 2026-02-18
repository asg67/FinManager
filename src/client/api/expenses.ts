import { api } from "./client.js";
import type { ExpenseType, ExpenseArticle } from "@shared/types.js";

export const expensesApi = {
  // Expense Types
  listTypes: (entityId: string) =>
    api.get<ExpenseType[]>(`/entities/${entityId}/expense-types`),

  createType: (entityId: string, data: { name: string; sortOrder?: number }) =>
    api.post<ExpenseType>(`/entities/${entityId}/expense-types`, data),

  updateType: (entityId: string, id: string, data: { name?: string; sortOrder?: number }) =>
    api.put<ExpenseType>(`/entities/${entityId}/expense-types/${id}`, data),

  deleteType: (entityId: string, id: string) =>
    api.delete<void>(`/entities/${entityId}/expense-types/${id}`),

  // Expense Articles
  createArticle: (entityId: string, typeId: string, data: { name: string; sortOrder?: number }) =>
    api.post<ExpenseArticle>(`/entities/${entityId}/expense-types/${typeId}/articles`, data),

  updateArticle: (entityId: string, typeId: string, id: string, data: { name?: string; sortOrder?: number }) =>
    api.put<ExpenseArticle>(`/entities/${entityId}/expense-types/${typeId}/articles/${id}`, data),

  deleteArticle: (entityId: string, typeId: string, id: string) =>
    api.delete<void>(`/entities/${entityId}/expense-types/${typeId}/articles/${id}`),
};
