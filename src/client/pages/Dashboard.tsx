import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  CreditCard,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { analyticsApi, type SummaryData, type CategoryData, type TimelinePoint, type AccountBalance, type RecentOperation } from "../api/analytics.js";
import { entitiesApi } from "../api/entities.js";
import { Select } from "../components/ui/index.js";
import type { Entity } from "@shared/types.js";

const CHART_COLORS = ["#38bdf8", "#f472b6", "#a78bfa", "#fb923c", "#34d399", "#fbbf24", "#f87171", "#818cf8"];
const PERIOD_OPTIONS = [
  { value: "7", labelKey: "dashboard.7days" },
  { value: "30", labelKey: "dashboard.30days" },
  { value: "90", labelKey: "dashboard.90days" },
  { value: "365", labelKey: "dashboard.1year" },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityFilter, setEntityFilter] = useState("");
  const [period, setPeriod] = useState("30");

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [recent, setRecent] = useState<RecentOperation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    entitiesApi.list().then(setEntities);
  }, []);

  useEffect(() => {
    setLoading(true);
    const filters = { entityId: entityFilter || undefined };
    Promise.all([
      analyticsApi.summary(filters),
      analyticsApi.byCategory(filters),
      analyticsApi.timeline(parseInt(period), filters.entityId),
      analyticsApi.accountBalances(filters.entityId),
      analyticsApi.recent(10),
    ]).then(([sum, cats, tl, bal, rec]) => {
      setSummary(sum);
      setCategories(cats);
      setTimeline(tl);
      setBalances(bal);
      setRecent(rec);
      setLoading(false);
    });
  }, [entityFilter, period]);

  function formatMoney(n: number) {
    return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
  }

  function formatShortDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const opIcon = (type: string) => {
    if (type === "income") return <ArrowUpRight size={16} className="recent-icon recent-icon--income" />;
    if (type === "expense") return <ArrowDownRight size={16} className="recent-icon recent-icon--expense" />;
    return <ArrowRightLeft size={16} className="recent-icon recent-icon--transfer" />;
  };

  const bankIcon = (type: string) => {
    if (type === "card") return "💳";
    if (type === "cash") return "💵";
    if (type === "deposit") return "🏦";
    return "🏛️";
  };

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">{t("dashboard.title")}</h1>
        <div className="dashboard-filters">
          <Select
            options={[{ value: "", label: t("dds.allEntities") }, ...entities.map((e) => ({ value: e.id, label: e.name }))]}
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
          />
          <Select
            options={PERIOD_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="tab-loading">{t("common.loading")}</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card summary-card--balance">
              <div className="summary-card__icon"><Wallet size={24} /></div>
              <div className="summary-card__content">
                <div className="summary-card__label">{t("dashboard.balance")}</div>
                <div className="summary-card__value">{formatMoney(summary?.balance ?? 0)} &#8381;</div>
              </div>
            </div>
            <div className="summary-card summary-card--income">
              <div className="summary-card__icon"><TrendingUp size={24} /></div>
              <div className="summary-card__content">
                <div className="summary-card__label">{t("dashboard.income")}</div>
                <div className="summary-card__value">+{formatMoney(summary?.totalIncome ?? 0)} &#8381;</div>
              </div>
            </div>
            <div className="summary-card summary-card--expense">
              <div className="summary-card__icon"><TrendingDown size={24} /></div>
              <div className="summary-card__content">
                <div className="summary-card__label">{t("dashboard.expense")}</div>
                <div className="summary-card__value">-{formatMoney(summary?.totalExpense ?? 0)} &#8381;</div>
              </div>
            </div>
            <div className="summary-card summary-card--count">
              <div className="summary-card__icon"><Activity size={24} /></div>
              <div className="summary-card__content">
                <div className="summary-card__label">{t("dashboard.operations")}</div>
                <div className="summary-card__value">{summary?.operationsCount ?? 0}</div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="charts-row">
            {/* Line Chart — Balance Timeline */}
            <div className="chart-card chart-card--wide">
              <h3 className="chart-title">{t("dashboard.balanceTimeline")}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="var(--text-secondary)" fontSize={12} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8 }}
                    labelStyle={{ color: "var(--text-primary)" }}
                    formatter={(value: number) => [`${formatMoney(value)} ₽`, ""]}
                    labelFormatter={formatShortDate}
                  />
                  <Line type="monotone" dataKey="balance" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={1} dot={false} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart — Expenses by Category */}
            {categories.length > 0 && (
              <div className="chart-card">
                <h3 className="chart-title">{t("dashboard.expensesByCategory")}</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={categories} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" stroke="var(--text-secondary)" fontSize={12} width={100} />
                    <Tooltip
                      contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8 }}
                      formatter={(value: number) => [`${formatMoney(value)} ₽`, t("dds.expense")]}
                    />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {categories.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Pie Chart — Expense Distribution */}
            {categories.length > 0 && (
              <div className="chart-card">
                <h3 className="chart-title">{t("dashboard.expenseDistribution")}</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      fontSize={11}
                    >
                      {categories.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8 }}
                      formatter={(value: number) => [`${formatMoney(value)} ₽`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Bottom Row: Account Widgets + Recent Operations */}
          <div className="dashboard-bottom">
            {/* Account Widgets */}
            <div className="account-widgets">
              <h3 className="section-title">{t("dashboard.accounts")}</h3>
              <div className="account-cards-scroll">
                {balances.map((acc) => (
                  <div key={acc.id} className={`account-widget account-widget--${acc.type}`}>
                    <div className="account-widget__top">
                      <span className="account-widget__icon">{bankIcon(acc.type)}</span>
                      <span className="account-widget__bank">{acc.bank ?? acc.type}</span>
                    </div>
                    <div className="account-widget__name">{acc.name}</div>
                    <div className="account-widget__entity">{acc.entityName}</div>
                    <div className="account-widget__balance">
                      {formatMoney(acc.balance)} <span className="currency">&#8381;</span>
                    </div>
                  </div>
                ))}
                {balances.length === 0 && (
                  <div className="tab-empty">{t("settings.noAccounts")}</div>
                )}
              </div>
            </div>

            {/* Recent Operations */}
            <div className="recent-operations">
              <h3 className="section-title">{t("dashboard.recentOperations")}</h3>
              <div className="recent-list">
                {recent.map((op) => (
                  <div
                    key={`${op.source}-${op.id}`}
                    className="recent-item"
                    onClick={() => op.source === "dds" && navigate("/dds")}
                  >
                    <div className="recent-item__left">
                      {opIcon(op.type)}
                      <div>
                        <div className="recent-item__desc">{op.description}</div>
                        <div className="recent-item__meta">
                          {op.account && <span>{op.account}</span>}
                          {op.entity && <span> &middot; {op.entity}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="recent-item__right">
                      <div className={`recent-item__amount amount--${op.type}`}>
                        {op.type === "income" ? "+" : op.type === "expense" ? "-" : ""}
                        {formatMoney(op.amount)} &#8381;
                      </div>
                      <div className="recent-item__date">{formatShortDate(op.date)}</div>
                    </div>
                  </div>
                ))}
                {recent.length === 0 && (
                  <div className="tab-empty">{t("dds.noOperations")}</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
