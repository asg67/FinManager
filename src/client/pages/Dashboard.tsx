import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Wallet, TrendingUp, TrendingDown, Activity,
  CreditCard, Banknote, PiggyBank, Calendar,
  BarChart3, LineChart as LineChartIcon, CircleDot,
  ArrowUpRight, ArrowDownLeft, ArrowRightLeft,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { analyticsApi, type SummaryData, type TimelinePoint, type AccountBalance, type RecentOperation } from "../api/analytics.js";
import { useAuthStore } from "../stores/auth.js";
import { useThemeStore } from "../stores/theme.js";

type CategoryFilter = "all" | "checking" | "card" | "cash" | "deposit";
type ChartType = "bar" | "line" | "pie";

const CATEGORY_COLORS: Record<string, string> = {
  checking: "#F5A623",
  card: "#1A1A1A",
  cash: "#D9D9D9",
  deposit: "#F4D78E",
};

const CATEGORY_COLORS_DARK: Record<string, string> = {
  checking: "#6b7280",
  card: "#9ca3af",
  cash: "#4b5563",
  deposit: "#d1d5db",
};

type PeriodKey = "week" | "1m" | "3m" | "6m" | "1y";

const TIMELINE_PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "week", label: "Неделя" },
  { key: "1m", label: "1мес" },
  { key: "3m", label: "3мес" },
  { key: "6m", label: "6мес" },
  { key: "1y", label: "1г" },
];

function periodFrom(key: PeriodKey): string {
  const now = new Date();
  let d: Date;
  switch (key) {
    case "week": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      d = new Date(now);
      d.setDate(now.getDate() - diff);
      break;
    }
    case "1m":
      d = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "3m":
      d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    case "6m":
      d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      break;
    case "1y":
      d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

function periodDaysHint(key: PeriodKey): number {
  switch (key) {
    case "week": return 7;
    case "1m": return 30;
    case "3m": return 90;
    case "6m": return 180;
    case "1y": return 365;
  }
}

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
  return parts.length > 1 ? parts[1] : parts[0];
}
function fmtShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function formatMoney(n: number) {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

const SHORT_WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const SHORT_MONTHS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

function formatXTick(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (days <= 7) return `${SHORT_WEEKDAYS[d.getDay()]} ${d.getDate()}`;
  if (days <= 30) return String(d.getDate());
  if (days <= 90) return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (days <= 180) return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
  return SHORT_MONTHS[d.getMonth()];
}

function formatTooltipDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);

  const catColors = theme === "light" ? CATEGORY_COLORS : CATEGORY_COLORS_DARK;

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(today);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tmpFrom, setTmpFrom] = useState(defaultFrom);
  const [tmpTo, setTmpTo] = useState(today);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [timelinePeriod, setTimelinePeriod] = useState<PeriodKey>("1m");

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [recent, setRecent] = useState<RecentOperation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    }
    if (pickerOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  function applyDates() {
    setDateFrom(tmpFrom);
    setDateTo(tmpTo);
    setPickerOpen(false);
  }

  useEffect(() => {
    setLoading(true);
    const filters = { from: dateFrom, to: dateTo, mine: "true" };
    Promise.all([
      analyticsApi.summary(filters),
      analyticsApi.timeline({ from: periodFrom(timelinePeriod), mine: "true" }),
      analyticsApi.accountBalances(undefined, "true"),
      analyticsApi.recent(10, "true"),
    ]).then(([sum, tl, bal, rec]) => {
      setSummary(sum);
      setTimeline(tl);
      setBalances(bal);
      setRecent(rec);
      setLoading(false);
    });
  }, [dateFrom, dateTo]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    analyticsApi.timeline({ from: periodFrom(timelinePeriod), mine: "true" }).then(setTimeline);
  }, [timelinePeriod]);

  /* Computed */
  const grouped = useMemo(() => {
    const g: Record<string, AccountBalance[]> = { checking: [], card: [], cash: [], deposit: [] };
    balances.forEach((a) => { if (g[a.type]) g[a.type].push(a); });
    return g;
  }, [balances]);

  const sumByType = useMemo(() => {
    const sums: Record<string, number> = {};
    for (const [type, list] of Object.entries(grouped)) sums[type] = list.reduce((s, a) => s + a.balance, 0);
    return sums;
  }, [grouped]);

  const donutData = useMemo(
    () => Object.entries(sumByType).filter(([, v]) => v > 0).map(([type, value]) => ({ name: typeLabel(type), value, color: catColors[type] || "#ccc" })),
    [sumByType, catColors],
  );
  const hasDonutData = donutData.length > 0;
  const donutDisplay = hasDonutData ? donutData : [{ name: "—", value: 1, color: theme === "light" ? "#E0E0E0" : "#374151" }];

  const chartData = useMemo(() => timeline.map((t) => ({ date: t.date, value: t.balance })), [timeline]);

  const daysHint = periodDaysHint(timelinePeriod);
  const xTickInterval = useMemo(() => {
    const len = chartData.length;
    if (len === 0) return 0;
    if (daysHint <= 7) return 0;
    if (daysHint <= 31) return Math.max(0, Math.ceil(len / 15) - 1);
    if (daysHint <= 90) return Math.max(0, Math.ceil(len / 12) - 1);
    if (daysHint <= 180) return Math.max(0, Math.ceil(len / 10) - 1);
    return Math.max(0, Math.ceil(len / 12) - 1);
  }, [chartData.length, daysHint]);

  const calcBalance = summary?.balance ?? balances.reduce((s, a) => s + a.balance, 0);
  const calcIncome = summary?.totalIncome ?? 0;
  const calcExpense = summary?.totalExpense ?? 0;
  const calcOps = summary?.operationsCount ?? 0;

  function typeLabel(type: string) {
    switch (type) {
      case "checking": return t("settings.typeChecking");
      case "card": return t("settings.typeCard");
      case "cash": return t("settings.typeCash");
      case "deposit": return t("settings.typeDeposit");
      default: return type;
    }
  }

  const sections = [
    { type: "checking", title: t("settings.typeChecking"), iconClass: "dash-account-section__icon--accounts", icon: <Wallet size={18} /> },
    { type: "card", title: t("settings.typeCard"), iconClass: "dash-account-section__icon--cards", icon: <CreditCard size={18} /> },
    { type: "cash", title: t("settings.typeCash"), iconClass: "dash-account-section__icon--cash", icon: <Banknote size={18} /> },
    { type: "deposit", title: t("settings.typeDeposit"), iconClass: "dash-account-section__icon--deposits", icon: <PiggyBank size={18} /> },
  ];

  const catTabs: { value: CategoryFilter; label: string }[] = [
    { value: "all", label: t("dds.allTypes") },
    { value: "checking", label: t("settings.typeChecking") },
    { value: "card", label: t("settings.typeCard") },
    { value: "cash", label: t("settings.typeCash") },
    { value: "deposit", label: t("settings.typeDeposit") },
  ];

  const ttStyle = theme === "light"
    ? { background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.6)", borderRadius: 12, fontSize: 13 }
    : { background: "var(--bg-surface-solid)", border: "1px solid var(--glass-border)", borderRadius: 12, fontSize: 13 };
  const accentColor = theme === "light" ? "#F5A623" : "#8994a7";

  const opIcon = (type: string) => {
    if (type === "income") return <ArrowUpRight className="recent-icon recent-icon--income" size={16} />;
    if (type === "expense") return <ArrowDownLeft className="recent-icon recent-icon--expense" size={16} />;
    return <ArrowRightLeft className="recent-icon recent-icon--transfer" size={16} />;
  };

  return (
    <div className="dashboard page-enter">
      <div className="dashboard-glass">
        {/* TOP */}
        <div className="dash-top">
          <div className="dash-greeting">
            <h1 className="dash-greeting__name">{t("dashboard.welcome")}, {firstName(user?.name)}</h1>
          </div>
          <div className="dashboard-filters" ref={pickerRef}>
            <button type="button" className="dash-date-btn" onClick={() => { setTmpFrom(dateFrom); setTmpTo(dateTo); setPickerOpen(!pickerOpen); }}>
              <Calendar size={16} />
              <span>{formatRange(dateFrom, dateTo)}</span>
            </button>
            {pickerOpen && (
              <div className="dash-date-picker">
                <div className="dash-date-picker__row">
                  <label className="dash-date-picker__label">{t("dashboard.from")}<input type="date" className="dash-date-picker__input" value={tmpFrom} onChange={(e) => setTmpFrom(e.target.value)} /></label>
                  <label className="dash-date-picker__label">{t("dashboard.to")}<input type="date" className="dash-date-picker__input" value={tmpTo} onChange={(e) => setTmpTo(e.target.value)} /></label>
                </div>
                <button type="button" className="btn btn--primary btn--sm dash-date-picker__apply" onClick={applyDates}>{t("dashboard.apply")}</button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="dash-skeleton-grid"><div className="skeleton skeleton--card" /><div className="skeleton skeleton--card" /><div className="skeleton skeleton--card" /><div className="skeleton skeleton--card" /></div>
        ) : (
          <>
            {/* MIDDLE: 2 columns */}
            <div className="dash-middle">
              {/* LEFT: Accounts grouped by type */}
              <div className="glass-card dash-accounts-card">
                {sections.map((sec) => {
                  const list = grouped[sec.type] || [];
                  if (list.length === 0) return null;
                  return (
                    <div className="dash-account-section" key={sec.type}>
                      <div className="dash-account-section__header">
                        <div className="dash-account-section__left">
                          <div className={`dash-account-section__icon ${sec.iconClass}`}>{sec.icon}</div>
                          <span className="dash-account-section__title">{sec.title}</span>
                        </div>
                        <span className="dash-account-section__total">{formatMoney(sumByType[sec.type] || 0)} ₽</span>
                      </div>
                      <div className="dash-accounts-list">
                        {list.map((acc) => (
                          <div className="dash-account-row" key={acc.id}>
                            <div className="dash-account-row__icon">{sec.type === "card" ? <CreditCard size={18} /> : <Wallet size={18} />}</div>
                            <div className="dash-account-row__info">
                              <span className="dash-account-row__name">{acc.name}</span>
                              <span className="dash-account-row__entity">{acc.entityName}</span>
                            </div>
                            <div className={`dash-account-row__balance${acc.balance > 0 ? " has-money" : ""}`}>
                              {formatMoney(acc.balance)} <span className="currency">₽</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {balances.length === 0 && <div className="dash-empty-placeholder"><span>{t("settings.noAccounts")}</span></div>}
              </div>

              {/* RIGHT column */}
              <div className="dash-middle-right">
                {/* Donut + Metrics */}
                <div className="glass-card dash-donut-metrics">
                  <div className="dash-donut-left">
                    <div className="dash-donut-chart-wrap">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={donutDisplay} dataKey="value" cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={hasDonutData ? 3 : 0} stroke="none">
                            {donutDisplay.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="dash-donut-center-label">
                        <div className="dash-donut-center-label__value">{formatMoney(calcBalance)} ₽</div>
                        <div className="dash-donut-center-label__sub">{t("dashboard.balance")}</div>
                      </div>
                    </div>
                    <div className="dash-donut-legend">
                      {Object.entries(catColors).map(([type, color]) => (
                        <div className="dash-donut-legend__item" key={type}>
                          <span className="dash-donut-legend__dot" style={{ background: color }} />
                          {typeLabel(type)}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="dash-metrics-column">
                    <div className="dash-metric-card">
                      <div className="dash-metric-card__top"><div className="dash-metric-card__icon dash-metric-card__icon--balance"><Wallet size={16} /></div><span className="dash-metric-card__label">{t("dashboard.balance")}</span></div>
                      <div className="dash-metric-card__value">{formatMoney(calcBalance)} ₽</div>
                    </div>
                    <div className="dash-metric-card">
                      <div className="dash-metric-card__top"><div className="dash-metric-card__icon dash-metric-card__icon--income"><TrendingUp size={16} /></div><span className="dash-metric-card__label">{t("dashboard.income")}</span></div>
                      <div className="dash-metric-card__value dash-metric-card__value--income">+{formatMoney(calcIncome)} ₽</div>
                    </div>
                    <div className="dash-metric-card">
                      <div className="dash-metric-card__top"><div className="dash-metric-card__icon dash-metric-card__icon--expense"><TrendingDown size={16} /></div><span className="dash-metric-card__label">{t("dashboard.expense")}</span></div>
                      <div className="dash-metric-card__value dash-metric-card__value--expense">-{formatMoney(Math.abs(calcExpense))} ₽</div>
                    </div>
                    <div className="dash-metric-card">
                      <div className="dash-metric-card__top"><div className="dash-metric-card__icon dash-metric-card__icon--count"><Activity size={16} /></div><span className="dash-metric-card__label">{t("dashboard.operations")}</span></div>
                      <div className="dash-metric-card__value">{calcOps}</div>
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="glass-card chart-card chart-card--wide">
                  <div className="chart-card__header">
                    <h3 className="chart-title">{t("dashboard.balanceTimeline")}</h3>
                    <div className="chart-filter-tabs">
                      {catTabs.map((tab) => (
                        <button key={tab.value} type="button" className={`chart-filter-tab${categoryFilter === tab.value ? " chart-filter-tab--active" : ""}`} onClick={() => setCategoryFilter(tab.value)}>{tab.label}</button>
                      ))}
                    </div>
                    <div className="chart-type-switcher">
                      <button type="button" className={`chart-type-btn${chartType === "bar" ? " chart-type-btn--active" : ""}`} onClick={() => setChartType("bar")}><BarChart3 size={18} /></button>
                      <button type="button" className={`chart-type-btn${chartType === "line" ? " chart-type-btn--active" : ""}`} onClick={() => setChartType("line")}><LineChartIcon size={18} /></button>
                      <button type="button" className={`chart-type-btn${chartType === "pie" ? " chart-type-btn--active" : ""}`} onClick={() => setChartType("pie")}><CircleDot size={18} /></button>
                    </div>
                    <div className="timeline-periods">
                      {TIMELINE_PERIODS.map((p) => (
                        <button key={p.key} type="button" className={`timeline-period-btn${timelinePeriod === p.key ? " timeline-period-btn--active" : ""}`} onClick={() => setTimelinePeriod(p.key)}>{p.label}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === "bar" ? (
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#999" }} stroke="#999" interval={xTickInterval} tickFormatter={(v) => formatXTick(v, daysHint)} />
                          <YAxis tick={{ fontSize: 11, fill: "#999" }} stroke="#999" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={ttStyle} formatter={(value: number) => [`${formatMoney(value)} ₽`]} labelFormatter={formatTooltipDate} />
                          <Bar dataKey="value" fill={accentColor} radius={[10, 10, 0, 0]} maxBarSize={30} />
                        </BarChart>
                      ) : chartType === "line" ? (
                        <AreaChart data={chartData}>
                          <defs><linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={accentColor} stopOpacity={0.15} /><stop offset="95%" stopColor={accentColor} stopOpacity={0} /></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#999" }} stroke="#999" interval={xTickInterval} tickFormatter={(v) => formatXTick(v, daysHint)} />
                          <YAxis tick={{ fontSize: 11, fill: "#999" }} stroke="#999" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={ttStyle} formatter={(value: number) => [`${formatMoney(value)} ₽`]} labelFormatter={formatTooltipDate} />
                          <Area type="monotone" dataKey="value" stroke={accentColor} strokeWidth={2.5} fill="url(#balanceGrad)" fillOpacity={0.6} />
                        </AreaChart>
                      ) : (
                        <PieChart>
                          <Pie data={donutDisplay} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} stroke="none" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {donutDisplay.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip contentStyle={ttStyle} formatter={(value: number) => [`${formatMoney(value)} ₽`]} />
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Operations */}
            <div className="glass-card dash-recent">
              <h3 className="chart-title">{t("dashboard.recentOperations")}</h3>
              <div className="recent-list">
                {recent.map((op) => (
                  <div key={`${op.source}-${op.id}`} className="recent-item" onClick={() => op.source === "dds" && navigate("/dds")}>
                    <div className="recent-item__left">
                      {opIcon(op.type)}
                      <div>
                        <div className="recent-item__desc">{op.description}</div>
                        <div className="recent-item__meta">{op.account && <span>{op.account}</span>}{op.entity && <span> · {op.entity}</span>}</div>
                      </div>
                    </div>
                    <div className="recent-item__right">
                      <div className={`recent-item__amount ${op.type === "income" ? "amount--income" : op.type === "expense" ? "amount--expense" : "amount--transfer"}`}>
                        {op.type === "income" ? "+" : op.type === "expense" ? "-" : ""}{formatMoney(op.amount)} ₽
                      </div>
                      <div className="recent-item__date">{fmtShortDate(op.date)}</div>
                    </div>
                  </div>
                ))}
                {recent.length === 0 && <div className="dash-empty-placeholder"><span>{t("dds.noOperations")}</span></div>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
