import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import {
  Building2, Users, Bell, Plus, ChevronLeft, ChevronRight, ChevronDown,
  ArrowLeft, Send, CreditCard, FileText, LogOut, Trash2,
  Pencil, Check, X, FolderOpen, Tag, Link, Copy, Settings2, Sliders,
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
  const [editingCfId, setEditingCfId] = useState<string | null>(null);
  const [editCfName, setEditCfName] = useState("");
  const [editCfType, setEditCfType] = useState("select");
  const [editCfOptions, setEditCfOptions] = useState("");
  const [editCfShowWhen, setEditCfShowWhen] = useState("always");
  const [editCfRequired, setEditCfRequired] = useState(false);

  // Collapsible sections
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["entities", "expense", "income", "fields"]));

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

  function startEditCf(cf: AdminCustomField) {
    setEditingCfId(cf.id);
    setEditCfName(cf.name);
    setEditCfType(cf.fieldType);
    setEditCfOptions(cf.options && Array.isArray(cf.options) ? (cf.options as string[]).join(", ") : "");
    const sw = cf.showWhen as { operationType?: string } | null;
    setEditCfShowWhen(sw?.operationType === "expense" ? "expense_only" : sw?.operationType === "income" ? "income_only" : "always");
    setEditCfRequired(cf.required);
  }

  async function handleUpdateCf() {
    if (!editingCfId || !editCfName.trim()) return;
    const showWhen = editCfShowWhen === "always" ? null
      : editCfShowWhen === "expense_only" ? { operationType: "expense" }
      : editCfShowWhen === "income_only" ? { operationType: "income" }
      : null;
    await adminApi.updateCustomField(editingCfId, {
      name: editCfName.trim(),
      fieldType: editCfType,
      options: editCfType === "select" ? editCfOptions.split(",").map(o => o.trim()).filter(Boolean) : undefined,
      showWhen,
      required: editCfRequired,
    });
    setEditingCfId(null);
    await loadCustomFields();
  }

  function toggleSection(key: string) {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
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

  const sectionOpen = (key: string) => openSections.has(key);

  /* Reusable type/article tree renderer */
  function renderTypeTree(
    types: AdminExpenseType[] | AdminIncomeType[],
    opts: {
      expanded: string | null;
      setExpanded: (id: string | null) => void;
      editingTypeId: string | null;
      editTypeName: string;
      setEditTypeName: (v: string) => void;
      onRenameType: (id: string) => void;
      onStartEditType: (id: string, name: string) => void;
      onCancelEditType: () => void;
      onDeleteType: (id: string, name: string) => void;
      addingArticleForType: string | null;
      newArticleName: string;
      setNewArticleName: (v: string) => void;
      onStartAddArticle: (typeId: string) => void;
      onCancelAddArticle: () => void;
      onAddArticle: (typeId: string) => void;
      editingArticleId: string | null;
      editArticleName: string;
      setEditArticleName: (v: string) => void;
      onStartEditArticle: (id: string, name: string) => void;
      onCancelEditArticle: () => void;
      onRenameArticle: (id: string) => void;
      onDeleteArticle: (id: string, name: string) => void;
    },
  ) {
    return types.map((t) => (
      <div key={t.id} className="admin-expense-type">
        <div className="admin-expense-type__header">
          {opts.editingTypeId === t.id ? (
            <div className="admin-inline-edit">
              <input className="admin-inline-input" value={opts.editTypeName} onChange={(ev) => opts.setEditTypeName(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") opts.onRenameType(t.id); if (ev.key === "Escape") opts.onCancelEditType(); }} autoFocus />
              <button className="btn btn--ghost btn--sm" onClick={() => opts.onRenameType(t.id)}><Check size={14} /></button>
              <button className="btn btn--ghost btn--sm" onClick={opts.onCancelEditType}><X size={14} /></button>
            </div>
          ) : (
            <>
              <div className="admin-expense-type__name admin-expense-type__name--clickable" onClick={() => opts.setExpanded(opts.expanded === t.id ? null : t.id)}>
                <ChevronRight size={14} className={`admin-chevron ${opts.expanded === t.id ? "admin-chevron--open" : ""}`} />
                <FolderOpen size={14} />
                {t.name}
                <span className="admin-expense-type__count">({t.articles.length})</span>
              </div>
              <span className="admin-entity-actions">
                <button className="btn btn--ghost btn--sm" onClick={() => { opts.onStartAddArticle(t.id); opts.setExpanded(t.id); }} title="Добавить статью"><Plus size={12} /></button>
                <button className="btn btn--ghost btn--sm" onClick={() => opts.onStartEditType(t.id, t.name)} title="Переименовать"><Pencil size={12} /></button>
                <button className="btn btn--ghost btn--sm" onClick={() => opts.onDeleteType(t.id, t.name)} title="Удалить"><Trash2 size={12} /></button>
              </span>
            </>
          )}
        </div>
        {opts.expanded === t.id && (
          <div className="admin-expense-articles">
            {t.articles.map((a) => (
              <div key={a.id} className="admin-expense-article">
                {opts.editingArticleId === a.id ? (
                  <div className="admin-inline-edit">
                    <input className="admin-inline-input" value={opts.editArticleName} onChange={(ev) => opts.setEditArticleName(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") opts.onRenameArticle(a.id); if (ev.key === "Escape") opts.onCancelEditArticle(); }} autoFocus />
                    <button className="btn btn--ghost btn--sm" onClick={() => opts.onRenameArticle(a.id)}><Check size={14} /></button>
                    <button className="btn btn--ghost btn--sm" onClick={opts.onCancelEditArticle}><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <span className="admin-expense-article__name"><Tag size={12} /> {a.name}</span>
                    <span className="admin-entity-actions">
                      <button className="btn btn--ghost btn--sm" onClick={() => opts.onStartEditArticle(a.id, a.name)}><Pencil size={12} /></button>
                      <button className="btn btn--ghost btn--sm" onClick={() => opts.onDeleteArticle(a.id, a.name)}><Trash2 size={12} /></button>
                    </span>
                  </>
                )}
              </div>
            ))}
            {t.articles.length === 0 && opts.addingArticleForType !== t.id && (
              <div className="admin-empty-hint">Нет статей</div>
            )}
            {opts.addingArticleForType === t.id && (
              <div className="admin-inline-edit admin-inline-edit--indented">
                <input className="admin-inline-input" placeholder="Название статьи" value={opts.newArticleName} onChange={(ev) => opts.setNewArticleName(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") opts.onAddArticle(t.id); if (ev.key === "Escape") opts.onCancelAddArticle(); }} autoFocus />
                <button className="btn btn--ghost btn--sm" onClick={() => opts.onAddArticle(t.id)} disabled={!opts.newArticleName.trim()}><Check size={14} /></button>
                <button className="btn btn--ghost btn--sm" onClick={opts.onCancelAddArticle}><X size={14} /></button>
              </div>
            )}
          </div>
        )}
      </div>
    ));
  }

  /* Custom field form (reusable for add/edit) */
  function renderCfForm(
    name: string, setName: (v: string) => void,
    type: string, setType: (v: string) => void,
    options: string, setOptions: (v: string) => void,
    showWhen: string, setShowWhen: (v: string) => void,
    required: boolean, setRequired: (v: boolean) => void,
    onSave: () => void, onCancel: () => void,
    saveLabel = "Сохранить",
  ) {
    return (
      <div className="admin-cf-form">
        <input className="admin-inline-input" placeholder="Название поля" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="admin-cf-form__row">
          <select className="admin-inline-input admin-cf-form__select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="select">Выбор из списка</option>
            <option value="text">Текст</option>
            <option value="number">Число</option>
          </select>
          <select className="admin-inline-input admin-cf-form__select" value={showWhen} onChange={(e) => setShowWhen(e.target.value)}>
            <option value="always">Всегда</option>
            <option value="expense_only">Только расход</option>
            <option value="income_only">Только приход</option>
          </select>
          <label className="admin-cf-form__check">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Обяз.
          </label>
        </div>
        {type === "select" && (
          <input className="admin-inline-input" placeholder="Варианты через запятую" value={options} onChange={(e) => setOptions(e.target.value)} />
        )}
        <div className="admin-cf-form__actions">
          <button className="btn btn--primary btn--sm" onClick={onSave} disabled={!name.trim()}>
            <Check size={14} /> {saveLabel}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onCancel}>
            <X size={14} /> Отмена
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button className="admin-back" onClick={onBack}>
        <ArrowLeft size={16} /> Компании
      </button>

      {/* Company header */}
      <div className="admin-company-header">
        <h2 className="admin-subtitle">{company.name}</h2>
        <div className="admin-company-header__meta">
          <span className="admin-company-header__stat">{company.members.length} пользователей</span>
          <span className="admin-company-header__stat">{company.entities.length} юр.лиц</span>
          <button className={`btn btn--sm ${company.mode === "dds_only" ? "btn--warning" : "btn--ghost"}`} onClick={handleToggleMode}>
            {company.mode === "dds_only" ? "Только ДДС (без выписок)" : "Полный (ДДС + выписки)"}
          </button>
          <button className={`btn btn--sm ${inviteCopied ? "btn--success" : "btn--primary"}`} onClick={handleCopyInvite} disabled={inviteLoading}>
            {inviteCopied ? <><Check size={14} /> Скопировано</> : <><Link size={14} /> Приглашение</>}
          </button>
        </div>
      </div>

      {/* === Section: Entities === */}
      <div className="admin-section">
        <div className="admin-section__header" onClick={() => toggleSection("entities")}>
          <div className="admin-section__title"><Building2 size={16} /> Юридические лица <span className="admin-section__count">{company.entities.length}</span></div>
          <ChevronDown size={16} className={`admin-section__chevron ${sectionOpen("entities") ? "admin-section__chevron--open" : ""}`} />
        </div>
        {sectionOpen("entities") && (
          <div className="admin-section__body">
            <div className="admin-entities-grid">
              {company.entities.map((e) => (
                <div key={e.id} className="admin-entity-card">
                  {editingEntityId === e.id ? (
                    <div className="admin-inline-edit">
                      <input className="admin-inline-input" value={editEntityName} onChange={(ev) => setEditEntityName(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") handleRenameEntity(e.id); if (ev.key === "Escape") setEditingEntityId(null); }} autoFocus />
                      <button className="btn btn--ghost btn--sm" onClick={() => handleRenameEntity(e.id)}><Check size={14} /></button>
                      <button className="btn btn--ghost btn--sm" onClick={() => setEditingEntityId(null)}><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="admin-entity-card__name" onClick={() => onSelectEntity(e.id)}>{e.name}</div>
                      <div className="admin-entity-card__info">
                        <span onClick={() => onSelectEntity(e.id)}><CreditCard size={12} /> {e.accountsCount} счетов</span>
                        <span className="admin-entity-actions">
                          <button className="btn btn--ghost btn--sm" onClick={() => { setEditingEntityId(e.id); setEditEntityName(e.name); }}><Pencil size={12} /></button>
                          <button className="btn btn--ghost btn--sm" onClick={() => handleDeleteEntity(e.id, e.name)}><Trash2 size={12} /></button>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div className="admin-entity-card admin-entity-card--add">
                <input className="admin-inline-input" placeholder="Новое ИП / юр.лицо" value={newEntityName} onChange={(e) => setNewEntityName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddEntity(); }} />
                <button className="btn btn--primary btn--sm admin-entity-card--add-btn" onClick={handleAddEntity} disabled={addingEntity || !newEntityName.trim()}>
                  <Plus size={14} /> Добавить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* === Section: Expense Types === */}
      <div className="admin-section">
        <div className="admin-section__header" onClick={() => toggleSection("expense")}>
          <div className="admin-section__title"><FolderOpen size={16} /> Категории расходов <span className="admin-section__count">{expenseTypes.length}</span></div>
          <ChevronDown size={16} className={`admin-section__chevron ${sectionOpen("expense") ? "admin-section__chevron--open" : ""}`} />
        </div>
        {sectionOpen("expense") && (
          <div className="admin-section__body">
            {company.entities.length === 0 ? (
              <div className="admin-empty-hint">Сначала добавьте юридическое лицо</div>
            ) : expLoading ? (
              <div className="tab-loading">Загрузка...</div>
            ) : (
              <div className="admin-expense-list">
                {renderTypeTree(expenseTypes, {
                  expanded: expandedType, setExpanded: setExpandedType,
                  editingTypeId, editTypeName, setEditTypeName,
                  onRenameType: handleRenameType,
                  onStartEditType: (id, name) => { setEditingTypeId(id); setEditTypeName(name); },
                  onCancelEditType: () => setEditingTypeId(null),
                  onDeleteType: handleDeleteType,
                  addingArticleForType, newArticleName, setNewArticleName,
                  onStartAddArticle: (id) => { setAddingArticleForType(id); setNewArticleName(""); },
                  onCancelAddArticle: () => setAddingArticleForType(null),
                  onAddArticle: handleAddArticle,
                  editingArticleId, editArticleName, setEditArticleName,
                  onStartEditArticle: (id, name) => { setEditingArticleId(id); setEditArticleName(name); },
                  onCancelEditArticle: () => setEditingArticleId(null),
                  onRenameArticle: handleRenameArticle,
                  onDeleteArticle: handleDeleteArticle,
                })}
                {expenseTypes.length === 0 && <div className="admin-empty-hint">Нет категорий</div>}
                <div className="admin-inline-edit">
                  <input className="admin-inline-input" placeholder="Новая категория расходов" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddType(); }} />
                  <button className="btn btn--primary btn--sm" onClick={handleAddType} disabled={!newTypeName.trim()}><Plus size={14} /> Добавить</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* === Section: Income Types === */}
      <div className="admin-section">
        <div className="admin-section__header" onClick={() => toggleSection("income")}>
          <div className="admin-section__title"><FolderOpen size={16} /> Категории приходов <span className="admin-section__count">{incomeTypes.length}</span></div>
          <ChevronDown size={16} className={`admin-section__chevron ${sectionOpen("income") ? "admin-section__chevron--open" : ""}`} />
        </div>
        {sectionOpen("income") && (
          <div className="admin-section__body">
            {company.entities.length === 0 ? (
              <div className="admin-empty-hint">Сначала добавьте юридическое лицо</div>
            ) : incLoading ? (
              <div className="tab-loading">Загрузка...</div>
            ) : (
              <div className="admin-expense-list">
                {renderTypeTree(incomeTypes, {
                  expanded: expandedIncType, setExpanded: setExpandedIncType,
                  editingTypeId: editingIncTypeId, editTypeName: editIncTypeName, setEditTypeName: setEditIncTypeName,
                  onRenameType: handleRenameIncType,
                  onStartEditType: (id, name) => { setEditingIncTypeId(id); setEditIncTypeName(name); },
                  onCancelEditType: () => setEditingIncTypeId(null),
                  onDeleteType: handleDeleteIncType,
                  addingArticleForType: addingIncArticleForType, newArticleName: newIncArticleName, setNewArticleName: setNewIncArticleName,
                  onStartAddArticle: (id) => { setAddingIncArticleForType(id); setNewIncArticleName(""); },
                  onCancelAddArticle: () => setAddingIncArticleForType(null),
                  onAddArticle: handleAddIncArticle,
                  editingArticleId: editingIncArticleId, editArticleName: editIncArticleName, setEditArticleName: setEditIncArticleName,
                  onStartEditArticle: (id, name) => { setEditingIncArticleId(id); setEditIncArticleName(name); },
                  onCancelEditArticle: () => setEditingIncArticleId(null),
                  onRenameArticle: handleRenameIncArticle,
                  onDeleteArticle: handleDeleteIncArticle,
                })}
                {incomeTypes.length === 0 && <div className="admin-empty-hint">Нет категорий</div>}
                <div className="admin-inline-edit">
                  <input className="admin-inline-input" placeholder="Новая категория приходов" value={newIncTypeName} onChange={(e) => setNewIncTypeName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddIncType(); }} />
                  <button className="btn btn--primary btn--sm" onClick={handleAddIncType} disabled={!newIncTypeName.trim()}><Plus size={14} /> Добавить</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* === Section: Custom Fields === */}
      <div className="admin-section">
        <div className="admin-section__header" onClick={() => toggleSection("fields")}>
          <div className="admin-section__title"><Sliders size={16} /> Кастомные поля ДДС <span className="admin-section__count">{customFields.length}</span></div>
          <ChevronDown size={16} className={`admin-section__chevron ${sectionOpen("fields") ? "admin-section__chevron--open" : ""}`} />
        </div>
        {sectionOpen("fields") && (
          <div className="admin-section__body">
            {cfLoading ? (
              <div className="tab-loading">Загрузка...</div>
            ) : (
              <div className="admin-expense-list">
                {customFields.map((cf) => (
                  <div key={cf.id} className="admin-expense-type">
                    {editingCfId === cf.id ? (
                      <div className="admin-expense-type__header">
                        {renderCfForm(
                          editCfName, setEditCfName,
                          editCfType, setEditCfType,
                          editCfOptions, setEditCfOptions,
                          editCfShowWhen, setEditCfShowWhen,
                          editCfRequired, setEditCfRequired,
                          handleUpdateCf, () => setEditingCfId(null),
                          "Сохранить",
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="admin-expense-type__header">
                          <div className="admin-expense-type__name">
                            <Tag size={14} />
                            {cf.name}
                            <span className="admin-cf-badge admin-cf-badge--type">{cf.fieldType === "select" ? "выбор" : cf.fieldType === "text" ? "текст" : "число"}</span>
                            {cf.required && <span className="admin-cf-badge admin-cf-badge--req">обяз.</span>}
                            {cf.showWhen && (
                              <span className="admin-cf-badge admin-cf-badge--when">
                                {(cf.showWhen as any).operationType === "expense" ? "расход" : "приход"}
                              </span>
                            )}
                          </div>
                          <span className="admin-entity-actions">
                            <button className="btn btn--ghost btn--sm" onClick={() => startEditCf(cf)} title="Редактировать"><Pencil size={12} /></button>
                            <button className="btn btn--ghost btn--sm" onClick={() => handleDeleteCustomField(cf.id, cf.name)} title="Удалить"><Trash2 size={12} /></button>
                          </span>
                        </div>
                        {cf.options && Array.isArray(cf.options) && (cf.options as string[]).length > 0 && (
                          <div className="admin-cf-options">
                            {(cf.options as string[]).map((opt, i) => <span key={i} className="admin-cf-option-tag">{opt}</span>)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}

                {customFields.length === 0 && !showCfForm && (
                  <div className="admin-empty-hint">Нет кастомных полей</div>
                )}

                {showCfForm ? renderCfForm(
                  cfName, setCfName,
                  cfType, setCfType,
                  cfOptions, setCfOptions,
                  cfShowWhen, setCfShowWhen,
                  cfRequired, setCfRequired,
                  handleAddCustomField, () => setShowCfForm(false),
                  "Создать",
                ) : (
                  <button className="btn btn--primary btn--sm" onClick={() => setShowCfForm(true)}>
                    <Plus size={14} /> Добавить поле
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* === Section: Operations === */}
      <div className="admin-section">
        <div className="admin-section__header" onClick={() => toggleSection("ops")}>
          <div className="admin-section__title"><FileText size={16} /> ДДС операции <span className="admin-section__count">{opsTotal}</span></div>
          <ChevronDown size={16} className={`admin-section__chevron ${sectionOpen("ops") ? "admin-section__chevron--open" : ""}`} />
        </div>
        {sectionOpen("ops") && (
          <div className="admin-section__body">
      {/* DDS operations table */}

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
        )}
      </div>
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
      <div className="admin-section">
        <div className="admin-section__header">
          <div className="admin-section__title"><CreditCard size={16} /> Счета <span className="admin-section__count">{entity.accounts.length}</span></div>
        </div>
        <div className="admin-section__body">
          {entity.accounts.length === 0 ? (
            <div className="admin-empty-hint">Нет счетов</div>
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
                  <div className="admin-account-item__right">
                    <div className="admin-account-item__info"><FileText size={12} /> {a.transactionCount}</div>
                    <button type="button" className={`admin-toggle${a.enabled ? " admin-toggle--on" : ""}`} onClick={() => handleToggleAccount(a.id)} title={a.enabled ? "Отключить" : "Включить"}>
                      <span className="admin-toggle__knob" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expense Types / Articles */}
      <div className="admin-section">
        <div className="admin-section__header">
          <div className="admin-section__title"><FolderOpen size={16} /> Категории расходов <span className="admin-section__count">{expenseTypes.length}</span></div>
        </div>
        <div className="admin-section__body">
          {expLoading ? (
            <div className="tab-loading">Загрузка...</div>
          ) : (
            <div className="admin-expense-list">
              {expenseTypes.map((t) => (
                <div key={t.id} className="admin-expense-type">
                  <div className="admin-expense-type__header">
                    {editingTypeId === t.id ? (
                      <div className="admin-inline-edit">
                        <input className="admin-inline-input" value={editTypeName} onChange={(ev) => setEditTypeName(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") handleRenameType(t.id); if (ev.key === "Escape") setEditingTypeId(null); }} autoFocus />
                        <button className="btn btn--ghost btn--sm" onClick={() => handleRenameType(t.id)}><Check size={14} /></button>
                        <button className="btn btn--ghost btn--sm" onClick={() => setEditingTypeId(null)}><X size={14} /></button>
                      </div>
                    ) : (
                      <>
                        <div className="admin-expense-type__name admin-expense-type__name--clickable" onClick={() => setExpandedType(expandedType === t.id ? null : t.id)}>
                          <ChevronRight size={14} className={`admin-chevron ${expandedType === t.id ? "admin-chevron--open" : ""}`} />
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
                              <input className="admin-inline-input" value={editArticleName} onChange={(ev) => setEditArticleName(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") handleRenameArticle(a.id); if (ev.key === "Escape") setEditingArticleId(null); }} autoFocus />
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
                      {t.articles.length === 0 && !addingArticleForType && <div className="admin-empty-hint" style={{ paddingLeft: "1.5rem" }}>Нет статей</div>}
                      {addingArticleForType === t.id && (
                        <div className="admin-inline-edit admin-inline-edit--indented">
                          <input className="admin-inline-input" placeholder="Название статьи" value={newArticleName} onChange={(ev) => setNewArticleName(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") handleAddArticle(t.id); if (ev.key === "Escape") setAddingArticleForType(null); }} autoFocus />
                          <button className="btn btn--ghost btn--sm" onClick={() => handleAddArticle(t.id)} disabled={!newArticleName.trim()}><Check size={14} /></button>
                          <button className="btn btn--ghost btn--sm" onClick={() => setAddingArticleForType(null)}><X size={14} /></button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div className="admin-inline-edit">
                <input className="admin-inline-input" placeholder="Новая категория расходов" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddType(); }} />
                <button className="btn btn--primary btn--sm" onClick={handleAddType} disabled={!newTypeName.trim()}><Plus size={14} /> Добавить</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="admin-section">
        <div className="admin-section__header">
          <div className="admin-section__title"><FileText size={16} /> Банковские транзакции <span className="admin-section__count">{entity.recentTransactions.length}</span></div>
        </div>
        <div className="admin-section__body">
          {entity.recentTransactions.length === 0 ? (
            <div className="admin-empty-hint">Нет транзакций</div>
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
                      <td className="admin-table__nowrap">{formatDate(t.date)}</td>
                      <td>{t.accountName}</td>
                      <td className={`cell-amount cell-amount--${t.direction === "income" ? "income" : "expense"}`}>
                        {t.direction === "income" ? "+" : "\u2212"}{formatAmount(t.amount)} ₽
                      </td>
                      <td>{t.counterparty || "—"}</td>
                      <td className="admin-table__truncate">{t.purpose || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==================== Users List ==================== */

const ALL_BANKS = [
  { code: "sber", label: "Сбер" },
  { code: "tbank", label: "Т-Банк" },
  { code: "tbank_deposit", label: "Т-Банк Депозит" },
  { code: "ozon", label: "Озон" },
  { code: "module", label: "Модуль" },
  { code: "tochka", label: "Точка" },
];

function UsersView({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [companyEntities, setCompanyEntities] = useState<Map<string, { id: string; name: string }[]>>(new Map());

  useEffect(() => {
    adminApi.listUsers().then((d) => { setUsers(d); setLoading(false); });
  }, []);

  // Load company entities when expanding a user
  async function loadCompanyEntities(companyId: string) {
    if (companyEntities.has(companyId)) return;
    try {
      const detail = await adminApi.getCompany(companyId);
      setCompanyEntities((prev) => new Map(prev).set(companyId, detail.entities.map((e) => ({ id: e.id, name: e.name }))));
    } catch { /* ignore */ }
  }

  function handleExpand(userId: string, companyId: string | null) {
    const next = expandedUser === userId ? null : userId;
    setExpandedUser(next);
    if (next && companyId) loadCompanyEntities(companyId);
  }

  async function handleModeChange(userId: string, mode: string) {
    const newMode = mode === "" ? null : mode;
    await adminApi.setUserMode(userId, newMode);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, mode: newMode } : u));
  }

  async function handleBankToggle(userId: string, bankCode: string, currentDisabled: string[]) {
    const isDisabled = currentDisabled.includes(bankCode);
    const newDisabled = isDisabled
      ? currentDisabled.filter((b) => b !== bankCode)
      : [...currentDisabled, bankCode];
    await adminApi.setUserDisabledBanks(userId, newDisabled);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, disabledBanks: newDisabled } : u));
  }

  async function handleEntityToggle(userId: string, entityId: string, currentAccess: { entityId: string; entityName: string }[]) {
    const hasAccess = currentAccess.some((ea) => ea.entityId === entityId);
    const newIds = hasAccess
      ? currentAccess.filter((ea) => ea.entityId !== entityId).map((ea) => ea.entityId)
      : [...currentAccess.map((ea) => ea.entityId), entityId];
    try {
      const updated = await adminApi.setUserEntityAccess(userId, newIds);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, entityAccess: updated } : u));
    } catch { /* ignore */ }
  }

  return (
    <div>
      <button className="admin-back" onClick={onBack}>
        <ArrowLeft size={16} /> Назад
      </button>
      <h2 className="admin-subtitle">Пользователи ({users.length})</h2>

      {loading ? (
        <div className="tab-loading">Загрузка...</div>
      ) : (
        <div className="admin-users-list">
          {users.map((u) => (
            <div key={u.id} className="admin-user-card">
              <div className="admin-user-card__header" onClick={() => handleExpand(u.id, u.companyId)}>
                <div className="admin-user-card__info">
                  <span className="admin-user-card__name">{u.name}</span>
                  <span className="admin-user-card__email">{u.email}</span>
                </div>
                <div className="admin-user-card__meta">
                  <span className={`admin-role admin-role--${u.role}`}>
                    {u.role === "owner" ? "Админ" : "Участник"}
                  </span>
                  {u.companyName && <span className="admin-user-card__company">{u.companyName}</span>}
                  {u.lastAction && (
                    <span className={`admin-activity admin-activity--${u.lastAction.type}`}>
                      {u.lastAction.type === "dds" ? "ДДС" : "PDF"} &bull; {formatDate(u.lastAction.date)}
                    </span>
                  )}
                </div>
                <ChevronDown size={16} className={`admin-user-card__chevron ${expandedUser === u.id ? "admin-user-card__chevron--open" : ""}`} />
              </div>

              {expandedUser === u.id && (
                <div className="admin-user-card__body">
                  <div className="admin-user-card__section">
                    <label className="admin-user-card__label">Режим</label>
                    <select
                      className="admin-mode-select"
                      value={u.mode ?? ""}
                      onChange={(e) => handleModeChange(u.id, e.target.value)}
                    >
                      <option value="">По компании (как у компании)</option>
                      <option value="full">Полный (ДДС + выписки)</option>
                      <option value="dds_only">Только ДДС (без выписок)</option>
                    </select>
                  </div>

                  <div className="admin-user-card__section">
                    <label className="admin-user-card__label">Доступные банки</label>
                    <div className="admin-bank-toggles">
                      {ALL_BANKS.map((bank) => {
                        const isEnabled = !u.disabledBanks.includes(bank.code);
                        return (
                          <button
                            key={bank.code}
                            type="button"
                            className={`admin-bank-toggle ${isEnabled ? "admin-bank-toggle--on" : "admin-bank-toggle--off"}`}
                            onClick={() => handleBankToggle(u.id, bank.code, u.disabledBanks)}
                          >
                            {bank.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {u.companyId && (
                    <div className="admin-user-card__section">
                      <label className="admin-user-card__label">Доступ к юр. лицам</label>
                      <div className="admin-bank-toggles">
                        {(companyEntities.get(u.companyId) || []).map((ent) => {
                          const hasAccess = u.entityAccess.some((ea) => ea.entityId === ent.id);
                          return (
                            <button
                              key={ent.id}
                              type="button"
                              className={`admin-bank-toggle ${hasAccess ? "admin-bank-toggle--on" : "admin-bank-toggle--off"}`}
                              onClick={() => handleEntityToggle(u.id, ent.id, u.entityAccess)}
                            >
                              {ent.name}
                            </button>
                          );
                        })}
                        {!companyEntities.has(u.companyId) && (
                          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Загрузка...</span>
                        )}
                        {companyEntities.has(u.companyId) && companyEntities.get(u.companyId)!.length === 0 && (
                          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Нет юр. лиц</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="admin-user-card__footer">
                    <span className="admin-user-card__date">Регистрация: {formatDate(u.createdAt)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
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
