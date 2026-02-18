import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Upload, ChevronLeft, ChevronRight, Filter, ChevronDown, LayoutGrid, LayoutList } from "lucide-react";
import { entitiesApi } from "../api/entities.js";
import { accountsApi } from "../api/accounts.js";
import { pdfApi, type BankTransaction, type TransactionFilters } from "../api/pdf.js";
import { Button, Select } from "../components/ui/index.js";
import StatementWizard from "../components/pdf/StatementWizard.js";
import type { Entity, Account, PaginatedResponse } from "@shared/types.js";

export default function Statements() {
  const { t } = useTranslation();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [data, setData] = useState<PaginatedResponse<BankTransaction>>({
    data: [], total: 0, page: 1, limit: 20, totalPages: 0,
  });
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    window.innerWidth <= 768 ? "cards" : "table"
  );
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    entitiesApi.list().then(setEntities);
  }, []);

  useEffect(() => {
    if (selectedEntity) {
      accountsApi.list(selectedEntity).then(setAccounts);
    } else {
      setAccounts([]);
    }
  }, [selectedEntity]);

  const loadData = useCallback(async (f: TransactionFilters) => {
    setLoading(true);
    try {
      const result = await pdfApi.listTransactions(f);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(filters);
  }, [filters, loadData]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
  }

  function handlePage(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  function handleWizardDone() {
    setWizardOpen(false);
    loadData(filters);
  }

  function formatAmount(amount: string, direction: string) {
    const num = parseFloat(amount);
    const formatted = num.toLocaleString("ru-RU", { minimumFractionDigits: 2 });
    return direction === "income" ? `+${formatted}` : `-${formatted}`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  }

  return (
    <div className="statements-page page-enter">
      <div className="page-header">
        <h1 className="page-title">{t("nav.statements")}</h1>
        <div className="page-header__actions page-header__actions--desktop">
          <Button onClick={() => setWizardOpen(true)}>
            <Upload size={18} />
            {t("pdf.uploadStatement")}
          </Button>
        </div>
      </div>

      {/* Mobile: prominent upload button */}
      <div className="dds-mobile-add">
        <Button className="dds-mobile-add__btn" onClick={() => setWizardOpen(true)}>
          <Upload size={20} />
          {t("pdf.uploadStatement")}
        </Button>
      </div>

      {/* Toolbar */}
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
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
          />
          {accounts.length > 0 && (
            <Select
              options={[{ value: "", label: t("dds.allAccounts") }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
              value={filters.accountId ?? ""}
              onChange={(e) => handleFilterChange("accountId", e.target.value)}
            />
          )}
          <Select
            options={[
              { value: "", label: t("pdf.allDirections") },
              { value: "income", label: t("dds.income") },
              { value: "expense", label: t("dds.expense") },
            ]}
            value={filters.direction ?? ""}
            onChange={(e) => handleFilterChange("direction", e.target.value)}
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="tab-loading">{t("common.loading")}</div>
      ) : (
        <>
          {viewMode === "table" ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("dds.date")}</th>
                    <th>{t("pdf.account")}</th>
                    <th>{t("dds.amount")}</th>
                    <th>{t("pdf.counterparty")}</th>
                    <th>{t("pdf.purpose")}</th>
                    <th>{t("pdf.balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="table__empty">{t("pdf.noTransactions")}</td>
                    </tr>
                  ) : (
                    data.data.map((tx) => (
                      <tr key={tx.id}>
                        <td>{formatDate(tx.date)}{tx.time ? ` ${tx.time}` : ""}</td>
                        <td>{tx.account.name}</td>
                        <td>
                          <span className={`amount amount--${tx.direction}`}>
                            {formatAmount(tx.amount, tx.direction)}
                          </span>
                        </td>
                        <td>{tx.counterparty ?? "—"}</td>
                        <td>{tx.purpose ?? "—"}</td>
                        <td>{tx.balance ? parseFloat(tx.balance).toLocaleString("ru-RU", { minimumFractionDigits: 2 }) : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="op-cards">
              {data.data.length === 0 ? (
                <div className="tab-empty">{t("pdf.noTransactions")}</div>
              ) : (
                data.data.map((tx) => (
                  <TransactionCard key={tx.id} tx={tx} formatAmount={formatAmount} formatDate={formatDate} />
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

      <StatementWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onDone={handleWizardDone}
      />
    </div>
  );
}

function TransactionCard({ tx, formatAmount, formatDate }: {
  tx: BankTransaction;
  formatAmount: (amount: string, direction: string) => string;
  formatDate: (dateStr: string) => string;
}) {
  return (
    <div className="op-card">
      <div className="op-card__top">
        <span className={`op-badge op-badge--${tx.direction}`}>
          {tx.direction === "income" ? "Приход" : "Расход"}
        </span>
        <span className="op-card__date">{formatDate(tx.date)}{tx.time ? ` ${tx.time}` : ""}</span>
      </div>
      <div className="op-card__amount-row">
        <span className={`amount amount--${tx.direction}`}>
          {formatAmount(tx.amount, tx.direction)}
        </span>
      </div>
      <div className="op-card__details">
        <span className="op-card__entity">{tx.account.name}</span>
        {tx.counterparty && <span className="op-card__meta">{tx.counterparty}</span>}
        {tx.purpose && <span className="op-card__comment">{tx.purpose}</span>}
        {tx.balance && (
          <span className="op-card__meta">
            Остаток: {parseFloat(tx.balance).toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>
    </div>
  );
}
