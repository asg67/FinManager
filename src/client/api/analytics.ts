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
  mine?: string;
  [key: string]: string | undefined;
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

  timeline: (opts: { days?: number; from?: string; entityId?: string; mine?: string; accountType?: string } = {}) =>
    api.get<TimelinePoint[]>(`/analytics/timeline${qs({ days: opts.days != null ? String(opts.days) : undefined, from: opts.from, entityId: opts.entityId, mine: opts.mine, accountType: opts.accountType })}`),

  accountBalances: (entityId?: string, mine?: string) =>
    api.get<AccountBalance[]>(`/analytics/account-balances${qs({ entityId, mine })}`),

  recent: (limit: number = 10, mine?: string) =>
    api.get<RecentOperation[]>(`/analytics/recent${qs({ limit: String(limit), mine })}`),
};
