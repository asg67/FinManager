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
import { useAuthStore } from "../stores/auth.js";
import { useThemeStore } from "../stores/theme.js";
import { Select } from "../components/ui/index.js";
import type { Entity } from "@shared/types.js";

const CHART_COLORS_LIGHT = ["#F5A623", "#1A1A1A", "#D9D9D9", "#F4D78E", "#6B6B6B", "#EDAA3B", "#999999", "#333333"];
const CHART_COLORS_DARK = ["#6b7280", "#9ca3af", "#4b5563", "#d1d5db", "#374151", "#a3a3a3", "#525252", "#e5e7eb"];

const PERIOD_OPTIONS = [
  { value: "7", labelKey: "dashboard.7days" },
  { value: "30", labelKey: "dashboard.30days" },
  { value: "90", labelKey: "dashboard.90days" },
  { value: "365", labelKey: "dashboard.1year" },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);

  const chartColors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS_DARK;
  const balanceLineColor = theme === "light" ? "#1A1A1A" : "#8994a7";

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
    if (type === "card") return <CreditCard size={18} />;
    if (type === "cash") return <Wallet size={18} />;
    return <Wallet size={18} />;
  };

  const totalExpense = categories.reduce((sum, c) => sum + c.total, 0);

  const tooltipStyle = {
    background: "var(--bg-surface-solid)",
    border: "1px solid var(--glass-border)",
    borderRadius: 8,
    fontSize: 13,
  };

  return (
    <div className="dashboard page-enter">
      {/* Greeting + Filters */}
      <div className="dash-top">
        <div className="dash-greeting">
          <h1 className="dash-greeting__name">
            {t("dashboard.welcome")}, {user?.name || ""}
          </h1>
          <p className="dash-greeting__hint">
            {t("dashboard.exportReminder", { days: 14 })}
          </p>
        </div>
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
        <div className="dash-skeleton-grid">
          <div className="skeleton skeleton--card" />
          <div className="skeleton skeleton--card" />
          <div className="skeleton skeleton--card" />
          <div className="skeleton skeleton--card" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card glass-card summary-card--balance">
              <div className="summary-card__icon"><Wallet size={22} /></div>
              <div className="summary-card__content">
                <div className="summary-card__label">{t("dashboard.balance")}</div>
                <div className="summary-card__value">{formatMoney(summary?.balance ?? 0)} &#8381;</div>
              </div>
            </div>
            <div className="summary-card glass-card summary-card--income">
              <div className="summary-card__icon"><TrendingUp size={22} /></div>
              <div className="summary-card__content">
                <div className="summary-card__label">{t("dashboard.income")}</div>
                <div className="summary-card__value">+{formatMoney(summary?.totalIncome ?? 0)} &#8381;</div>
              </div>
            </div>
            <div className="summary-card glass-card summary-card--expense">
              <div className="summary-card__icon"><TrendingDown size={22} /></div>
              <div className="summary-card__content">
                <div className="summary-card__label">{t("dashboard.expense")}</div>
                <div className="summary-card__value">-{formatMoney(summary?.totalExpense ?? 0)} &#8381;</div>
              </div>
            </div>
            <div className="summary-card glass-card summary-card--count">
              <div className="summary-card__icon"><Activity size={22} /></div>
              <div className="summary-card__content">
                <div className="summary-card__label">{t("dashboard.operations")}</div>
                <div className="summary-card__value">{summary?.operationsCount ?? 0}</div>
              </div>
            </div>
          </div>

          {/* Middle Row: Donut + Highlight + Accounts */}
          <div className="dash-middle">
            {/* Donut — Card Expenses */}
            <div className="glass-card dash-donut-card">
              <h3 className="chart-title">{t("dashboard.cardExpenses")}</h3>
              <div className="dash-donut-wrapper">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={categories.length > 0 ? categories : [{ name: "-", total: 1 }]}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={categories.length > 1 ? 3 : 0}
                      stroke="none"
                    >
                      {categories.length > 0
                        ? categories.map((_, i) => (
                            <Cell key={i} fill={chartColors[i % chartColors.length]} />
                          ))
                        : <Cell fill="var(--bg-surface)" />
                      }
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${formatMoney(value)} \u20bd`]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="dash-donut-center">
                  <span className="dash-donut-center__value">{formatMoney(totalExpense)}</span>
                  <span className="dash-donut-center__label">&#8381;</span>
                </div>
              </div>
              <div className="dash-donut-legend">
                {categories.slice(0, 5).map((cat, i) => (
                  <div key={cat.expenseTypeId} className="dash-donut-legend__item">
                    <span className="dash-donut-legend__dot" style={{ background: chartColors[i % chartColors.length] }} />
                    <span className="dash-donut-legend__name">{cat.name}</span>
                    <span className="dash-donut-legend__val">{formatMoney(cat.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right side: Highlight + Accounts */}
            <div className="dash-middle-right">
              <div className="dash-highlight">
                <div className="dash-highlight__title">{t("dashboard.myBalance")}</div>
                <div className="dash-highlight__value">
                  {formatMoney(summary?.balance ?? 0)} &#8381;
                </div>
                <div className="dash-highlight__hint">
                  {t("dashboard.exportReminder", { days: 14 })}
                </div>
              </div>

              <div className="glass-card dash-accounts-card">
                <h3 className="chart-title">{t("dashboard.accounts")}</h3>
                <div className="dash-accounts-list">
                  {balances.map((acc) => (
                    <div key={acc.id} className="dash-account-row">
                      <div className="dash-account-row__icon">{bankIcon(acc.type)}</div>
                      <div className="dash-account-row__info">
                        <span className="dash-account-row__name">{acc.name}</span>
                        <span className="dash-account-row__entity">{acc.entityName}</span>
                      </div>
                      <div className="dash-account-row__balance">
                        {formatMoney(acc.balance)} <span className="currency">&#8381;</span>
                      </div>
                    </div>
                  ))}
                  {balances.length === 0 && (
                    <div className="tab-empty">{t("settings.noAccounts")}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="charts-row">
            <div className="glass-card chart-card chart-card--wide">
              <h3 className="chart-title">{t("dashboard.balanceTimeline")}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: "var(--text-primary)" }}
                    formatter={(value: number) => [`${formatMoney(value)} \u20bd`, ""]}
                    labelFormatter={formatShortDate}
                  />
                  <Line type="monotone" dataKey="balance" stroke={balanceLineColor} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="income" stroke="var(--color-income)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="expense" stroke="var(--color-expense)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {categories.length > 0 && (
              <div className="glass-card chart-card">
                <h3 className="chart-title">{t("dashboard.expensesByCategory")}</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={categories} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                    <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={12} width={100} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${formatMoney(value)} \u20bd`, t("dds.expense")]} />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                      {categories.map((_, i) => (
                        <Cell key={i} fill={chartColors[i % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {categories.length > 0 && (
              <div className="glass-card chart-card">
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
                      stroke="none"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      fontSize={11}
                    >
                      {categories.map((_, i) => (
                        <Cell key={i} fill={chartColors[i % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${formatMoney(value)} \u20bd`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Recent Operations */}
          <div className="glass-card dash-recent">
            <h3 className="chart-title">{t("dashboard.recentOperations")}</h3>
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
        </>
      )}
    </div>
  );
}
