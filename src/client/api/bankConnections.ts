import { api } from "./client.js";
import type { BankConnection, BankCode, BankRemoteAccount, SyncResult } from "@shared/types.js";

export interface CreateBankConnectionPayload {
  entityId: string;
  bankCode: BankCode;
  token: string;
  label?: string;
}

export interface UpdateBankConnectionPayload {
  token?: string;
  label?: string;
}

export interface SyncPayload {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export const bankConnectionsApi = {
  list: (entityId: string) =>
    api.get<BankConnection[]>(`/bank-connections?entityId=${entityId}`),

  create: (data: CreateBankConnectionPayload) =>
    api.post<BankConnection>("/bank-connections", data),

  update: (id: string, data: UpdateBankConnectionPayload) =>
    api.put<BankConnection>(`/bank-connections/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/bank-connections/${id}`),

  test: (id: string) =>
    api.post<{ ok: boolean; accountCount?: number }>(`/bank-connections/${id}/test`),

  fetchAccounts: (id: string) =>
    api.get<BankRemoteAccount[]>(`/bank-connections/${id}/accounts`),

  sync: (id: string, data: SyncPayload) =>
    api.post<SyncResult>(`/bank-connections/${id}/sync`, data),
};
