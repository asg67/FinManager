import { api } from "./client.js";
import type { Account } from "@shared/types.js";

export interface CreateAccountPayload {
  name: string;
  type: string;
  bank?: string;
  accountNumber?: string;
  contractNumber?: string;
}

export const accountsApi = {
  list: (entityId: string) =>
    api.get<Account[]>(`/entities/${entityId}/accounts`),

  create: (entityId: string, data: CreateAccountPayload) =>
    api.post<Account>(`/entities/${entityId}/accounts`, data),

  update: (entityId: string, id: string, data: Partial<CreateAccountPayload>) =>
    api.put<Account>(`/entities/${entityId}/accounts/${id}`, data),

  delete: (entityId: string, id: string) =>
    api.delete<void>(`/entities/${entityId}/accounts/${id}`),
};
