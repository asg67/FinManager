import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import {
  Building2, Users, Bell, Plus, ChevronLeft, ChevronRight,
  ArrowLeft, Send, CreditCard, FileText, LogOut, Trash2,
  Pencil, Check, X, FolderOpen, Tag, Link, Copy,
} from "lucide-react";
import { useAuthStore } from "../stores/auth.js";
import { companyApi } from "../api/company.js";
import {
  adminApi,
  type AdminUser,
  type AdminCompanyListItem,
  type AdminCompanyDetail,
  type AdminOperation,
  type AdminEntityDetail,
  type AdminExpenseType,
  type AdminIncomeType,
  type AdminCustomField,
} from "../api/admin.js";
import { authApi } from "../api/auth.js";
import { notificationsApi } from "../api/notifications.js";
import { Button, Input, Modal } from "../components/ui/index.js";
import { ApiError } from "../api/client.js";

type View =
  | { kind: "dashboard" }
  | { kind: "companies" }
  | { kind: "company-detail"; companyId: string }
  | { kind: "entity-detail"; companyId: string; entityId: string }
  | { kind: "users" }
  | { kind: "notifications" };

export default function Admin() {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== "owner") return <Navigate to="/" replace />;

  const [view, setView] = useState<View>({ kind: "dashboard" });
  const [createOpen, setCreateOpen] = useState(false);

  async function handleCompanyCreated() {
    setCreateOpen(false);
    const me = await authApi.getMe();
    useAuthStore.setState({ user: me });
    setView({ kind: "companies" });
  }

  const logout = useAuthStore((s) => s.logout);

  function goBack() {
    if (view.kind === "company-detail") setView({ kind: "companies" });
    else if (view.kind === "entity-detail") setView({ kind: "company-detail", companyId: view.companyId });
    else setView({ kind: "dashboard" });
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1 className="page-title">Панель управления</h1>
        <button className="btn btn--secondary btn--sm" onClick={logout}>
          <LogOut size={16} /> Выйти
        </button>
      </div>

      {view.kind === "dashboard" && (
        <DashboardView
          onNavigate={setView}
          onCreateCompany={() => setCreateOpen(true)}
        />
      )}
      {view.kind === "companies" && (
        <CompaniesView onBack={goBack} onSelect={(id) => setView({ kind: "company-detail", companyId: id })} />
      )}
      {view.kind === "company-detail" && (
        <CompanyDetailView
          companyId={view.companyId}
          onBack={goBack}
          onSelectEntity={(eid) => setView({ kind: "entity-detail", companyId: view.companyId, entityId: eid })}
        />
      )}
      {view.kind === "entity-detail" && (
        <EntityDetailView companyId={view.companyId} entityId={view.entityId} onBack={goBack} />
      )}
      {view.kind === "users" && <UsersView onBack={goBack} />}
      {view.kind === "notifications" && <NotificationsView onBack={goBack} />}

      <CreateCompanyModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCompanyCreated} />
    </div>
  );
}

/* ==================== Dashboard ==================== */

function DashboardView({
  onNavigate,
  onCreateCompany,
}: {
  onNavigate: (v: View) => void;
  onCreateCompany: () => void;
}) {
  const [companiesCount, setCompaniesCount] = useState(0);
  const [usersCount, setUsersCount] = useState(0);

  useEffect(() => {
    adminApi.getStats().then((s) => {
      setCompaniesCount(s.companiesCount);
      setUsersCount(s.usersCount);
    });
  }, []);

  const cards = [
    {
      icon: <Building2 size={20} />,
      title: "Компании",
      count: `${companiesCount} шт.`,
      onClick: () => onNavigate({ kind: "companies" }),
    },
    {
      icon: <Users size={20} />,
      title: "Пользователи",
      count: `${usersCount} чел.`,
      onClick: () => onNavigate({ kind: "users" }),
    },
    {
      icon: <Bell size={20} />,
      title: "Уведомления",
      count: "Рассылка",
      onClick: () => onNavigate({ kind: "notifications" }),
    },
    {
      icon: <Plus size={20} />,
      title: "Создать компанию",
      count: "",
      onClick: onCreateCompany,
    },
  ];

  return (
    <div className="admin-dashboard">
      {cards.map((c) => (
        <div key={c.title} className="admin-card" onClick={c.onClick}>
          <div className="admin-card__icon">{c.icon}</div>
          <div className="admin-card__title">{c.title}</div>
          {c.count && <div className="admin-card__count">{c.count}</div>}
        </div>
      ))}
    </div>
  );
}

/* ==================== Companies List ==================== */

function CompaniesView({
  onBack,
  onSelect,
}: {
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  const [companies, setCompanies] = useState<AdminCompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.listCompanies().then((d) => { setCompanies(d); setLoading(false); });
  }, []);

  return (
    <div>
      <button className="admin-back" onClick={onBack}>
        <ArrowLeft size={16} /> Назад
      </button>
      <h2 className="admin-subtitle">Компании</h2>

      {loading ? (
        <div className="tab-loading">Загрузка...</div>
      ) : (
        <div className="admin-list">
          {companies.map((c) => (
            <div key={c.id} className="admin-list-item" onClick={() => onSelect(c.id)}>
              <div className="admin-list-item__main">
                <div className="admin-list-item__name">{c.name}</div>
                <div className="admin-list-item__meta">
                  <span><Users size={13} /> {c.usersCount}</span>
                  <span><Building2 size={13} /> {c.entitiesCount} юр.лиц</span>
                </div>
              </div>
              <ChevronRight size={18} className="admin-list-item__arrow" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================== Company Detail ==================== */

function CompanyDetailView({
  companyId,
  onBack,
  onSelectEntity,
}: {
  companyId: string;
  onBack: () => void;
  onSelectEntity: (entityId: string) => void;
}) {
  const [company, setCompany] = useState<AdminCompanyDetail | null>(null);
  const [operations, setOperations] = useState<AdminOperation[]>([]);
  const [opsPage, setOpsPage] = useState(1);
  const [opsTotalPages, setOpsTotalPages] = useState(1);
  const [opsTotal, setOpsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Entity CRUD state
  const [newEntityName, setNewEntityName] = useState("");
  const [addingEntity, setAddingEntity] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [editEntityName, setEditEntityName] = useState("");

  // Expense types/articles state (company-wide)
  const [expenseTypes, setExpenseTypes] = useState<AdminExpenseType[]>([]);
  const [expLoading, setExpLoading] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [addingArticleForType, setAddingArticleForType] = useState<string | null>(null);
  const [newArticleName, setNewArticleName] = useState("");
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editArticleName, setEditArticleName] = useState("");

  // Income types/articles state (company-wide)
  const [incomeTypes, setIncomeTypes] = useState<AdminIncomeType[]>([]);
  const [incLoading, setIncLoading] = useState(false);
  const [newIncTypeName, setNewIncTypeName] = useState("");
  const [editingIncTypeId, setEditingIncTypeId] = useState<string | null>(null);
  const [editIncTypeName, setEditIncTypeName] = useState("");
  const [expandedIncType, setExpandedIncType] = useState<string | null>(null);
  const [addingIncArticleForType, setAddingIncArticleForType] = useState<string | null>(null);
  const [newIncArticleName, setNewIncArticleName] = useState("");
  const [editingIncArticleId, setEditingIncArticleId] = useState<string | null>(null);
  const [editIncArticleName, setEditIncArticleName] = useState("");

  // Custom fields state
  const [customFields, setCustomFields] = useState<AdminCustomField[]>([]);
  const [cfLoading, setCfLoading] = useState(false);
  const [showCfForm, setShowCfForm] = useState(false);
  const [cfName, setCfName] = useState("");
  const [cfType, setCfType] = useState("select");
  const [cfOptions, setCfOptions] = useState("");
  const [cfShowWhen, setCfShowWhen] = useState<string>("always");
  const [cfRequired, setCfRequired] = useState(false);

  // Invite state
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const loadCompany = useCallback(async () => {
    const comp = await adminApi.getCompany(companyId);
    setCompany(comp);
  }, [companyId]);

  const loadOps = useCallback(async (page: number) => {
    const res = await adminApi.getCompanyOperations(companyId, { page, limit: 15 });
    setOperations(res.data);
    setOpsPage(res.page);
    setOpsTotalPages(res.totalPages);
    setOpsTotal(res.total);
  }, [companyId]);

  useEffect(() => {
    Promise.all([
      adminApi.getCompany(companyId),
      adminApi.getCompanyOperations(companyId, { page: 1, limit: 15 }),
    ]).then(([comp, ops]) => {
      setCompany(comp);
      setOperations(ops.data);
      setOpsPage(ops.page);
      setOpsTotalPages(ops.totalPages);
      setOpsTotal(ops.total);
      setLoading(false);
    });
  }, [companyId]);

  async function handleDeleteOp(opId: string) {
    if (!confirm("Удалить операцию?")) return;
    setDeleting(opId);
    try {
      await adminApi.deleteOperation(opId);
      await loadOps(opsPage);
    } finally {
      setDeleting(null);
    }
  }

  async function handleAddEntity() {
    if (!newEntityName.trim()) return;
    setAddingEntity(true);
    try {
      await adminApi.createEntity(companyId, newEntityName.trim());
      setNewEntityName("");
      await loadCompany();
    } finally {
      setAddingEntity(false);
    }
  }

  async function handleRenameEntity(entityId: string) {
    if (!editEntityName.trim()) return;
    await adminApi.updateEntity(entityId, editEntityName.trim());
    setEditingEntityId(null);
    await loadCompany();
  }

  async function handleDeleteEntity(entityId: string, entityName: string) {
    if (!confirm(`Удалить "${entityName}"? Все счета, операции и категории будут удалены!`)) return;
    await adminApi.deleteEntity(entityId);
    await loadCompany();
    await loadExpenseTypes();
  }

  // Expense types loading (company-wide, across all entities)
  const loadExpenseTypes = useCallback(async () => {
    setExpLoading(true);
    const types = await adminApi.getCompanyExpenseTypes(companyId);
    setExpenseTypes(types);
    setExpLoading(false);
  }, [companyId]);

  // Load expense types on mount
  useEffect(() => {
    loadExpenseTypes();
  }, [loadExpenseTypes]);

  // Expense type CRUD
  async function handleAddType() {
    if (!newTypeName.trim()) return;
    await adminApi.createCompanyExpenseType(companyId, newTypeName.trim());
    setNewTypeName("");
    await loadExpenseTypes();
  }

  async function handleRenameType(id: string) {
    if (!editTypeName.trim()) return;
    await adminApi.updateExpenseType(id, editTypeName.trim());
    setEditingTypeId(null);
    await loadExpenseTypes();
  }

  async function handleDeleteType(id: string, name: string) {
    if (!confirm(`Удалить категорию "${name}" и все её статьи?`)) return;
    await adminApi.deleteExpenseType(id);
    await loadExpenseTypes();
  }

  // Article CRUD
  async function handleAddArticle(typeId: string) {
    if (!newArticleName.trim()) return;
    await adminApi.createArticle(typeId, newArticleName.trim());
    setNewArticleName("");
    setAddingArticleForType(null);
    await loadExpenseTypes();
  }

  async function handleRenameArticle(id: string) {
    if (!editArticleName.trim()) return;
    await adminApi.updateArticle(id, editArticleName.trim());
    setEditingArticleId(null);
    await loadExpenseTypes();
  }

  async function handleDeleteArticle(id: string, name: string) {
    if (!confirm(`Удалить статью "${name}"?`)) return;
    await adminApi.deleteArticle(id);
    await loadExpenseTypes();
  }

  // Income types loading (company-wide)
  const loadIncomeTypes = useCallback(async () => {
    setIncLoading(true);
    const types = await adminApi.getCompanyIncomeTypes(companyId);
    setIncomeTypes(types);
    setIncLoading(false);
  }, [companyId]);

  useEffect(() => { loadIncomeTypes(); }, [loadIncomeTypes]);

  async function handleAddIncType() {
    if (!newIncTypeName.trim()) return;
    await adminApi.createCompanyIncomeType(companyId, newIncTypeName.trim());
    setNewIncTypeName("");
    await loadIncomeTypes();
  }

  async function handleRenameIncType(id: string) {
    if (!editIncTypeName.trim()) return;
    await adminApi.updateIncomeType(id, editIncTypeName.trim());
    setEditingIncTypeId(null);
    await loadIncomeTypes();
  }

  async function handleDeleteIncType(id: string, name: string) {
    if (!confirm(`Удалить категорию прихода "${name}" и все её статьи?`)) return;
    await adminApi.deleteIncomeType(id);
    await loadIncomeTypes();
  }

  async function handleAddIncArticle(typeId: string) {
    if (!newIncArticleName.trim()) return;
    await adminApi.createIncomeArticle(typeId, newIncArticleName.trim());
    setNewIncArticleName("");
    setAddingIncArticleForType(null);
    await loadIncomeTypes();
  }

  async function handleRenameIncArticle(id: string) {
    if (!editIncArticleName.trim()) return;
    await adminApi.updateIncomeArticle(id, editIncArticleName.trim());
    setEditingIncArticleId(null);
    await loadIncomeTypes();
  }

  async function handleDeleteIncArticle(id: string, name: string) {
    if (!confirm(`Удалить статью прихода "${name}"?`)) return;
    await adminApi.deleteIncomeArticle(id);
    await loadIncomeTypes();
  }

  // Custom fields loading
  const loadCustomFields = useCallback(async () => {
    setCfLoading(true);
    const fields = await adminApi.getCustomFields(companyId);
    setCustomFields(fields);
    setCfLoading(false);
  }, [companyId]);

  useEffect(() => { loadCustomFields(); }, [loadCustomFields]);

  async function handleAddCustomField() {
    if (!cfName.trim()) return;
    const showWhen = cfShowWhen === "always" ? null
      : cfShowWhen === "expense_only" ? { operationType: "expense" }
      : cfShowWhen === "income_only" ? { operationType: "income" }
      : null;

    await adminApi.createCustomField(companyId, {
      name: cfName.trim(),
      fieldType: cfType,
      options: cfType === "select" ? cfOptions.split(",").map(o => o.trim()).filter(Boolean) : undefined,
      showWhen,
      required: cfRequired,
    });
    setCfName(""); setCfOptions(""); setCfType("select"); setCfShowWhen("always"); setCfRequired(false); setShowCfForm(false);
    await loadCustomFields();
  }

  async function handleDeleteCustomField(id: string, name: string) {
    if (!confirm(`Удалить поле "${name}"?`)) return;
    await adminApi.deleteCustomField(id);
    await loadCustomFields();
  }

  async function handleToggleMode() {
    if (!company) return;
    const newMode = company.mode === "full" ? "dds_only" : "full";
    await adminApi.setCompanyMode(companyId, newMode);
    await loadCompany();
  }

  async function handleCopyInvite() {
    setInviteLoading(true);
    try {
      const inv = await adminApi.createInvite(companyId);
      const url = `${window.location.origin}/register?invite=${inv.token}`;
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 3000);
    } catch (err) {
      console.error("Create invite error:", err);
    } finally {
      setInviteLoading(false);
    }
  }

  if (loading || !company) return <div className="tab-loading">Загрузка...</div>;

  return (
    <div>
      <button className="admin-back" onClick={onBack}>
        <ArrowLeft size={16} /> Компании
      </button>
      <h2 className="admin-subtitle">{company.name}</h2>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", margin: 0 }}>
          {company.members.length} пользователей &bull; {company.entities.length} юр.лиц
        </p>
        <button
          className={`btn btn--sm ${company.mode === "dds_only" ? "btn--warning" : "btn--ghost"}`}
          onClick={handleToggleMode}
          title={company.mode === "full" ? "Переключить в режим Только ДДС" : "Переключить в Полный режим"}
        >
          {company.mode === "dds_only" ? "Только ДДС" : "Полный режим"}
        </button>
        <button
          className={`btn btn--sm ${inviteCopied ? "btn--success" : "btn--primary"}`}
          onClick={handleCopyInvite}
          disabled={inviteLoading}
        >
          {inviteCopied ? <><Check size={14} /> Скопировано</> : <><Link size={14} /> Ссылка-приглашение</>}
        </button>
      </div>

      {/* Entities grid */}
      <h3 className="admin-subtitle" style={{ fontSize: "0.875rem" }}>Юридические лица</h3>
      <div className="admin-entities-grid">
        {company.entities.map((e) => (
          <div key={e.id} className="admin-entity-card">
            {editingEntityId === e.id ? (
              <div className="admin-inline-edit">
                <input
                  className="admin-inline-input"
                  value={editEntityName}
                  onChange={(ev) => setEditEntityName(ev.target.value)}
                  onKeyDown={(ev) => { if (ev.key === "Enter") handleRenameEntity(e.id); if (ev.key === "Escape") setEditingEntityId(null); }}
                  autoFocus
                />
                <button className="btn btn--ghost btn--sm" onClick={() => handleRenameEntity(e.id)} title="Сохранить"><Check size={14} /></button>
                <button className="btn btn--ghost btn--sm" onClick={() => setEditingEntityId(null)} title="Отмена"><X size={14} /></button>
              </div>
            ) : (
              <>
                <div className="admin-entity-card__name" onClick={() => onSelectEntity(e.id)} style={{ cursor: "pointer" }}>
                  {e.name}
                </div>
                <div className="admin-entity-card__info" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span onClick={() => onSelectEntity(e.id)} style={{ cursor: "pointer" }}>
                    <CreditCard size={12} /> {e.accountsCount} счетов
                  </span>
                  <span className="admin-entity-actions">
                    <button className="btn btn--ghost btn--sm" onClick={() => { setEditingEntityId(e.id); setEditEntityName(e.name); }} title="Переименовать"><Pencil size={12} /></button>
                    <button className="btn btn--ghost btn--sm" onClick={() => handleDeleteEntity(e.id, e.name)} title="Удалить"><Trash2 size={12} /></button>
                  </span>
                </div>
              </>
            )}
          </div>
        ))}
        {/* Add entity inline */}
        <div className="admin-entity-card admin-entity-card--add">
          <input
            className="admin-inline-input"
            placeholder="Новое ИП / юр.лицо"
            value={newEntityName}
            onChange={(e) => setNewEntityName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddEntity(); }}
          />
          <button
            className="btn btn--primary btn--sm"
            onClick={handleAddEntity}
            disabled={addingEntity || !newEntityName.trim()}
            style={{ marginTop: "0.5rem", width: "100%" }}
          >
            <Plus size={14} /> Добавить
          </button>
        </div>
      </div>

      {/* Expense types / articles (company-wide) */}
      <h3 className="admin-subtitle" style={{ fontSize: "0.875rem" }}>Категории расходов и статьи</h3>

      {company.entities.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginBottom: "1.5rem" }}>
          Сначала добавьте юридическое лицо
        </div>
      ) : expLoading ? (
            <div className="tab-loading" style={{ padding: "1rem 0" }}>Загрузка...</div>
          ) : (
            <div className="admin-expense-list">
              {expenseTypes.map((t) => (
                <div key={t.id} className="admin-expense-type">
                  <div className="admin-expense-type__header">
                    {editingTypeId === t.id ? (
                      <div className="admin-inline-edit">
                        <input
                          className="admin-inline-input"
                          value={editTypeName}
                          onChange={(ev) => setEditTypeName(ev.target.value)}
                          onKeyDown={(ev) => { if (ev.key === "Enter") handleRenameType(t.id); if (ev.key === "Escape") setEditingTypeId(null); }}
                          autoFocus
                        />
                        <button className="btn btn--ghost btn--sm" onClick={() => handleRenameType(t.id)}><Check size={14} /></button>
                        <button className="btn btn--ghost btn--sm" onClick={() => setEditingTypeId(null)}><X size={14} /></button>
                      </div>
                    ) : (
                      <>
                        <div
                          className="admin-expense-type__name"
                          onClick={() => setExpandedType(expandedType === t.id ? null : t.id)}
                          style={{ cursor: "pointer" }}
                        >
                          <FolderOpen size={14} />
                          {t.name}
                          <span className="admin-expense-type__count">({t.articles.length})</span>
                        </div>
                        <span className="admin-entity-actions">
                          <button className="btn btn--ghost btn--sm" onClick={() => { setAddingArticleForType(t.id); setNewArticleName(""); setExpandedType(t.id); }} title="Добавить статью"><Plus size={12} /></button>
                          <button className="btn btn--ghost btn--sm" onClick={() => { setEditingTypeId(t.id); setEditTypeName(t.name); }} title="Переименовать"><Pencil size={12} /></button>
                          <button className="btn btn--ghost btn--sm" onClick={() => handleDeleteType(t.id, t.name)} title="Удалить"><Trash2 size={12} /></button>
                        </span>
                      </>
                    )}
                  </div>

                  {expandedType === t.id && (
                    <div className="admin-expense-articles">
                      {t.articles.map((a) => (
                        <div key={a.id} className="admin-expense-article">
                          {editingArticleId === a.id ? (
                            <div className="admin-inline-edit">
                              <input
                                className="admin-inline-input"
                                value={editArticleName}
                                onChange={(ev) => setEditArticleName(ev.target.value)}
                                onKeyDown={(ev) => { if (ev.key === "Enter") handleRenameArticle(a.id); if (ev.key === "Escape") setEditingArticleId(null); }}
                                autoFocus
                              />
                              <button className="btn btn--ghost btn--sm" onClick={() => handleRenameArticle(a.id)}><Check size={14} /></button>
                              <button className="btn btn--ghost btn--sm" onClick={() => setEditingArticleId(null)}><X size={14} /></button>
                            </div>
                          ) : (
                            <>
                              <span className="admin-expense-article__name"><Tag size={12} /> {a.name}</span>
                              <span className="admin-entity-actions">
                                <button className="btn btn--ghost btn--sm" onClick={() => { setEditingArticleId(a.id); setEditArticleName(a.name); }}><Pencil size={12} /></button>
                                <button className="btn btn--ghost btn--sm" onClick={() => handleDeleteArticle(a.id, a.name)}><Trash2 size={12} /></button>
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                      {t.articles.length === 0 && addingArticleForType !== t.id && (
                        <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", padding: "0.25rem 0 0.25rem 1.5rem" }}>Нет статей</div>
                      )}
                      {addingArticleForType === t.id && (
                        <div className="admin-inline-edit" style={{ paddingLeft: "1.5rem" }}>
                          <input
                            className="admin-inline-input"
                            placeholder="Название статьи"
                            value={newArticleName}
                            onChange={(ev) => setNewArticleName(ev.target.value)}
                            onKeyDown={(ev) => { if (ev.key === "Enter") handleAddArticle(t.id); if (ev.key === "Escape") setAddingArticleForType(null); }}
                            autoFocus
                          />
                          <button className="btn btn--ghost btn--sm" onClick={() => handleAddArticle(t.id)} disabled={!newArticleName.trim()}><Check size={14} /></button>
                          <button className="btn btn--ghost btn--sm" onClick={() => setAddingArticleForType(null)}><X size={14} /></button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {expenseTypes.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginBottom: "0.5rem" }}>Нет категорий</div>
              )}

              {/* Add new expense type */}
              <div className="admin-inline-edit">
                <input
                  className="admin-inline-input"
                  placeholder="Новая категория расходов"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddType(); }}
                />
                <button className="btn btn--primary btn--sm" onClick={handleAddType} disabled={!newTypeName.trim()}>
                  <Plus size={14} /> Добавить
                </button>
              </div>
            </div>
          )}

      {/* Income types section */}
      <h3 className="admin-subtitle" style={{ fontSize: "0.875rem" }}>Категории приходов и статьи</h3>

      {company.entities.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginBottom: "1.5rem" }}>
          Сначала добавьте юридическое лицо
        </div>
      ) : incLoading ? (
            <div className="tab-loading" style={{ padding: "1rem 0" }}>Загрузка...</div>
          ) : (
            <div className="admin-expense-list">
              {incomeTypes.map((t) => (
                <div key={t.id} className="admin-expense-type">
                  <div className="admin-expense-type__header">
                    {editingIncTypeId === t.id ? (
                      <div className="admin-inline-edit">
                        <input
                          className="admin-inline-input"
                          value={editIncTypeName}
                          onChange={(ev) => setEditIncTypeName(ev.target.value)}
                          onKeyDown={(ev) => { if (ev.key === "Enter") handleRenameIncType(t.id); if (ev.key === "Escape") setEditingIncTypeId(null); }}
                          autoFocus
                        />
                        <button className="btn btn--ghost btn--sm" onClick={() => handleRenameIncType(t.id)}><Check size={14} /></button>
                        <button className="btn btn--ghost btn--sm" onClick={() => setEditingIncTypeId(null)}><X size={14} /></button>
                      </div>
                    ) : (
                      <>
                        <div
                          className="admin-expense-type__name"
                          onClick={() => setExpandedIncType(expandedIncType === t.id ? null : t.id)}
                          style={{ cursor: "pointer" }}
                        >
                          <FolderOpen size={14} />
                          {t.name}
                          <span className="admin-expense-type__count">({t.articles.length})</span>
                        </div>
                        <span className="admin-entity-actions">
                          <button className="btn btn--ghost btn--sm" onClick={() => { setAddingIncArticleForType(t.id); setNewIncArticleName(""); setExpandedIncType(t.id); }} title="Добавить статью"><Plus size={12} /></button>
                          <button className="btn btn--ghost btn--sm" onClick={() => { setEditingIncTypeId(t.id); setEditIncTypeName(t.name); }} title="Переименовать"><Pencil size={12} /></button>
                          <button className="btn btn--ghost btn--sm" onClick={() => handleDeleteIncType(t.id, t.name)} title="Удалить"><Trash2 size={12} /></button>
                        </span>
                      </>
                    )}
                  </div>

                  {expandedIncType === t.id && (
                    <div className="admin-expense-articles">
                      {t.articles.map((a) => (
                        <div key={a.id} className="admin-expense-article">
                          {editingIncArticleId === a.id ? (
                            <div className="admin-inline-edit">
                              <input
                                className="admin-inline-input"
                                value={editIncArticleName}
                                onChange={(ev) => setEditIncArticleName(ev.target.value)}
                                onKeyDown={(ev) => { if (ev.key === "Enter") handleRenameIncArticle(a.id); if (ev.key === "Escape") setEditingIncArticleId(null); }}
                                autoFocus
                              />
                              <button className="btn btn--ghost btn--sm" onClick={() => handleRenameIncArticle(a.id)}><Check size={14} /></button>
                              <button className="btn btn--ghost btn--sm" onClick={() => setEditingIncArticleId(null)}><X size={14} /></button>
                            </div>
                          ) : (
                            <>
                              <span className="admin-expense-article__name"><Tag size={12} /> {a.name}</span>
                              <span className="admin-entity-actions">
                                <button className="btn btn--ghost btn--sm" onClick={() => { setEditingIncArticleId(a.id); setEditIncArticleName(a.name); }}><Pencil size={12} /></button>
                                <button className="btn btn--ghost btn--sm" onClick={() => handleDeleteIncArticle(a.id, a.name)}><Trash2 size={12} /></button>
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                      {t.articles.length === 0 && addingIncArticleForType !== t.id && (
                        <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", padding: "0.25rem 0 0.25rem 1.5rem" }}>Нет статей</div>
                      )}
                      {addingIncArticleForType === t.id && (
                        <div className="admin-inline-edit" style={{ paddingLeft: "1.5rem" }}>
                          <input
                            className="admin-inline-input"
                            placeholder="Название статьи"
                            value={newIncArticleName}
                            onChange={(ev) => setNewIncArticleName(ev.target.value)}
                            onKeyDown={(ev) => { if (ev.key === "Enter") handleAddIncArticle(t.id); if (ev.key === "Escape") setAddingIncArticleForType(null); }}
                            autoFocus
                          />
                          <button className="btn btn--ghost btn--sm" onClick={() => handleAddIncArticle(t.id)} disabled={!newIncArticleName.trim()}><Check size={14} /></button>
                          <button className="btn btn--ghost btn--sm" onClick={() => setAddingIncArticleForType(null)}><X size={14} /></button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {incomeTypes.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginBottom: "0.5rem" }}>Нет категорий</div>
              )}

              <div className="admin-inline-edit">
                <input
                  className="admin-inline-input"
                  placeholder="Новая категория приходов"
                  value={newIncTypeName}
                  onChange={(e) => setNewIncTypeName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddIncType(); }}
                />
                <button className="btn btn--primary btn--sm" onClick={handleAddIncType} disabled={!newIncTypeName.trim()}>
                  <Plus size={14} /> Добавить
                </button>
              </div>
            </div>
          )}

      {/* Custom fields section */}
      <h3 className="admin-subtitle" style={{ fontSize: "0.875rem" }}>Кастомные поля ДДС</h3>

      {cfLoading ? (
        <div className="tab-loading" style={{ padding: "1rem 0" }}>Загрузка...</div>
      ) : (
        <div className="admin-expense-list">
          {customFields.map((cf) => (
            <div key={cf.id} className="admin-expense-type">
              <div className="admin-expense-type__header">
                <div className="admin-expense-type__name">
                  <Tag size={14} />
                  {cf.name}
                  <span className="admin-expense-type__count" style={{ fontWeight: "normal" }}>
                    ({cf.fieldType}{cf.required ? ", обяз." : ""})
                  </span>
                  {cf.showWhen && (
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "0.25rem" }}>
                      — {cf.showWhen.operationType === "expense" ? "только расход" : cf.showWhen.operationType === "income" ? "только приход" : "условие"}
                    </span>
                  )}
                </div>
                <span className="admin-entity-actions">
                  <button className="btn btn--ghost btn--sm" onClick={() => handleDeleteCustomField(cf.id, cf.name)} title="Удалить"><Trash2 size={12} /></button>
                </span>
              </div>
              {cf.options && Array.isArray(cf.options) && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", padding: "0.25rem 0 0.25rem 1.5rem" }}>
                  Варианты: {(cf.options as string[]).join(", ")}
                </div>
              )}
            </div>
          ))}

          {customFields.length === 0 && !showCfForm && (
            <div style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginBottom: "0.5rem" }}>Нет кастомных полей</div>
          )}

          {showCfForm ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.5rem 0" }}>
              <input className="admin-inline-input" placeholder="Название поля" value={cfName} onChange={(e) => setCfName(e.target.value)} autoFocus />
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <select className="admin-inline-input" value={cfType} onChange={(e) => setCfType(e.target.value)} style={{ width: "auto" }}>
                  <option value="select">Выбор из списка</option>
                  <option value="text">Текст</option>
                  <option value="number">Число</option>
                </select>
                <select className="admin-inline-input" value={cfShowWhen} onChange={(e) => setCfShowWhen(e.target.value)} style={{ width: "auto" }}>
                  <option value="always">Всегда</option>
                  <option value="expense_only">Только расход</option>
                  <option value="income_only">Только приход</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem" }}>
                  <input type="checkbox" checked={cfRequired} onChange={(e) => setCfRequired(e.target.checked)} /> Обязательное
                </label>
              </div>
              {cfType === "select" && (
                <input className="admin-inline-input" placeholder="Варианты через запятую" value={cfOptions} onChange={(e) => setCfOptions(e.target.value)} />
              )}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn--primary btn--sm" onClick={handleAddCustomField} disabled={!cfName.trim()}>
                  <Check size={14} /> Сохранить
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => setShowCfForm(false)}>
                  <X size={14} /> Отмена
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn--primary btn--sm" onClick={() => setShowCfForm(true)} style={{ marginTop: "0.5rem" }}>
              <Plus size={14} /> Добавить поле
            </button>
          )}
        </div>
      )}

      {/* DDS operations table */}
      <h3 className="admin-subtitle" style={{ fontSize: "0.875rem" }}>
        ДДС операции ({opsTotal})
      </h3>

      {operations.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>Нет операций</div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Пользователь</th>
                  <th>Юр.лицо</th>
                  <th>Тип</th>
                  <th>Сумма</th>
                  <th>Статья</th>
                  <th>Комментарий</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {operations.map((op) => (
                  <tr key={op.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(op.createdAt)}</td>
                    <td>{op.user?.name || "—"}</td>
                    <td>{op.entity?.name || "—"}</td>
                    <td>{opTypeLabel(op.operationType)}</td>
                    <td className={`cell-amount cell-amount--${op.operationType === "income" ? "income" : "expense"}`}>
                      {formatAmount(op.amount)} ₽
                    </td>
                    <td>{op.expenseType?.name || "—"}</td>
                    <td>{op.comment || "—"}</td>
                    <td>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => handleDeleteOp(op.id)}
                        disabled={deleting === op.id}
                        title="Удалить"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {opsTotalPages > 1 && (
            <div className="admin-pagination">
              <button disabled={opsPage <= 1} onClick={() => loadOps(opsPage - 1)}>
                <ChevronLeft size={14} />
              </button>
              <span>{opsPage} / {opsTotalPages}</span>
              <button disabled={opsPage >= opsTotalPages} onClick={() => loadOps(opsPage + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ==================== Entity Detail ==================== */

function EntityDetailView({
  companyId,
  entityId,
  onBack,
}: {
  companyId: string;
  entityId: string;
  onBack: () => void;
}) {
  const [entity, setEntity] = useState<AdminEntityDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Expense types state
  const [expenseTypes, setExpenseTypes] = useState<AdminExpenseType[]>([]);
  const [expLoading, setExpLoading] = useState(true);
  const [newTypeName, setNewTypeName] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [newArticleName, setNewArticleName] = useState("");
  const [addingArticleForType, setAddingArticleForType] = useState<string | null>(null);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editArticleName, setEditArticleName] = useState("");
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const loadExpenseTypes = useCallback(async () => {
    const types = await adminApi.getExpenseTypes(entityId);
    setExpenseTypes(types);
    setExpLoading(false);
  }, [entityId]);

  useEffect(() => {
    adminApi.getEntity(companyId, entityId).then((d) => { setEntity(d); setLoading(false); });
    loadExpenseTypes();
  }, [companyId, entityId, loadExpenseTypes]);

  // Expense type CRUD
  async function handleAddType() {
    if (!newTypeName.trim()) return;
    await adminApi.createExpenseType(entityId, newTypeName.trim());
    setNewTypeName("");
    await loadExpenseTypes();
  }

  async function handleRenameType(id: string) {
    if (!editTypeName.trim()) return;
    await adminApi.updateExpenseType(id, editTypeName.trim());
    setEditingTypeId(null);
    await loadExpenseTypes();
  }

  async function handleDeleteType(id: string, name: string) {
    if (!confirm(`Удалить категорию "${name}" и все статьи?`)) return;
    await adminApi.deleteExpenseType(id);
    await loadExpenseTypes();
  }

  // Article CRUD
  async function handleAddArticle(typeId: string) {
    if (!newArticleName.trim()) return;
    await adminApi.createArticle(typeId, newArticleName.trim());
    setNewArticleName("");
    setAddingArticleForType(null);
    await loadExpenseTypes();
  }

  async function handleRenameArticle(id: string) {
    if (!editArticleName.trim()) return;
    await adminApi.updateArticle(id, editArticleName.trim());
    setEditingArticleId(null);
    await loadExpenseTypes();
  }

  async function handleDeleteArticle(id: string, name: string) {
    if (!confirm(`Удалить статью "${name}"?`)) return;
    await adminApi.deleteArticle(id);
    await loadExpenseTypes();
  }

  async function handleToggleAccount(accountId: string) {
    const result = await adminApi.toggleAccount(accountId);
    setEntity((prev) =>
      prev
        ? { ...prev, accounts: prev.accounts.map((a) => (a.id === accountId ? { ...a, enabled: result.enabled } : a)) }
        : prev,
    );
  }

  if (loading || !entity) return <div className="tab-loading">Загрузка...</div>;

  return (
    <div>
      <button className="admin-back" onClick={onBack}>
        <ArrowLeft size={16} /> Назад к компании
      </button>
      <h2 className="admin-subtitle">{entity.name}</h2>

      {/* Accounts */}
      <h3 className="admin-subtitle" style={{ fontSize: "0.875rem" }}>Счета</h3>
      {entity.accounts.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginBottom: "1.5rem" }}>
          Нет счетов
        </div>
      ) : (
        <div className="admin-account-list">
          {entity.accounts.map((a) => (
            <div key={a.id} className={`admin-account-item${!a.enabled ? " admin-account-item--disabled" : ""}`}>
              <div>
                <div className="admin-account-item__name">{a.name}</div>
                <div className="admin-account-item__info">
                  {a.bank || a.type}
                  {a.accountNumber && ` \u2022 ${a.accountNumber}`}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div className="admin-account-item__info">
                  <FileText size={12} /> {a.transactionCount}
                </div>
                <button
                  type="button"
                  className={`admin-toggle${a.enabled ? " admin-toggle--on" : ""}`}
                  onClick={() => handleToggleAccount(a.id)}
                  title={a.enabled ? "Отключить" : "Включить"}
                >
                  <span className="admin-toggle__knob" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expense Types / Articles */}
      <h3 className="admin-subtitle" style={{ fontSize: "0.875rem" }}>
        Категории расходов
      </h3>

      {expLoading ? (
        <div className="tab-loading">Загрузка...</div>
      ) : (
        <div className="admin-expense-list">
          {expenseTypes.map((t) => (
            <div key={t.id} className="admin-expense-type">
              <div className="admin-expense-type__header">
                {editingTypeId === t.id ? (
                  <div className="admin-inline-edit">
                    <input
                      className="admin-inline-input"
                      value={editTypeName}
                      onChange={(ev) => setEditTypeName(ev.target.value)}
                      onKeyDown={(ev) => { if (ev.key === "Enter") handleRenameType(t.id); if (ev.key === "Escape") setEditingTypeId(null); }}
                      autoFocus
                    />
                    <button className="btn btn--ghost btn--sm" onClick={() => handleRenameType(t.id)}><Check size={14} /></button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setEditingTypeId(null)}><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <div
                      className="admin-expense-type__name"
                      onClick={() => setExpandedType(expandedType === t.id ? null : t.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <FolderOpen size={14} />
                      {t.name}
                      <span className="admin-expense-type__count">({t.articles.length})</span>
                    </div>
                    <span className="admin-entity-actions">
                      <button className="btn btn--ghost btn--sm" onClick={() => { setAddingArticleForType(t.id); setNewArticleName(""); setExpandedType(t.id); }} title="Добавить статью"><Plus size={12} /></button>
                      <button className="btn btn--ghost btn--sm" onClick={() => { setEditingTypeId(t.id); setEditTypeName(t.name); }} title="Переименовать"><Pencil size={12} /></button>
                      <button className="btn btn--ghost btn--sm" onClick={() => handleDeleteType(t.id, t.name)} title="Удалить"><Trash2 size={12} /></button>
                    </span>
                  </>
                )}
              </div>

              {expandedType === t.id && (
                <div className="admin-expense-articles">
                  {t.articles.map((a) => (
                    <div key={a.id} className="admin-expense-article">
                      {editingArticleId === a.id ? (
                        <div className="admin-inline-edit">
                          <input
                            className="admin-inline-input"
                            value={editArticleName}
                            onChange={(ev) => setEditArticleName(ev.target.value)}
                            onKeyDown={(ev) => { if (ev.key === "Enter") handleRenameArticle(a.id); if (ev.key === "Escape") setEditingArticleId(null); }}
                            autoFocus
                          />
                          <button className="btn btn--ghost btn--sm" onClick={() => handleRenameArticle(a.id)}><Check size={14} /></button>
                          <button className="btn btn--ghost btn--sm" onClick={() => setEditingArticleId(null)}><X size={14} /></button>
                        </div>
                      ) : (
                        <>
                          <span className="admin-expense-article__name"><Tag size={12} /> {a.name}</span>
                          <span className="admin-entity-actions">
                            <button className="btn btn--ghost btn--sm" onClick={() => { setEditingArticleId(a.id); setEditArticleName(a.name); }}><Pencil size={12} /></button>
                            <button className="btn btn--ghost btn--sm" onClick={() => handleDeleteArticle(a.id, a.name)}><Trash2 size={12} /></button>
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                  {t.articles.length === 0 && !addingArticleForType && (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", padding: "0.25rem 0 0.25rem 1.5rem" }}>Нет статей</div>
                  )}
                  {addingArticleForType === t.id && (
                    <div className="admin-inline-edit" style={{ paddingLeft: "1.5rem" }}>
                      <input
                        className="admin-inline-input"
                        placeholder="Название статьи"
                        value={newArticleName}
                        onChange={(ev) => setNewArticleName(ev.target.value)}
                        onKeyDown={(ev) => { if (ev.key === "Enter") handleAddArticle(t.id); if (ev.key === "Escape") setAddingArticleForType(null); }}
                        autoFocus
                      />
                      <button className="btn btn--ghost btn--sm" onClick={() => handleAddArticle(t.id)} disabled={!newArticleName.trim()}><Check size={14} /></button>
                      <button className="btn btn--ghost btn--sm" onClick={() => setAddingArticleForType(null)}><X size={14} /></button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add new expense type */}
          <div className="admin-inline-edit" style={{ marginTop: "0.5rem" }}>
            <input
              className="admin-inline-input"
              placeholder="Новая категория расходов"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddType(); }}
            />
            <button className="btn btn--primary btn--sm" onClick={handleAddType} disabled={!newTypeName.trim()}>
              <Plus size={14} /> Добавить
            </button>
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <h3 className="admin-subtitle" style={{ fontSize: "0.875rem", marginTop: "1.5rem" }}>
        Банковские транзакции (последние 50)
      </h3>
      {entity.recentTransactions.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>Нет транзакций</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Счёт</th>
                <th>Сумма</th>
                <th>Контрагент</th>
                <th>Назначение</th>
              </tr>
            </thead>
            <tbody>
              {entity.recentTransactions.map((t) => (
                <tr key={t.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(t.date)}</td>
                  <td>{t.accountName}</td>
                  <td className={`cell-amount cell-amount--${t.direction === "income" ? "income" : "expense"}`}>
                    {t.direction === "income" ? "+" : "\u2212"}{formatAmount(t.amount)} ₽
                  </td>
                  <td>{t.counterparty || "—"}</td>
                  <td style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.purpose || "—"}
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

/* ==================== Users List ==================== */

function UsersView({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.listUsers().then((d) => { setUsers(d); setLoading(false); });
  }, []);

  return (
    <div>
      <button className="admin-back" onClick={onBack}>
        <ArrowLeft size={16} /> Назад
      </button>
      <h2 className="admin-subtitle">Пользователи ({users.length})</h2>

      {loading ? (
        <div className="tab-loading">Загрузка...</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Компания</th>
                <th>Последнее действие</th>
                <th>Регистрация</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`admin-role admin-role--${u.role}`}>
                      {u.role === "owner" ? "Админ" : "Участник"}
                    </span>
                  </td>
                  <td>{u.companyName || "—"}</td>
                  <td>
                    {u.lastAction ? (
                      <span className={`admin-activity admin-activity--${u.lastAction.type}`}>
                        {u.lastAction.type === "dds" ? "ДДС" : "PDF"} &bull; {formatDate(u.lastAction.date)}
                      </span>
                    ) : (
                      <span className="admin-activity">—</span>
                    )}
                  </td>
                  <td>{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==================== Notifications ==================== */

function NotificationsView({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setSuccess(false);
    try {
      await notificationsApi.broadcast(title.trim(), body.trim());
      setSuccess(true);
      setTitle("");
      setBody("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Broadcast failed:", err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <button className="admin-back" onClick={onBack}>
        <ArrowLeft size={16} /> Назад
      </button>
      <h2 className="admin-subtitle">Уведомления</h2>
      <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
        Отправить уведомление всем пользователям компании
      </p>

      <form onSubmit={handleBroadcast} style={{ maxWidth: 500, display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="form-group">
          <label className="form-label">Заголовок</label>
          <input
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок уведомления"
            maxLength={100}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Текст</label>
          <textarea
            className="form-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Текст сообщения"
            rows={3}
            maxLength={500}
            required
          />
        </div>
        <button type="submit" className="btn btn--primary" disabled={sending || !title.trim() || !body.trim()}>
          <Send size={16} />
          {sending ? "Отправка..." : "Отправить"}
        </button>
        {success && <div className="form-success">{t("notifications.broadcastSuccess")}</div>}
      </form>
    </div>
  );
}

/* ==================== Create Company Modal ==================== */

function CreateCompanyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    if (open) { setName(""); setError(""); setInviteLink(""); setInviteCopied(false); }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const company = await companyApi.create({ name: name.trim() });
      // Create invite for the new company
      try {
        const inv = await adminApi.createInvite(company.id);
        setInviteLink(`${window.location.origin}/register?invite=${inv.token}`);
      } catch { /* invite creation is optional */ }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 409 ? "Компания с таким названием уже существует" : err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyInvite() {
    await navigator.clipboard.writeText(inviteLink);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  }

  function handleClose() {
    if (inviteLink) onCreated();
    else onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={inviteLink ? "Компания создана" : "Создать компанию"} size="sm">
      {inviteLink ? (
        <div className="wizard-form" style={{ textAlign: "center" }}>
          <p style={{ marginBottom: "0.75rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Ссылка-приглашение для участников:
          </p>
          <div style={{ background: "var(--bg-surface)", borderRadius: 8, padding: "0.75rem", fontSize: "0.8125rem", wordBreak: "break-all", marginBottom: "1rem" }}>
            {inviteLink}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
            <button className={`btn btn--sm ${inviteCopied ? "btn--success" : "btn--primary"}`} onClick={handleCopyInvite}>
              {inviteCopied ? <><Check size={14} /> Скопировано</> : <><Copy size={14} /> Копировать</>}
            </button>
            <button className="btn btn--sm btn--secondary" onClick={() => { onCreated(); }}>
              Готово
            </button>
          </div>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="wizard-form">
        <Input
          label="Название компании"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ООО Ромашка"
          required
          autoFocus
        />
        {error && <div className="wizard-error">{error}</div>}
        <Modal.Footer>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={saving} disabled={!name.trim()}>
            Создать
          </Button>
        </Modal.Footer>
      </form>
      )}
    </Modal>
  );
}

/* ==================== Helpers ==================== */

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatAmount(n: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
}

function opTypeLabel(type: string) {
  switch (type) {
    case "income": return "Приход";
    case "expense": return "Расход";
    case "transfer": return "Перевод";
    default: return type;
  }
}
