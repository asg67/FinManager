import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Wallet, TrendingUp, TrendingDown, Activity,
  CreditCard, Banknote, PiggyBank, Calendar,
  ArrowUpRight, ArrowDownLeft, ArrowRightLeft,
  ChevronDown, ChevronRight, Link2,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { analyticsApi, type SummaryData, type AccountBalance, type RecentOperation, type TimelinePoint, type CategoryData } from "../api/analytics.js";
import { ddsApi } from "../api/dds.js";
import { pdfApi, type BankTransaction } from "../api/pdf.js";
import { entitiesApi } from "../api/entities.js";
import { reconciliationApi } from "../api/reconciliation.js";
import { useAuthStore } from "../stores/auth.js";
import { useThemeStore } from "../stores/theme.js";
import type { DdsOperation } from "@shared/types.js";

const EXPENSE_CAT_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316",
  "#eab308", "#84cc16", "#22c55e", "#14b8a6",
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
  return parts.length > 1 ? parts[1] : parts[0];
}
function fmtShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function formatMoney(n: number) {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(today);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tmpFrom, setTmpFrom] = useState(defaultFrom);
  const [tmpTo, setTmpTo] = useState(today);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [myEntityId, setMyEntityId] = useState<string | undefined>(undefined);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [recent, setRecent] = useState<RecentOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<number | null>(null);
  const [opsTab, setOpsTab] = useState<"all" | "dds" | "statements" | "accounts">("all");
  const [ddsOps, setDdsOps] = useState<DdsOperation[]>([]);
  const [bankTxs, setBankTxs] = useState<BankTransaction[]>([]);
  const [opsLoading, setOpsLoading] = useState(false);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [chartFilter, setChartFilter] = useState<"all" | "income" | "expense">("all");
  const [chartOpen, setChartOpen] = useState(false);

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

  // Load user's own entity
  useEffect(() => {
    entitiesApi.list().then((entities) => {
      const own = entities.find((e) => e.ownerId === user?.id);
      if (own) setMyEntityId(own.id);
    });
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    const filters = { from: dateFrom, to: dateTo, entityId: myEntityId };
    Promise.all([
      analyticsApi.summary(filters),
      analyticsApi.accountBalances(myEntityId),
      analyticsApi.recent(10, myEntityId),
      analyticsApi.timeline({ from: dateFrom, entityId: myEntityId }).catch(() => []),
      analyticsApi.byCategory(filters).catch(() => []),
    ]).then(([sum, bal, rec, tl, cat]) => {
      setSummary(sum);
      setBalances(bal);
      setRecent(rec);
      setTimeline(tl as TimelinePoint[]);
      setCategories(cat as CategoryData[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [dateFrom, dateTo, myEntityId]);

  useEffect(() => {
    if (opsTab === "dds") {
      setOpsLoading(true);
      ddsApi.listOperations({ from: dateFrom, to: dateTo, limit: 20 }).then((r) => {
        setDdsOps(r.data);
        setOpsLoading(false);
      }).catch(() => setOpsLoading(false));
    } else if (opsTab === "statements") {
      setOpsLoading(true);
      pdfApi.listTransactions({ from: dateFrom, to: dateTo, limit: 20 }).then((r) => {
        setBankTxs(r.data);
        setOpsLoading(false);
      }).catch(() => setOpsLoading(false));
    }
  }, [opsTab, dateFrom, dateTo]);

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

  // Sub-group accounts by entityName within each type
  const entityGroups = useMemo(() => {
    const result: Record<string, { entity: string; accounts: AccountBalance[]; total: number }[]> = {};
    for (const [type, list] of Object.entries(grouped)) {
      const byEntity = new Map<string, AccountBalance[]>();
      for (const acc of list) {
        const key = acc.entityName || "—";
        if (!byEntity.has(key)) byEntity.set(key, []);
        byEntity.get(key)!.push(acc);
      }
      result[type] = Array.from(byEntity.entries()).map(([entity, accounts]) => ({
        entity,
        accounts,
        total: accounts.reduce((s, a) => s + a.balance, 0),
      }));
    }
    return result;
  }, [grouped]);

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const calcBalance = summary?.balance ?? balances.reduce((s, a) => s + a.balance, 0);
  const calcIncome = summary?.totalIncome ?? 0;
  const calcExpense = summary?.totalExpense ?? 0;
  const calcOps = summary?.operationsCount ?? 0;

  const expenseDonut = useMemo(() => {
    if (categories.length > 0) return categories.map((c, i) => ({ name: c.name, value: c.total, color: EXPENSE_CAT_COLORS[i % EXPENSE_CAT_COLORS.length] }));
    return [{ name: "Расходы", value: Math.abs(calcExpense) || 1, color: "#ef4444" }];
  }, [categories, calcExpense]);

  const incomeDonut = useMemo(() => [{ name: "Поступления", value: calcIncome || 1, color: "#22c55e" }], [calcIncome]);

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
                  const groups = entityGroups[sec.type] || [];
                  if (groups.length === 0) return null;
                  const totalAccounts = groups.reduce((s, g) => s + g.accounts.length, 0);
                  // If only one entity group or few accounts total, show flat
                  const useCollapsible = groups.length > 1 || totalAccounts > 3;
                  return (
                    <div className="dash-account-section" key={sec.type}>
                      <div className="dash-account-section__header">
                        <div className="dash-account-section__left">
                          <div className={`dash-account-section__icon ${sec.iconClass}`}>{sec.icon}</div>
                          <span className="dash-account-section__title">{sec.title}</span>
                        </div>
                        <span className="dash-account-section__total">{formatMoney(sumByType[sec.type] || 0)} ₽</span>
                      </div>
                      {useCollapsible ? (
                        <div className="dash-accounts-list">
                          {groups.map((g) => {
                            const groupKey = `${sec.type}-${g.entity}`;
                            const isOpen = expandedGroups.has(groupKey);
                            return (
                              <div className="dash-entity-group" key={g.entity}>
                                <button type="button" className="dash-entity-group__header" onClick={() => toggleGroup(groupKey)}>
                                  <div className="dash-entity-group__left">
                                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    <span className="dash-entity-group__name">{g.entity}</span>
                                    <span className="dash-entity-group__count">{g.accounts.length}</span>
                                  </div>
                                  <span className={`dash-entity-group__total${g.total > 0 ? " has-money" : ""}`}>{formatMoney(g.total)} ₽</span>
                                </button>
                                {isOpen && (
                                  <div className="dash-entity-group__items">
                                    {g.accounts.map((acc) => (
                                      <div className="dash-account-row" key={acc.id}>
                                        <div className="dash-account-row__icon">{sec.type === "card" ? <CreditCard size={18} /> : <Wallet size={18} />}</div>
                                        <div className="dash-account-row__info">
                                          <span className="dash-account-row__name">{acc.name}</span>
                                        </div>
                                        <div className={`dash-account-row__balance${acc.balance > 0 ? " has-money" : ""}`}>
                                          {formatMoney(acc.balance)} <span className="currency">₽</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="dash-accounts-list">
                          {groups.flatMap((g) => g.accounts).map((acc) => (
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
                      )}
                    </div>
                  );
                })}
                {balances.length === 0 && <div className="dash-empty-placeholder"><span>{t("settings.noAccounts")}</span></div>}
              </div>

              {/* RIGHT column: two donut cards */}
              <div className="dash-middle-right">
                <div className="dash-donut-pair">
                  <div className="glass-card dash-donut-card">
                    <div className="dash-donut-card__chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={expenseDonut} dataKey="value" cx="50%" cy="50%" innerRadius="58%" outerRadius="90%" paddingAngle={expenseDonut.length > 1 ? 1.5 : 0} stroke="none">
                            {expenseDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="dash-donut-card__center">
                        <div className="dash-donut-card__value dash-donut-card__value--expense">{formatMoney(Math.abs(calcExpense))} ₽</div>
                        <div className="dash-donut-card__label">Все списания</div>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card dash-donut-card">
                    <div className="dash-donut-card__chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={incomeDonut} dataKey="value" cx="50%" cy="50%" innerRadius="58%" outerRadius="90%" paddingAngle={0} stroke="none">
                            {incomeDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="dash-donut-card__center">
                        <div className="dash-donut-card__value dash-donut-card__value--income">{formatMoney(calcIncome)} ₽</div>
                        <div className="dash-donut-card__label">Все поступления</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="glass-card dash-balance-row">
                  <div className="dash-balance-row__item">
                    <span className="dash-balance-row__label">{t("dashboard.balance")}</span>
                    <span className="dash-balance-row__value">{formatMoney(calcBalance)} ₽</span>
                  </div>
                  <div className="dash-balance-row__divider" />
                  <div className="dash-balance-row__item">
                    <span className="dash-balance-row__label">{t("dashboard.operations")}</span>
                    <span className="dash-balance-row__value">{calcOps}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline chart (collapsible) */}
            <div className="glass-card dash-chart-card">
              <button type="button" className="dash-chart-card__toggle" onClick={() => setChartOpen(!chartOpen)}>
                <h3 className="chart-title">График</h3>
                <div className="dash-chart-card__toggle-right">
                  {chartOpen && (
                    <div className="chart-filter-tabs" onClick={(e) => e.stopPropagation()}>
                      {([["all", "Все"], ["expense", "Списания"], ["income", "Поступления"]] as const).map(([key, label]) => (
                        <button key={key} type="button" className={`chart-filter-tab${chartFilter === key ? " chart-filter-tab--active" : ""}`} onClick={() => setChartFilter(key as typeof chartFilter)}>{label}</button>
                      ))}
                    </div>
                  )}
                  <ChevronDown size={18} className={`dash-chart-chevron${chartOpen ? " dash-chart-chevron--open" : ""}`} />
                </div>
              </button>
              {chartOpen && (
                <div className="dash-chart-area">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={timeline}>
                      <defs>
                        <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
                      <XAxis dataKey="date" tickFormatter={(v: string) => { const d = new Date(v); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`; }} tick={{ fontSize: 11, fill: theme === "dark" ? "#9ca3af" : "#888" }} />
                      <YAxis tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} tick={{ fontSize: 11, fill: theme === "dark" ? "#9ca3af" : "#888" }} width={55} />
                      <Tooltip formatter={(v: number) => [formatMoney(v) + " ₽"]} labelFormatter={(l: string) => new Date(l).toLocaleDateString("ru-RU")} contentStyle={{ background: theme === "dark" ? "#1f2937" : "#fff", border: "none", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                      {(chartFilter === "all" || chartFilter === "income") && <Area type="monotone" dataKey="income" stroke="#22c55e" fill="url(#gradIncome)" strokeWidth={2} name="Поступления" />}
                      {(chartFilter === "all" || chartFilter === "expense") && <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#gradExpense)" strokeWidth={2} name="Списания" />}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Operations tabs */}
            <div className="glass-card dash-recent">
              <div className="dash-recent__header">
                <h3 className="chart-title">{t("dashboard.operations")}</h3>
                <button
                  type="button"
                  className="dash-reconcile-btn"
                  disabled={matching}
                  onClick={async () => {
                    setMatching(true);
                    setMatchResult(null);
                    try {
                      const r = await reconciliationApi.autoMatch();
                      setMatchResult(r.matched);
                      if (r.matched > 0) {
                        const [sum, rec] = await Promise.all([
                          analyticsApi.summary({ from: dateFrom, to: dateTo, entityId: myEntityId }),
                          analyticsApi.recent(10, myEntityId),
                        ]);
                        setSummary(sum);
                        setRecent(rec);
                      }
                    } catch { /* ignore */ }
                    setMatching(false);
                  }}
                  title="Автосверка ДДС с выписками"
                >
                  <Link2 size={14} />
                  {matching ? "..." : matchResult !== null ? `Сверено: ${matchResult}` : "Сверить"}
                </button>
              </div>
              <div className="chart-filter-tabs" style={{ marginBottom: 12 }}>
                {(["all", "dds", "statements", "accounts"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`chart-filter-tab${opsTab === tab ? " chart-filter-tab--active" : ""}`}
                    onClick={() => setOpsTab(tab)}
                  >
                    {tab === "all" ? "Все" : tab === "dds" ? "ДДС" : tab === "statements" ? "Выписки" : "Счета"}
                  </button>
                ))}
              </div>

              {opsLoading ? (
                <div className="dash-empty-placeholder"><span>Загрузка...</span></div>
              ) : opsTab === "all" ? (
                <div className="recent-list">
                  {recent.map((op) => (
                    <div key={`${op.source}-${op.id}`} className="recent-item" onClick={() => op.source === "dds" ? navigate("/dds") : navigate("/statements")}>
                      <div className="recent-item__left">
                        {opIcon(op.type)}
                        <div>
                          <div className="recent-item__desc">{op.description}</div>
                          <div className="recent-item__meta">
                            <span className={`op-source-badge op-source-badge--${op.source}`}>{op.source === "dds" ? "ДДС" : "Выписка"}</span>
                            {op.account && <span>{op.account}</span>}
                            {op.entity && <span> · {op.entity}</span>}
                            {op.linked && <span className="recent-item__linked" title="Сверено"><Link2 size={12} /></span>}
                          </div>
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
              ) : opsTab === "dds" ? (
                <div className="recent-list">
                  {ddsOps.map((op) => (
                    <div key={op.id} className="recent-item" onClick={() => navigate("/dds")}>
                      <div className="recent-item__left">
                        {opIcon(op.operationType)}
                        <div>
                          <div className="recent-item__desc">
                            {op.operationType === "expense"
                              ? (op.expenseType?.name || op.comment || "Расход")
                              : op.operationType === "income"
                                ? (op.incomeType?.name || op.comment || "Приход")
                                : (op.comment || "Перевод")}
                          </div>
                          <div className="recent-item__meta">
                            <span className="op-badge op-badge--dds-type">{op.operationType === "income" ? "Приход" : op.operationType === "expense" ? "Расход" : "Перевод"}</span>
                            {op.entity && <span>{op.entity.name}</span>}
                            {op.user && <span> · {firstName(op.user.name)}</span>}
                            {op.expenseArticle && <span> · {op.expenseArticle.name}</span>}
                            {(op.direction?.name || op.incomeDirection) && <span> · {op.direction?.name || op.incomeDirection}</span>}
                            {op.linkedBankTxId && <span className="recent-item__linked" title="Сверено"><Link2 size={12} /></span>}
                          </div>
                          {op.comment && op.expenseType?.name && <div className="recent-item__comment">{op.comment}</div>}
                        </div>
                      </div>
                      <div className="recent-item__right">
                        <div className={`recent-item__amount ${op.operationType === "income" ? "amount--income" : op.operationType === "expense" ? "amount--expense" : "amount--transfer"}`}>
                          {op.operationType === "income" ? "+" : op.operationType === "expense" ? "-" : ""}{formatMoney(parseFloat(op.amount))} ₽
                        </div>
                        <div className="recent-item__date">{fmtShortDate(op.createdAt)}</div>
                        {op.fromAccount && <div className="recent-item__account-info">{op.fromAccount.name}</div>}
                        {op.toAccount && <div className="recent-item__account-info">{op.operationType === "transfer" ? "→ " : ""}{op.toAccount.name}</div>}
                      </div>
                    </div>
                  ))}
                  {ddsOps.length === 0 && <div className="dash-empty-placeholder"><span>{t("dds.noOperations")}</span></div>}
                </div>
              ) : opsTab === "statements" ? (
                <div className="recent-list">
                  {bankTxs.map((tx) => (
                    <div key={tx.id} className="recent-item" onClick={() => navigate("/statements")}>
                      <div className="recent-item__left">
                        {opIcon(tx.direction)}
                        <div>
                          <div className="recent-item__desc">{tx.counterparty || tx.purpose || tx.direction}</div>
                          <div className="recent-item__meta">
                            <span>{tx.account.name}</span>
                            {tx.account.bank && <span> · {tx.account.bank}</span>}
                            {tx.time && <span> · {tx.time}</span>}
                          </div>
                          {tx.purpose && tx.counterparty && <div className="recent-item__comment">{tx.purpose}</div>}
                        </div>
                      </div>
                      <div className="recent-item__right">
                        <div className={`recent-item__amount ${tx.direction === "income" ? "amount--income" : "amount--expense"}`}>
                          {tx.direction === "income" ? "+" : "-"}{formatMoney(parseFloat(tx.amount))} ₽
                        </div>
                        <div className="recent-item__date">{fmtShortDate(tx.date)}</div>
                        {tx.balance && <div className="recent-item__balance">Остаток: {formatMoney(parseFloat(tx.balance))} ₽</div>}
                      </div>
                    </div>
                  ))}
                  {bankTxs.length === 0 && <div className="dash-empty-placeholder"><span>{t("dds.noOperations")}</span></div>}
                </div>
              ) : (
                <div className="recent-list">
                  {balances.map((acc) => (
                    <div key={acc.id} className="recent-item">
                      <div className="recent-item__left">
                        <div className="recent-icon recent-icon--account">
                          {acc.type === "card" ? <CreditCard size={16} /> : acc.type === "cash" ? <Banknote size={16} /> : acc.type === "deposit" ? <PiggyBank size={16} /> : <Wallet size={16} />}
                        </div>
                        <div>
                          <div className="recent-item__desc">{acc.name}</div>
                          <div className="recent-item__meta">
                            <span>{typeLabel(acc.type)}</span>
                            {acc.bank && <span> · {acc.bank}</span>}
                            <span> · {acc.entityName}</span>
                          </div>
                        </div>
                      </div>
                      <div className="recent-item__right">
                        <div className={`recent-item__amount ${acc.balance > 0 ? "amount--income" : acc.balance < 0 ? "amount--expense" : ""}`}>
                          {formatMoney(acc.balance)} ₽
                        </div>
                      </div>
                    </div>
                  ))}
                  {balances.length === 0 && <div className="dash-empty-placeholder"><span>{t("settings.noAccounts")}</span></div>}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
