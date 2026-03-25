import { api } from "./client.js";

export interface ReconciliationStatus {
  dds: { total: number; linked: number; unlinked: number };
  bank: { total: number; linked: number; unlinked: number };
}

export const reconciliationApi = {
  autoMatch: () => api.post<{ matched: number }>("/reconciliation/auto-match", {}),
  link: (ddsOperationId: string, bankTransactionId: string) =>
    api.post<{ linked: boolean }>("/reconciliation/link", { ddsOperationId, bankTransactionId }),
  unlink: (ddsOperationId: string) =>
    api.post<{ unlinked: boolean }>("/reconciliation/unlink", { ddsOperationId }),
  status: () => api.get<ReconciliationStatus>("/reconciliation/status"),
};
