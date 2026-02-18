import { api } from "./client.js";

export interface SummaryData {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  operationsCount: number;
}

export interface CategoryData {
  expenseTypeId: string;
  name: string;
  total: number;
  count: number;
}

export interface TimelinePoint {
  date: string;
  income: number;
  expense: number;
  balance: number;
}

export interface AccountBalance {
  id: string;
  name: string;
  type: string;
  bank: string | null;
  entityName: string;
  balance: number;
}

export interface RecentOperation {
  id: string;
  source: "dds" | "bank";
  date: string;
  type: string;
  amount: number;
  description: string;
  entity: string | null;
  account: string | null;
}

export interface AnalyticsFilters {
  entityId?: string;
  from?: string;
  to?: string;
}

function qs(filters: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  const s = params.toString();
  return s ? `?${s}` : "";
}

export const analyticsApi = {
  summary: (filters: AnalyticsFilters = {}) =>
    api.get<SummaryData>(`/analytics/summary${qs(filters)}`),

  byCategory: (filters: AnalyticsFilters = {}) =>
    api.get<CategoryData[]>(`/analytics/by-category${qs(filters)}`),

  timeline: (days: number = 30, entityId?: string) =>
    api.get<TimelinePoint[]>(`/analytics/timeline${qs({ days: String(days), entityId })}`),

  accountBalances: (entityId?: string) =>
    api.get<AccountBalance[]>(`/analytics/account-balances${qs({ entityId })}`),

  recent: (limit: number = 10) =>
    api.get<RecentOperation[]>(`/analytics/recent?limit=${limit}`),
};
