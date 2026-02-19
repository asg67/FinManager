import { api } from "./client.js";
import type { BankConnection, BankCode, BankRemoteAccount, SyncResult, Account, PaginatedResponse } from "@shared/types.js";
import type { BankTransaction, TransactionFilters } from "./pdf.js";

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

  get: (id: string) =>
    api.get<BankConnection>(`/bank-connections/${id}`),

  listLocalAccounts: (id: string) =>
    api.get<Account[]>(`/bank-connections/${id}/local-accounts`),

  listTransactions: (id: string, filters: TransactionFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    const qs = params.toString();
    return api.get<PaginatedResponse<BankTransaction>>(`/bank-connections/${id}/transactions${qs ? `?${qs}` : ""}`);
  },

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
