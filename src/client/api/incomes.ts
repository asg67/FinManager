import { api } from "./client.js";
import type { IncomeType, IncomeArticle } from "@shared/types.js";

export const incomesApi = {
  listTypes: (entityId: string) =>
    api.get<IncomeType[]>(`/entities/${entityId}/income-types`),

  createType: (entityId: string, data: { name: string; sortOrder?: number }) =>
    api.post<IncomeType>(`/entities/${entityId}/income-types`, data),

  updateType: (entityId: string, id: string, data: { name?: string; sortOrder?: number }) =>
    api.put<IncomeType>(`/entities/${entityId}/income-types/${id}`, data),

  deleteType: (entityId: string, id: string) =>
    api.delete<void>(`/entities/${entityId}/income-types/${id}`),

  createArticle: (entityId: string, typeId: string, data: { name: string; sortOrder?: number }) =>
    api.post<IncomeArticle>(`/entities/${entityId}/income-types/${typeId}/articles`, data),

  updateArticle: (entityId: string, typeId: string, id: string, data: { name?: string; sortOrder?: number }) =>
    api.put<IncomeArticle>(`/entities/${entityId}/income-types/${typeId}/articles/${id}`, data),

  deleteArticle: (entityId: string, typeId: string, id: string) =>
    api.delete<void>(`/entities/${entityId}/income-types/${typeId}/articles/${id}`),
};
