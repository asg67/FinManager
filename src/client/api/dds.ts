import { api } from "./client.js";
import type { DdsOperation, DdsTemplate, PaginatedResponse } from "@shared/types.js";

export interface CreateOperationPayload {
  operationType: string;
  amount: number;
  entityId: string;
  fromAccountId?: string;
  toAccountId?: string;
  expenseTypeId?: string;
  expenseArticleId?: string;
  orderNumber?: string;
  comment?: string;
}

export interface UpdateOperationPayload {
  amount?: number;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  expenseTypeId?: string | null;
  expenseArticleId?: string | null;
  orderNumber?: string | null;
  comment?: string | null;
}

export interface OperationFilters {
  entityId?: string;
  operationType?: string;
  accountId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateTemplatePayload {
  name: string;
  operationType: string;
  entityId: string;
  fromAccountId?: string;
  toAccountId?: string;
  expenseTypeId?: string;
  expenseArticleId?: string;
}

export const ddsApi = {
  // Operations
  listOperations: (filters: OperationFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    const qs = params.toString();
    return api.get<PaginatedResponse<DdsOperation>>(`/dds/operations${qs ? `?${qs}` : ""}`);
  },

  createOperation: (data: CreateOperationPayload) =>
    api.post<DdsOperation>("/dds/operations", data),

  updateOperation: (id: string, data: UpdateOperationPayload) =>
    api.put<DdsOperation>(`/dds/operations/${id}`, data),

  deleteOperation: (id: string) =>
    api.delete<void>(`/dds/operations/${id}`),

  // Templates
  listTemplates: () =>
    api.get<DdsTemplate[]>("/dds/templates"),

  createTemplate: (data: CreateTemplatePayload) =>
    api.post<DdsTemplate>("/dds/templates", data),

  updateTemplate: (id: string, data: Partial<CreateTemplatePayload>) =>
    api.put<DdsTemplate>(`/dds/templates/${id}`, data),

  deleteTemplate: (id: string) =>
    api.delete<void>(`/dds/templates/${id}`),
};
