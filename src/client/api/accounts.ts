import { api } from "./client.js";
import type { Account } from "@shared/types.js";

export interface CreateAccountPayload {
  name: string;
  type: string;
  bank?: string;
  accountNumber?: string;
  contractNumber?: string;
  initialBalance?: string | null;
  initialBalanceDate?: string | null;
}

export interface AccountWithEntity extends Account {
  entityName: string;
}

export const accountsApi = {
  list: (entityId: string, source?: string, enabledOnly?: boolean) => {
    const params = new URLSearchParams();
    if (source) params.set("source", source);
    if (enabledOnly) params.set("enabled", "true");
    const qs = params.toString();
    return api.get<Account[]>(`/entities/${entityId}/accounts${qs ? `?${qs}` : ""}`);
  },

  /** Load enabled accounts from all other company entities (for cross-entity transfers) */
  listOtherAccounts: async (
    _entities: { id: string; name: string }[],
    excludeEntityId: string,
  ): Promise<AccountWithEntity[]> => {
    return api.get<AccountWithEntity[]>(`/dds/company-cash?excludeEntityId=${excludeEntityId}`);
  },

  create: (entityId: string, data: CreateAccountPayload) =>
    api.post<Account>(`/entities/${entityId}/accounts`, data),

  update: (entityId: string, id: string, data: Partial<CreateAccountPayload & { enabled: boolean }>) =>
    api.put<Account>(`/entities/${entityId}/accounts/${id}`, data),

  delete: (entityId: string, id: string) =>
    api.delete<void>(`/entities/${entityId}/accounts/${id}`),
};
