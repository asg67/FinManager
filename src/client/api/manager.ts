import { api, getAccessToken } from "./client.js";

export interface ManagerCompany {
  id: string;
  name: string;
  mode: string;
  entitiesCount: number;
  usersCount: number;
  lastDdsAt: string | null;
}

export interface ManagerCompanyDetail {
  id: string;
  name: string;
  mode: string;
  entities: { id: string; name: string; accountsCount: number }[];
  stats: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    operationsCount: number;
  };
}

export interface ManagerCompanyUser {
  id: string;
  name: string;
  email: string;
  role: string;
  lastAction: { type: string; date: string } | null;
  createdAt: string;
}

export interface CategoryStat {
  name: string;
  total: number;
}

export interface MonthStat {
  month: string;
  income: number;
  expense: number;
}

export interface ManagerOperation {
  id: string;
  operationType: string;
  amount: number;
  entityId: string;
  entity: { name: string };
  fromAccount: { name: string } | null;
  toAccount: { name: string } | null;
  expenseType: { name: string } | null;
  expenseArticle: { name: string } | null;
  incomeType: { name: string } | null;
  incomeArticle: { name: string } | null;
  direction: { name: string } | null;
  user: { name: string } | null;
  orderNumber: string | null;
  comment: string | null;
  createdAt: string;
  customFieldValues: { customField: { name: string }; value: string }[];
}

export interface ManagerOperationsResponse {
  data: ManagerOperation[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, v);
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

async function downloadBlob(url: string, filename: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

export const managerApi = {
  getCompanies: () =>
    api.get<ManagerCompany[]>("/manager/companies"),

  getCompany: (companyId: string, params?: { from?: string; to?: string }) =>
    api.get<ManagerCompanyDetail>(`/manager/companies/${companyId}${buildQuery({ from: params?.from, to: params?.to })}`),

  getOperations: (companyId: string, params: {
    entityId?: string;
    operationType?: string;
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = buildQuery({
      entityId: params.entityId,
      operationType: params.operationType,
      from: params.from,
      to: params.to,
      search: params.search,
      page: params.page?.toString(),
      limit: params.limit?.toString(),
    });
    return api.get<ManagerOperationsResponse>(`/manager/companies/${companyId}/operations${q}`);
  },

  getUsers: (companyId: string) =>
    api.get<ManagerCompanyUser[]>(`/manager/companies/${companyId}/users`),

  getStatsByCategory: (companyId: string, params?: { entityId?: string; from?: string; to?: string }) =>
    api.get<CategoryStat[]>(`/manager/companies/${companyId}/stats/by-category${buildQuery({ entityId: params?.entityId, from: params?.from, to: params?.to })}`),

  getStatsByMonth: (companyId: string, params?: { entityId?: string }) =>
    api.get<MonthStat[]>(`/manager/companies/${companyId}/stats/by-month${buildQuery({ entityId: params?.entityId })}`),

  exportExcel: async (companyId: string, companyName: string, params?: { entityId?: string; from?: string; to?: string }) => {
    const q = buildQuery({ entityId: params?.entityId, from: params?.from, to: params?.to });
    const date = new Date().toISOString().slice(0, 10);
    await downloadBlob(
      `/api/manager/companies/${companyId}/export/dds-excel${q}`,
      `dds-${companyName}-${date}.xlsx`,
    );
  },
};
