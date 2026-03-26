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
} from "recharts";
import { analyticsApi, type SummaryData, type AccountBalance, type RecentOperation } from "../api/analytics.js";
import { entitiesApi } from "../api/entities.js";
import { reconciliationApi } from "../api/reconciliation.js";
import { useAuthStore } from "../stores/auth.js";
import { useThemeStore } from "../stores/theme.js";

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

  const catColors = theme === "light" ? CATEGORY_COLORS : CATEGORY_COLORS_DARK;

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
    ]).then(([sum, bal, rec]) => {
      setSummary(sum);
      setBalances(bal);
      setRecent(rec);
      setLoading(false);
    });
  }, [dateFrom, dateTo, myEntityId]);

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

  const donutData = useMemo(
    () => Object.entries(sumByType).filter(([, v]) => v > 0).map(([type, value]) => ({ name: typeLabel(type), value, color: catColors[type] || "#ccc" })),
    [sumByType, catColors],
  );
  const hasDonutData = donutData.length > 0;
  const donutDisplay = hasDonutData ? donutData : [{ name: "—", value: 1, color: theme === "light" ? "#E0E0E0" : "#374151" }];

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

              {/* RIGHT column */}
              <div className="dash-middle-right">
                {/* Donut + Metrics */}
                <div className="glass-card dash-donut-metrics">
                  <div className="dash-donut-left">
                    <div className="dash-donut-chart-wrap">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={donutDisplay} dataKey="value" cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" paddingAngle={hasDonutData ? 3 : 0} stroke="none">
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

              </div>
            </div>

            {/* Recent Operations */}
            <div className="glass-card dash-recent">
              <div className="dash-recent__header">
                <h3 className="chart-title">{t("dashboard.recentOperations")}</h3>
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
              <div className="recent-list">
                {recent.map((op) => (
                  <div key={`${op.source}-${op.id}`} className="recent-item" onClick={() => op.source === "dds" && navigate("/dds")}>
                    <div className="recent-item__left">
                      {opIcon(op.type)}
                      <div>
                        <div className="recent-item__desc">{op.description}</div>
                        <div className="recent-item__meta">{op.account && <span>{op.account}</span>}{op.entity && <span> · {op.entity}</span>}{op.linked && <span className="recent-item__linked" title="Сверено"><Link2 size={12} /></span>}</div>
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
