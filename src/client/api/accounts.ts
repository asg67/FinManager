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

  listAllEntities: async (
    entities: { id: string; name: string }[],
    source?: string,
    enabledOnly?: boolean,
  ): Promise<AccountWithEntity[]> => {
    const results = await Promise.all(
      entities.map(async (ent) => {
        const accounts = await accountsApi.list(ent.id, source, enabledOnly);
        return accounts.map((a) => ({ ...a, entityName: ent.name }));
      }),
    );
    return results.flat();
  },

  create: (entityId: string, data: CreateAccountPayload) =>
    api.post<Account>(`/entities/${entityId}/accounts`, data),

  update: (entityId: string, id: string, data: Partial<CreateAccountPayload & { enabled: boolean }>) =>
    api.put<Account>(`/entities/${entityId}/accounts/${id}`, data),

  delete: (entityId: string, id: string) =>
    api.delete<void>(`/entities/${entityId}/accounts/${id}`),
};
