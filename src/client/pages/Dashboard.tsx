import { useState, useEffect, useRef } from "react";
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
  Calendar,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
import { useAuthStore } from "../stores/auth.js";
import { useThemeStore } from "../stores/theme.js";

const CHART_COLORS_LIGHT = ["#F5A623", "#1A1A1A", "#D9D9D9", "#F4D78E", "#6B6B6B", "#EDAA3B", "#999999", "#333333"];
const CHART_COLORS_DARK = ["#6b7280", "#9ca3af", "#4b5563", "#d1d5db", "#374151", "#a3a3a3", "#525252", "#e5e7eb"];

const TIMELINE_PERIODS = [
  { key: "7d", label: "7д", days: 7 },
  { key: "30d", label: "1мес", days: 30 },
  { key: "90d", label: "3мес", days: 90 },
  { key: "180d", label: "6мес", days: 180 },
  { key: "365d", label: "1г", days: 365 },
];

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function formatRange(from: string, to: string) {
  const f = new Date(from);
  const t = new Date(to);
  const fmt = (d: Date) => d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return `${fmt(f)} — ${fmt(t)}`;
}

function firstName(fullName: string | undefined | null): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  // Russian naming: "Фамилия Имя" — first name is the second word
  return parts.length > 1 ? parts[1] : parts[0];
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);

  const chartColors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS_DARK;
  const balanceLineColor = theme === "light" ? "#F5A623" : "#8994a7";

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(today);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tmpFrom, setTmpFrom] = useState(defaultFrom);
  const [tmpTo, setTmpTo] = useState(today);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [timelineDays, setTimelineDays] = useState(30);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [recent, setRecent] = useState<RecentOperation[]>([]);
  const [loading, setLoading] = useState(true);

  // Close picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    if (pickerOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  function applyDates() {
    setDateFrom(tmpFrom);
    setDateTo(tmpTo);
    setPickerOpen(false);
  }

  // Main data fetch
  useEffect(() => {
    setLoading(true);
    const filters = { from: dateFrom, to: dateTo, mine: "true" };
    Promise.all([
      analyticsApi.summary(filters),
      analyticsApi.byCategory(filters),
      analyticsApi.timeline(timelineDays, undefined, "true"),
      analyticsApi.accountBalances(undefined, "true"),
      analyticsApi.recent(10, "true"),
    ]).then(([sum, cats, tl, bal, rec]) => {
      setSummary(sum);
      setCategories(cats);
      setTimeline(tl);
      setBalances(bal);
      setRecent(rec);
      setLoading(false);
    });
  }, [dateFrom, dateTo]);

  // Refetch timeline when period changes (skip initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    analyticsApi.timeline(timelineDays, undefined, "true").then(setTimeline);
  }, [timelineDays]);

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
    return <Wallet size={18} />;
  };

  const totalExpense = categories.reduce((sum, c) => sum + c.total, 0);

  const tooltipStyle = {
    background: "var(--bg-surface-solid)",
    border: "1px solid var(--glass-border)",
    borderRadius: 12,
    fontSize: 13,
  };

  return (
    <div className="dashboard page-enter">
      <div className="dashboard-glass">
        {/* Greeting + Date picker */}
        <div className="dash-top">
          <div className="dash-greeting">
            <h1 className="dash-greeting__name">
              {t("dashboard.welcome")}, {firstName(user?.name)}
            </h1>
          </div>
          <div className="dashboard-filters" ref={pickerRef}>
            <button
              type="button"
              className="dash-date-btn"
              onClick={() => { setTmpFrom(dateFrom); setTmpTo(dateTo); setPickerOpen(!pickerOpen); }}
            >
              <Calendar size={16} />
              <span>{formatRange(dateFrom, dateTo)}</span>
            </button>
            {pickerOpen && (
              <div className="dash-date-picker">
                <div className="dash-date-picker__row">
                  <label className="dash-date-picker__label">
                    {t("dashboard.from")}
                    <input type="date" className="dash-date-picker__input" value={tmpFrom} onChange={(e) => setTmpFrom(e.target.value)} />
                  </label>
                  <label className="dash-date-picker__label">
                    {t("dashboard.to")}
                    <input type="date" className="dash-date-picker__input" value={tmpTo} onChange={(e) => setTmpTo(e.target.value)} />
                  </label>
                </div>
                <button type="button" className="btn btn--primary btn--sm dash-date-picker__apply" onClick={applyDates}>
                  {t("dashboard.apply")}
                </button>
              </div>
            )}
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
                {categories.length > 0 ? (
                  <>
                    <div className="dash-donut-wrapper">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={categories}
                            dataKey="total"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={categories.length > 1 ? 3 : 0}
                            stroke="none"
                          >
                            {categories.map((_, i) => (
                              <Cell key={i} fill={chartColors[i % chartColors.length]} />
                            ))}
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
                  </>
                ) : (
                  <div className="dash-empty-placeholder">
                    <span>{t("dashboard.noData")}</span>
                  </div>
                )}
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
                      <div className="dash-empty-placeholder">
                        <span>{t("settings.noAccounts")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="charts-row">
              <div className="glass-card chart-card chart-card--wide">
                <div className="chart-card__header">
                  <h3 className="chart-title">{t("dashboard.balanceTimeline")}</h3>
                  <div className="timeline-periods">
                    {TIMELINE_PERIODS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        className={`timeline-period-btn${timelineDays === p.days ? " timeline-period-btn--active" : ""}`}
                        onClick={() => setTimelineDays(p.days)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={timeline}>
                    <defs>
                      <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={balanceLineColor} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={balanceLineColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                    <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="#999" fontSize={11} />
                    <YAxis stroke="#999" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "var(--text-primary)" }}
                      formatter={(value: number) => [`${formatMoney(value)} \u20bd`, ""]}
                      labelFormatter={formatShortDate}
                    />
                    <Area type="monotone" dataKey="balance" stroke={balanceLineColor} fill="url(#balanceGradient)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {categories.length > 0 && (
                <div className="glass-card chart-card">
                  <h3 className="chart-title">{t("dashboard.expensesByCategory")}</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={categories} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                      <XAxis type="number" stroke="#999" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" stroke="#999" fontSize={11} width={100} />
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
                  <div className="dash-empty-placeholder">{t("dds.noOperations")}</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
