import { api } from "./client.js";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  companyName: string | null;
  lastAction: { type: string; date: string } | null;
  createdAt: string;
}

export interface AdminCompanyDetail {
  id: string;
  name: string;
  onboardingDone: boolean;
  createdAt: string;
  members: { id: string; name: string; email: string; role: string; createdAt: string }[];
  entities: { id: string; name: string; accountsCount: number }[];
}

export interface AdminOperation {
  id: string;
  operationType: string;
  amount: number;
  comment: string | null;
  orderNumber: string | null;
  createdAt: string;
  entity: { name: string };
  fromAccount: { name: string; type: string } | null;
  toAccount: { name: string; type: string } | null;
  expenseType: { name: string } | null;
  expenseArticle: { name: string } | null;
  user: { name: string };
}

export interface AdminEntityDetail {
  id: string;
  name: string;
  accounts: {
    id: string;
    name: string;
    type: string;
    bank: string | null;
    accountNumber: string | null;
    transactionCount: number;
  }[];
  recentTransactions: {
    id: string;
    date: string;
    amount: number;
    direction: string;
    counterparty: string | null;
    purpose: string | null;
    accountName: string;
    bank: string | null;
  }[];
}

export interface AdminCompanyListItem {
  id: string;
  name: string;
  onboardingDone: boolean;
  usersCount: number;
  entitiesCount: number;
  createdAt: string;
}

export const adminApi = {
  getStats: () =>
    api.get<{ companiesCount: number; usersCount: number }>("/admin/stats"),

  listCompanies: () =>
    api.get<AdminCompanyListItem[]>("/admin/companies"),

  listUsers: () =>
    api.get<AdminUser[]>("/admin/users"),

  getCompany: (id: string) =>
    api.get<AdminCompanyDetail>(`/admin/companies/${id}`),

  getCompanyOperations: (id: string, params?: { page?: number; limit?: number; entityId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.entityId) qs.set("entityId", params.entityId);
    const q = qs.toString();
    return api.get<{ data: AdminOperation[]; total: number; page: number; totalPages: number }>(
      `/admin/companies/${id}/operations${q ? `?${q}` : ""}`,
    );
  },

  getEntity: (companyId: string, entityId: string) =>
    api.get<AdminEntityDetail>(`/admin/companies/${companyId}/entities/${entityId}`),
};
