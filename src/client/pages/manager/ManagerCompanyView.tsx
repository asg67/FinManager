import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Loader } from "lucide-react";
import { useAuthStore } from "../../stores/auth.js";
import { useThemeStore } from "../../stores/theme.js";
import { managerApi, type ManagerCompanyDetail, type ManagerOperation, type ManagerCompanyUser, type CategoryStat, type MonthStat } from "../../api/manager.js";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { LogOut, Moon, Sun } from "lucide-react";

type Tab = "operations" | "stats" | "users";

// Colors for pie chart
const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899", "#10b981", "#3b82f6"];

function formatMoney(n: number): string {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0 }).format(n);
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  if (diffDays < 7) return `${diffDays} дн. назад`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "2-digit" });
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

// ===== Operations Tab =====

function OperationsTab({ companyId, entities }: { companyId: string; entities: { id: string; name: string }[] }) {
  const [data, setData] = useState<ManagerOperation[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [entityId, setEntityId] = useState("");
  const [operationType, setOperationType] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const limit = 50;

  const load = useCallback(() => {
    setLoading(true);
    managerApi.getOperations(companyId, { entityId: entityId || undefined, operationType: operationType || undefined, search: search || undefined, page, limit })
      .then((r) => { setData(r.data); setTotal(r.total); setPages(r.pages); })
      .finally(() => setLoading(false));
  }, [companyId, entityId, operationType, search, page]);

  useEffect(() => { setPage(1); }, [entityId, operationType, search]);
  useEffect(() => { load(); }, [load]);

  const typeLabels: Record<string, string> = { income: "Приход", expense: "Расход", transfer: "Перевод" };

  async function handleExport() {
    setExporting(true);
    try {
      await managerApi.exportExcel(companyId, "export", { entityId: entityId || undefined });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div className="manager-filters">
          <select className="manager-filter-select" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
            <option value="">Все юр. лица</option>
            {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select className="manager-filter-select" value={operationType} onChange={(e) => setOperationType(e.target.value)}>
            <option value="">Все типы</option>
            <option value="income">Приход</option>
            <option value="expense">Расход</option>
            <option value="transfer">Перевод</option>
          </select>
          <input
            className="manager-filter-input"
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="manager-export-btn" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader size={14} className="spin" /> : <Download size={14} />}
          Excel
        </button>
      </div>

      {loading ? (
        <div className="manager-loading">Загрузка...</div>
      ) : data.length === 0 ? (
        <div className="manager-empty-state">Операции не найдены</div>
      ) : (
        <>
          <div className="manager-ops-table-wrap">
            <table className="manager-ops-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Тип</th>
                  <th>Юрлицо</th>
                  <th>Сумма</th>
                  <th>Категория</th>
                  <th>Статья</th>
                  <th>Пользователь</th>
                  <th>Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {data.map((op) => (
                  <tr key={op.id}>
                    <td style={{ whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                      {new Date(op.createdAt).toLocaleDateString("ru-RU")}
                    </td>
                    <td>
                      <span className={`manager-type-badge manager-type-badge--${op.operationType}`}>
                        {typeLabels[op.operationType] ?? op.operationType}
                      </span>
                    </td>
                    <td>{op.entity.name}</td>
                    <td className={`manager-ops-table__amount--${op.operationType}`}>
                      {op.operationType === "expense" ? "−" : op.operationType === "income" ? "+" : ""}
                      {formatMoney(op.amount)} ₽
                    </td>
                    <td>{op.expenseType?.name ?? op.incomeType?.name ?? "—"}</td>
                    <td>
                      {op.expenseArticle?.name ?? op.incomeArticle?.name ?? "—"}
                      {op.direction ? ` / ${op.direction.name}` : ""}
                    </td>
                    <td>{op.user?.name ?? "—"}</td>
                    <td style={{ color: "var(--text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {op.comment ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="manager-pagination">
            <span>Всего: {total}</span>
            <div className="manager-pagination__btns">
              <button className="manager-pagination__btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Назад</button>
              <span style={{ padding: "0.375rem 0.5rem", fontSize: "0.8125rem" }}>{page} / {pages}</span>
              <button className="manager-pagination__btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>Вперёд →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ===== Stats Tab =====

function StatsTab({ companyId, stats, entities }: {
  companyId: string;
  stats: ManagerCompanyDetail["stats"];
  entities: { id: string; name: string }[];
}) {
  const [entityId, setEntityId] = useState("");
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [monthStats, setMonthStats] = useState<MonthStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      managerApi.getStatsByCategory(companyId, { entityId: entityId || undefined }),
      managerApi.getStatsByMonth(companyId, { entityId: entityId || undefined }),
    ]).then(([cats, months]) => {
      setCategories(cats);
      setMonthStats(months);
    }).finally(() => setLoading(false));
  }, [companyId, entityId]);

  const totalExpenseForPct = categories.reduce((s, c) => s + c.total, 0);

  return (
    <div>
      {entities.length > 1 && (
        <div className="manager-entity-tabs" style={{ marginBottom: "1.5rem" }}>
          <button
            className={`manager-entity-tab ${entityId === "" ? "manager-entity-tab--active" : ""}`}
            onClick={() => setEntityId("")}
          >
            Все
          </button>
          {entities.map((e) => (
            <button
              key={e.id}
              className={`manager-entity-tab ${entityId === e.id ? "manager-entity-tab--active" : ""}`}
              onClick={() => setEntityId(e.id)}
            >
              {e.name}
            </button>
          ))}
        </div>
      )}

      <div className="manager-kpi-row">
        <div className="manager-kpi-card">
          <span className="manager-kpi-card__label">Приход</span>
          <span className="manager-kpi-card__value manager-kpi-card__value--income">
            {formatMoney(stats.totalIncome)} ₽
          </span>
        </div>
        <div className="manager-kpi-card">
          <span className="manager-kpi-card__label">Расход</span>
          <span className="manager-kpi-card__value manager-kpi-card__value--expense">
            {formatMoney(stats.totalExpense)} ₽
          </span>
        </div>
        <div className="manager-kpi-card">
          <span className="manager-kpi-card__label">Баланс</span>
          <span className={`manager-kpi-card__value ${stats.balance >= 0 ? "manager-kpi-card__value--income" : "manager-kpi-card__value--expense"}`}>
            {stats.balance >= 0 ? "+" : ""}{formatMoney(stats.balance)} ₽
          </span>
          <span className="manager-kpi-card__count">{stats.operationsCount} операций</span>
        </div>
      </div>

      {loading ? (
        <div className="manager-loading">Загрузка графиков...</div>
      ) : (
        <div className="manager-charts">
          {/* Bar chart: income vs expense by month */}
          <div className="manager-chart-card">
            <div className="manager-chart-card__title">Приход / Расход по месяцам</div>
            {monthStats.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "0.8125rem", padding: "1rem 0" }}>Нет данных</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthStats.map((m) => ({ ...m, month: formatMonthLabel(m.month) }))} barSize={14} barGap={2}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(val: number) => [`${formatMoney(val)} ₽`]}
                    contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--glass-border)", borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: "var(--text-primary)" }}
                  />
                  <Bar dataKey="income" name="Приход" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Расход" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie chart: expense by category */}
          <div className="manager-chart-card">
            <div className="manager-chart-card__title">Расходы по категориям</div>
            {categories.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "0.8125rem", padding: "1rem 0" }}>Нет данных</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ""}
                    labelLine={false}
                  >
                    {categories.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [`${formatMoney(val)} ₽`]}
                    contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--glass-border)", borderRadius: 10, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Category list with progress bars */}
      {categories.length > 0 && (
        <div className="manager-chart-card">
          <div className="manager-chart-card__title">Детализация расходов</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
            {categories.slice(0, 10).map((cat, i) => {
              const pct = totalExpenseForPct > 0 ? (cat.total / totalExpenseForPct) * 100 : 0;
              return (
                <div key={cat.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem", fontSize: "0.8125rem" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], display: "inline-block" }} />
                      {cat.name}
                    </span>
                    <span style={{ fontWeight: 600 }}>{formatMoney(cat.total)} ₽</span>
                  </div>
                  <div style={{ height: 6, background: "var(--bg-hover)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 3, transition: "width 0.4s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Users Tab =====

function UsersTab({ companyId }: { companyId: string }) {
  const [users, setUsers] = useState<ManagerCompanyUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    managerApi.getUsers(companyId).then(setUsers).finally(() => setLoading(false));
  }, [companyId]);

  const roleLabels: Record<string, string> = { owner: "Админ", member: "Участник" };

  const actionTypeLabel: Record<string, string> = { dds: "ДДС", pdf: "PDF", login: "Вход" };
  const actionTypeClass: Record<string, string> = { dds: "dds", pdf: "pdf", login: "login" };

  return (
    <div>
      {loading ? (
        <div className="manager-loading">Загрузка...</div>
      ) : users.length === 0 ? (
        <div className="manager-empty-state">Пользователи не найдены</div>
      ) : (
        <div className="manager-ops-table-wrap">
          <table className="manager-users-table">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Роль</th>
                <th>Последняя активность</th>
                <th>Тип</th>
                <th>Дата регистрации</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="manager-users-table__name">{u.name}</div>
                    <div className="manager-users-table__email">{u.email}</div>
                  </td>
                  <td>
                    <span className={`manager-role-badge manager-role-badge--${u.role}`}>
                      {roleLabels[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className={`manager-last-action--${u.lastAction?.type ?? ""}`}>
                    {u.lastAction ? formatRelativeDate(u.lastAction.date) : "—"}
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                    {u.lastAction ? actionTypeLabel[u.lastAction.type] ?? u.lastAction.type : "—"}
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                    {new Date(u.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===== Main View =====

export default function ManagerCompanyView() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggleTheme } = useThemeStore();

  const [tab, setTab] = useState<Tab>("stats");
  const [detail, setDetail] = useState<ManagerCompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    managerApi.getCompany(companyId)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [companyId]);

  async function handleExportAll() {
    if (!companyId || !detail) return;
    setExporting(true);
    try {
      await managerApi.exportExcel(companyId, detail.name);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="manager-layout">
        <header className="manager-header">
          <div className="manager-header__left">
            <span className="manager-header__logo">FinManager</span>
          </div>
        </header>
        <div className="manager-loading">Загрузка...</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="manager-layout">
        <div className="manager-content">
          <p style={{ color: "var(--text-muted)" }}>Компания не найдена или нет доступа.</p>
          <button className="manager-header__back" onClick={() => navigate("/manager")}>← Назад</button>
        </div>
      </div>
    );
  }

  return (
    <div className="manager-layout">
      <header className="manager-header">
        <div className="manager-header__left">
          <button className="manager-header__back" onClick={() => navigate("/manager")}>
            <ArrowLeft size={14} /> Компании
          </button>
          <span style={{ color: "var(--glass-border)" }}>|</span>
          <span className="manager-header__company">{detail.name}</span>
        </div>
        <div className="manager-header__right">
          <span className="manager-header__name">{user?.name}</span>
          <button className="manager-header__btn" onClick={toggleTheme} title="Сменить тему">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="manager-header__btn" onClick={logout}>
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      </header>

      <main className="manager-content">
        <div className="manager-company-view__header">
          <h1 className="manager-company-view__title">{detail.name}</h1>
          <div className="manager-company-view__actions">
            <button className="manager-export-btn" onClick={handleExportAll} disabled={exporting}>
              {exporting ? <Loader size={14} /> : <Download size={14} />}
              Экспорт Excel
            </button>
          </div>
        </div>

        <div className="manager-tabs">
          {(["stats", "operations", "users"] as Tab[]).map((t) => (
            <button
              key={t}
              className={`manager-tab ${tab === t ? "manager-tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "stats" ? "Статистика" : t === "operations" ? "ДДС операции" : "Пользователи"}
            </button>
          ))}
        </div>

        {tab === "stats" && (
          <StatsTab companyId={companyId!} stats={detail.stats} entities={detail.entities} />
        )}
        {tab === "operations" && (
          <OperationsTab companyId={companyId!} entities={detail.entities} />
        )}
        {tab === "users" && (
          <UsersTab companyId={companyId!} />
        )}
      </main>
    </div>
  );
}
