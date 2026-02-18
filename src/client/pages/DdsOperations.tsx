import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, ChevronLeft, ChevronRight, Download, Info, Users, Building2, Link2, Copy, Check, ChevronDown, Plus, Filter, LayoutList, LayoutGrid } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth.js";
import { ddsApi, type OperationFilters } from "../api/dds.js";
import { entitiesApi } from "../api/entities.js";
import { accountsApi } from "../api/accounts.js";
import { exportApi } from "../api/export.js";
import { companyApi } from "../api/company.js";
import { Button, Select, Input, Table } from "../components/ui/index.js";
import StepWizard from "../components/dds/StepWizard.js";
import DeleteConfirm from "../components/dds/DeleteConfirm.js";
import CompanySetup from "../components/dds/CompanySetup.js";
import type { DdsOperation, Entity, Account, PaginatedResponse, InviteInfo } from "@shared/types.js";
import { Pencil, Trash2 } from "lucide-react";

const OP_TYPES = [
  { value: "", labelKey: "dds.allTypes" },
  { value: "income", labelKey: "dds.income" },
  { value: "expense", labelKey: "dds.expense" },
  { value: "transfer", labelKey: "dds.transfer" },
];

export default function DdsOperations() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const companyName = user?.company?.name;
  const hasCompany = !!user?.companyId;
  const isOwner = user?.role === "owner";

  if (!hasCompany && isOwner) {
    return <Navigate to="/admin" replace />;
  }

  if (!hasCompany) {
    return (
      <div className="dds-page page-enter">
        <div className="page-header">
          <h1 className="page-title">{t("nav.dds")}</h1>
        </div>
        <CompanySetup />
      </div>
    );
  }

  return <DdsTable companyName={companyName} />;
}

/* --- Company Info Panel --- */

function CompanyInfoPanel({ entities }: { entities: Entity[] }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open && members.length === 0) {
      companyApi.listMembers().then(setMembers);
    }
  }, [open, members.length]);

  async function handleCreateInvite() {
    setCreating(true);
    try {
      const inv = await companyApi.createInvite();
      setInvite(inv);
    } finally {
      setCreating(false);
    }
  }

  function handleCopy() {
    if (!invite) return;
    const url = `${window.location.origin}/register?invite=${invite.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isOwner = user?.role === "owner";

  return (
    <div className={`company-info ${open ? "company-info--open" : ""}`}>
      <button type="button" className="company-info__toggle" onClick={() => setOpen(!open)}>
        <Info size={16} />
        <span>{t("company.companyInfo")}</span>
        <ChevronDown size={14} className={`company-info__chevron ${open ? "company-info__chevron--open" : ""}`} />
      </button>

      {open && (
        <div className="company-info__body">
          <div className="company-info__section">
            <div className="company-info__section-header">
              <Users size={15} />
              <span>{t("company.members")}</span>
            </div>
            <div className="company-info__list">
              {members.map((m) => (
                <span key={m.id} className="company-info__chip">
                  {m.name}
                  {m.role === "owner" && <span className="company-info__role">({t("company.owner")})</span>}
                </span>
              ))}
            </div>
          </div>

          <div className="company-info__section">
            <div className="company-info__section-header">
              <Building2 size={15} />
              <span>{t("company.entities")}</span>
            </div>
            <div className="company-info__list">
              {entities.map((e) => (
                <span key={e.id} className="company-info__chip">{e.name}</span>
              ))}
            </div>
          </div>

          {isOwner && (
            <div className="company-info__section">
              <div className="company-info__section-header">
                <Link2 size={15} />
                <span>{t("company.inviteLink")}</span>
              </div>
              {invite ? (
                <div className="company-info__invite-row">
                  <code className="company-info__invite-url">
                    {`${window.location.origin}/register?invite=${invite.token}`}
                  </code>
                  <button type="button" className="icon-btn" onClick={handleCopy} title={t("common.copy")}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" onClick={handleCreateInvite} loading={creating}>
                  <Link2 size={14} />
                  {t("company.createInvite")}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* --- Operation Card (mobile view) --- */

function OperationCard({ op, onEdit, onDelete, t, formatAmount, formatDate }: {
  op: DdsOperation;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string) => string;
  formatAmount: (amount: string, opType: string) => string;
  formatDate: (dateStr: string) => string;
}) {
  return (
    <div className="op-card">
      <div className="op-card__top">
        <span className={`op-badge op-badge--${op.operationType}`}>
          {t(`dds.${op.operationType}`)}
        </span>
        <span className="op-card__date">{formatDate(op.createdAt)}</span>
      </div>
      <div className="op-card__amount-row">
        <span className={`amount amount--${op.operationType}`}>
          {formatAmount(op.amount, op.operationType)}
        </span>
      </div>
      <div className="op-card__details">
        <span className="op-card__entity">{op.entity.name}</span>
        {op.fromAccount && <span className="op-card__meta">{t("dds.from")}: {op.fromAccount.name}</span>}
        {op.toAccount && <span className="op-card__meta">{t("dds.to")}: {op.toAccount.name}</span>}
        {op.expenseType && <span className="op-card__meta">{op.expenseType.name}{op.expenseArticle ? ` / ${op.expenseArticle.name}` : ""}</span>}
        {op.orderNumber && <span className="op-card__meta">#{op.orderNumber}</span>}
        {op.comment && <span className="op-card__comment">{op.comment}</span>}
      </div>
      <div className="op-card__actions">
        <button type="button" className="icon-btn" onClick={onEdit} title={t("common.edit")}>
          <Pencil size={16} />
        </button>
        <button type="button" className="icon-btn icon-btn--danger" onClick={onDelete} title={t("common.delete")}>
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

/* --- DDS Table --- */

function DdsTable({ companyName }: { companyName?: string }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<PaginatedResponse<DdsOperation>>({
    data: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [entities, setEntities] = useState<Entity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filters, setFilters] = useState<OperationFilters>({ page: 1, limit: 20 });
  const [searchInput, setSearchInput] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    window.innerWidth <= 768 ? "cards" : "table"
  );

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editOp, setEditOp] = useState<DdsOperation | null>(null);

  // Delete
  const [deleteOp, setDeleteOp] = useState<DdsOperation | null>(null);

  // Invite link
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const isOwner = user?.role === "owner";

  async function handleCopyInviteLink() {
    setInviteLoading(true);
    try {
      const inv = await companyApi.createInvite();
      const url = `${window.location.origin}/register?invite=${inv.token}`;
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } finally {
      setInviteLoading(false);
    }
  }

  const loadOperations = useCallback(async (f: OperationFilters) => {
    setLoading(true);
    try {
      const result = await ddsApi.listOperations(f);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    entitiesApi.list().then(setEntities);
  }, []);

  useEffect(() => {
    if (filters.entityId) {
      accountsApi.list(filters.entityId).then(setAccounts);
    } else {
      setAccounts([]);
    }
  }, [filters.entityId]);

  useEffect(() => {
    loadOperations(filters);
  }, [filters, loadOperations]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
  }

  function handleSearch() {
    setFilters((prev) => ({ ...prev, search: searchInput || undefined, page: 1 }));
  }

  function handlePage(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  function openEdit(op: DdsOperation) {
    setEditOp(op);
    setWizardOpen(true);
  }

  async function handleWizardDone() {
    setWizardOpen(false);
    setEditOp(null);
    await loadOperations(filters);
  }

  async function handleDeleted() {
    setDeleteOp(null);
    await loadOperations(filters);
  }

  function formatAmount(amount: string, opType: string) {
    const num = parseFloat(amount);
    const formatted = num.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    if (opType === "income") return `+${formatted}`;
    if (opType === "expense") return `-${formatted}`;
    return formatted;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  const columns = [
    {
      key: "createdAt",
      header: t("dds.date"),
      render: (r: DdsOperation) => formatDate(r.createdAt),
    },
    {
      key: "userName",
      header: t("dds.userName"),
      render: (r: DdsOperation) => r.user.name,
    },
    {
      key: "entity",
      header: t("dds.entity"),
      render: (r: DdsOperation) => r.entity.name,
    },
    {
      key: "operationType",
      header: t("dds.type"),
      render: (r: DdsOperation) => (
        <span className={`op-badge op-badge--${r.operationType}`}>
          {t(`dds.${r.operationType}`)}
        </span>
      ),
    },
    {
      key: "fromAccount",
      header: t("dds.from"),
      render: (r: DdsOperation) => r.fromAccount?.name ?? "\u2014",
    },
    {
      key: "toAccount",
      header: t("dds.to"),
      render: (r: DdsOperation) => r.toAccount?.name ?? "\u2014",
    },
    {
      key: "amount",
      header: t("dds.amount"),
      className: "table-amount",
      render: (r: DdsOperation) => (
        <span className={`amount amount--${r.operationType}`}>
          {formatAmount(r.amount, r.operationType)}
        </span>
      ),
    },
    {
      key: "expenseType",
      header: t("dds.expenseType"),
      render: (r: DdsOperation) => r.expenseType?.name ?? "\u2014",
    },
    {
      key: "expenseArticle",
      header: t("dds.expenseArticle"),
      render: (r: DdsOperation) => r.expenseArticle?.name ?? "\u2014",
    },
    {
      key: "orderNumber",
      header: t("dds.orderNumber"),
      render: (r: DdsOperation) => r.orderNumber ?? "\u2014",
    },
    {
      key: "comment",
      header: t("dds.comment"),
      render: (r: DdsOperation) => r.comment ?? "",
    },
    {
      key: "actions",
      header: "",
      className: "table-actions",
      render: (row: DdsOperation) => (
        <div className="table-actions-cell">
          <button type="button" className="icon-btn" onClick={() => openEdit(row)} title={t("common.edit")}>
            <Pencil size={16} />
          </button>
          <button type="button" className="icon-btn icon-btn--danger" onClick={() => setDeleteOp(row)} title={t("common.delete")}>
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="dds-page page-enter">
      <div className="page-header">
        <h1 className="page-title">
          {t("nav.dds")}{companyName ? ` \u00B7 ${companyName}` : ""}
        </h1>
        <div className="page-header__actions page-header__actions--desktop">
          {isOwner && (
            <Button
              variant="secondary"
              onClick={handleCopyInviteLink}
              loading={inviteLoading}
            >
              {inviteCopied ? <Check size={18} /> : <Copy size={18} />}
              {inviteCopied ? t("dds.inviteLinkCopied") : t("dds.copyInviteLink")}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => exportApi.downloadDdsCsv({ entityId: filters.entityId })}
          >
            <Download size={18} />
            {t("dds.exportCsv")}
          </Button>
          <Button onClick={() => { setEditOp(null); setWizardOpen(true); }}>
            <Plus size={18} />
            {t("dds.addOperation")}
          </Button>
        </div>
      </div>

      {/* Mobile: prominent add button */}
      <div className="dds-mobile-add">
        <Button className="dds-mobile-add__btn" onClick={() => { setEditOp(null); setWizardOpen(true); }}>
          <Plus size={20} />
          {t("dds.addOperation")}
        </Button>
      </div>

      {/* Company Info */}
      <CompanyInfoPanel entities={entities} />

      {/* Filter toggle + view toggle */}
      <div className="dds-toolbar">
        <button
          type="button"
          className={`dds-toolbar__btn ${filtersOpen ? "dds-toolbar__btn--active" : ""}`}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <Filter size={16} />
          <span>{t("dds.filter")}</span>
          <ChevronDown size={14} className={`dds-toolbar__chevron ${filtersOpen ? "dds-toolbar__chevron--open" : ""}`} />
        </button>
        <div className="dds-toolbar__view">
          <button
            type="button"
            className={`dds-toolbar__view-btn ${viewMode === "cards" ? "dds-toolbar__view-btn--active" : ""}`}
            onClick={() => setViewMode("cards")}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            type="button"
            className={`dds-toolbar__view-btn ${viewMode === "table" ? "dds-toolbar__view-btn--active" : ""}`}
            onClick={() => setViewMode("table")}
          >
            <LayoutList size={16} />
          </button>
        </div>
      </div>

      {/* Filters (collapsible) */}
      {filtersOpen && (
        <div className="dds-filters">
          <Select
            options={[{ value: "", label: t("dds.allEntities") }, ...entities.map((e) => ({ value: e.id, label: e.name }))]}
            value={filters.entityId ?? ""}
            onChange={(e) => handleFilterChange("entityId", e.target.value)}
          />
          <Select
            options={OP_TYPES.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            value={filters.operationType ?? ""}
            onChange={(e) => handleFilterChange("operationType", e.target.value)}
          />
          {accounts.length > 0 && (
            <Select
              options={[{ value: "", label: t("dds.allAccounts") }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
              value={filters.accountId ?? ""}
              onChange={(e) => handleFilterChange("accountId", e.target.value)}
            />
          )}
          <div className="dds-search">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("dds.searchPlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button type="button" className="icon-btn" onClick={handleSearch}>
              <Search size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="tab-loading">{t("common.loading")}</div>
      ) : (
        <>
          {viewMode === "table" ? (
            <Table
              columns={columns}
              data={data.data}
              rowKey={(r) => r.id}
              emptyMessage={t("dds.noOperations")}
            />
          ) : (
            <div className="op-cards">
              {data.data.length === 0 ? (
                <div className="tab-empty">{t("dds.noOperations")}</div>
              ) : (
                data.data.map((op) => (
                  <OperationCard
                    key={op.id}
                    op={op}
                    onEdit={() => openEdit(op)}
                    onDelete={() => setDeleteOp(op)}
                    t={t}
                    formatAmount={formatAmount}
                    formatDate={formatDate}
                  />
                ))
              )}
            </div>
          )}

          {data.totalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                className="pagination__btn"
                disabled={data.page <= 1}
                onClick={() => handlePage(data.page - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="pagination__info">
                {data.page} / {data.totalPages}
              </span>
              <button
                type="button"
                className="pagination__btn"
                disabled={data.page >= data.totalPages}
                onClick={() => handlePage(data.page + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      <StepWizard
        open={wizardOpen}
        onClose={() => { setWizardOpen(false); setEditOp(null); }}
        onDone={handleWizardDone}
        editOperation={editOp}
        entities={entities}
      />

      <DeleteConfirm
        operation={deleteOp}
        onClose={() => setDeleteOp(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
