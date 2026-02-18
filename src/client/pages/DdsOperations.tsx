import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { ddsApi, type OperationFilters } from "../api/dds.js";
import { entitiesApi } from "../api/entities.js";
import { accountsApi } from "../api/accounts.js";
import { expensesApi } from "../api/expenses.js";
import { exportApi } from "../api/export.js";
import { Button, Select, Input, Table } from "../components/ui/index.js";
import OperationWizard from "../components/dds/OperationWizard.js";
import DeleteConfirm from "../components/dds/DeleteConfirm.js";
import type { DdsOperation, Entity, Account, ExpenseType, PaginatedResponse } from "@shared/types.js";
import { Pencil, Trash2 } from "lucide-react";

const OP_TYPES = [
  { value: "", labelKey: "dds.allTypes" },
  { value: "income", labelKey: "dds.income" },
  { value: "expense", labelKey: "dds.expense" },
  { value: "transfer", labelKey: "dds.transfer" },
];

export default function DdsOperations() {
  const { t } = useTranslation();
  const [data, setData] = useState<PaginatedResponse<DdsOperation>>({
    data: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [entities, setEntities] = useState<Entity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filters, setFilters] = useState<OperationFilters>({ page: 1, limit: 20 });
  const [searchInput, setSearchInput] = useState("");

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editOp, setEditOp] = useState<DdsOperation | null>(null);

  // Delete
  const [deleteOp, setDeleteOp] = useState<DdsOperation | null>(null);

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

  // Load accounts & expense types for the selected entity filter
  useEffect(() => {
    if (filters.entityId) {
      Promise.all([
        accountsApi.list(filters.entityId),
        expensesApi.listTypes(filters.entityId),
      ]).then(([accs, types]) => {
        setAccounts(accs);
        setExpenseTypes(types);
      });
    } else {
      setAccounts([]);
      setExpenseTypes([]);
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

  function openCreate() {
    setEditOp(null);
    setWizardOpen(true);
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
      render: (r: DdsOperation) => r.fromAccount?.name ?? "—",
    },
    {
      key: "toAccount",
      header: t("dds.to"),
      render: (r: DdsOperation) => r.toAccount?.name ?? "—",
    },
    {
      key: "expenseType",
      header: t("dds.expenseType"),
      render: (r: DdsOperation) => r.expenseType?.name ?? "—",
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
        <h1 className="page-title">{t("nav.dds")}</h1>
        <div className="page-header__actions">
          <Button
            variant="secondary"
            onClick={() => exportApi.downloadDdsCsv({ entityId: filters.entityId })}
          >
            <Download size={18} />
            {t("dds.exportCsv")}
          </Button>
          <Button onClick={openCreate}>
            <Plus size={18} />
            {t("dds.addOperation")}
          </Button>
        </div>
      </div>

      {/* Filters */}
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

      {/* Table */}
      {loading ? (
        <div className="tab-loading">{t("common.loading")}</div>
      ) : (
        <>
          <Table
            columns={columns}
            data={data.data}
            rowKey={(r) => r.id}
            emptyMessage={t("dds.noOperations")}
          />

          {/* Pagination */}
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

      {/* Operation Wizard */}
      <OperationWizard
        open={wizardOpen}
        onClose={() => { setWizardOpen(false); setEditOp(null); }}
        onDone={handleWizardDone}
        editOperation={editOp}
        entities={entities}
      />

      {/* Delete Confirm */}
      <DeleteConfirm
        operation={deleteOp}
        onClose={() => setDeleteOp(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
