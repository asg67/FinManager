import { api, getAccessToken } from "./client.js";
import type { PaginatedResponse } from "@shared/types.js";

export interface ParsedTransaction {
  date: string;
  time: string | null;
  amount: string;
  direction: "income" | "expense";
  counterparty: string | null;
  purpose: string | null;
  balance: string | null;
  dedupeKey: string;
  isDuplicate: boolean;
}

export interface UploadResult {
  pdfUploadId: string;
  fileName: string;
  bankCode: string;
  transactions: ParsedTransaction[];
  totalCount: number;
  duplicateCount: number;
}

export interface ConfirmResult {
  saved: number;
  skipped: number;
  total: number;
}

export interface PdfUpload {
  id: string;
  fileName: string;
  bankCode: string;
  accountId: string;
  status: string;
  createdAt: string;
  _count: { transactions: number };
}

export interface BankTransaction {
  id: string;
  date: string;
  time: string | null;
  amount: string;
  direction: string;
  counterparty: string | null;
  purpose: string | null;
  balance: string | null;
  accountId: string;
  account: { name: string; type: string; bank: string | null };
  createdAt: string;
}

export interface TransactionFilters {
  accountId?: string;
  direction?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const pdfApi = {
  upload: async (file: File, accountId: string, bankCode: string): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("accountId", accountId);
    formData.append("bankCode", bankCode);

    const token = getAccessToken();
    const res = await fetch("/api/pdf/upload", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Upload failed" }));
      throw new Error(err.message);
    }

    return res.json();
  },

  confirm: (pdfUploadId: string, transactions: ParsedTransaction[]) =>
    api.post<ConfirmResult>("/pdf/confirm", { pdfUploadId, transactions }),

  listUploads: () => api.get<PdfUpload[]>("/pdf/uploads"),

  listTransactions: (filters: TransactionFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    const qs = params.toString();
    return api.get<PaginatedResponse<BankTransaction>>(`/pdf/transactions${qs ? `?${qs}` : ""}`);
  },
};
