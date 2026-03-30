import { api } from "./client.js";
import type { DdsOperation, DdsTemplate, CustomField, PaginatedResponse } from "@shared/types.js";

export interface CreateOperationPayload {
  operationType: string;
  amount: number;
  entityId: string;
  fromAccountId?: string;
  toAccountId?: string;
  expenseTypeId?: string;
  expenseArticleId?: string;
  incomeTypeId?: string;
  incomeArticleId?: string;
  directionId?: string;
  orderNumber?: string;
  comment?: string;
  customFieldValues?: { customFieldId: string; value: string }[];
}

export interface UpdateOperationPayload {
  amount?: number;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  expenseTypeId?: string | null;
  expenseArticleId?: string | null;
  incomeTypeId?: string | null;
  incomeArticleId?: string | null;
  directionId?: string | null;
  orderNumber?: string | null;
  comment?: string | null;
  customFieldValues?: { customFieldId: string; value: string }[];
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
  incomeTypeId?: string;
  incomeArticleId?: string;
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

  // Custom fields for current company
  getCustomFields: () =>
    api.get<CustomField[]>("/custom-fields"),
};
