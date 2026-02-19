import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
  ChevronDown,
  LayoutGrid,
  LayoutList,
  Pencil,
  Trash2,
} from "lucide-react";
import { pdfApi, type BankTransaction, type TransactionFilters, type UpdateTransactionPayload } from "../api/pdf.js";
import { exportApi } from "../api/export.js";
import { Button, Select, Input } from "../components/ui/index.js";
import Modal from "../components/ui/Modal.js";
import StatementWizard from "../components/pdf/StatementWizard.js";
import ExportModal from "../components/ExportModal.js";
import type { PaginatedResponse } from "@shared/types.js";

const BANK_LABELS: Record<string, string> = {
  sber: "Карта Сбер",
  tbank: "Карта Т-Банк",
  tbank_deposit: "Депозит Т-Банк",
  ozon: "ОЗОН Банк",
};

export default function StatementDetail() {
  const { bankCode } = useParams<{ bankCode: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [data, setData] = useState<PaginatedResponse<BankTransaction>>({
    data: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<TransactionFilters>({
    bankCode,
    page: 1,
    limit: 20,
  });
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    window.innerWidth <= 768 ? "cards" : "table",
  );
  const [wizardOpen, setWizardOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Edit / Delete state
  const [editTx, setEditTx] = useState<BankTransaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<BankTransaction | null>(null);
  const [editForm, setEditForm] = useState<UpdateTransactionPayload>({});
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(
    async (f: TransactionFilters) => {
      setLoading(true);
      try {
        const result = await pdfApi.listTransactions({ ...f, bankCode });
        setData(result);
      } finally {
        setLoading(false);
      }
    },
    [bankCode],
  );

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
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function toInputDate(dateStr: string) {
    return new Date(dateStr).toISOString().slice(0, 10);
  }

  function openEdit(tx: BankTransaction) {
    setEditTx(tx);
    setEditForm({
      date: toInputDate(tx.date),
      time: tx.time ?? "",
      amount: String(parseFloat(tx.amount)),
      direction: tx.direction,
      counterparty: tx.counterparty ?? "",
      purpose: tx.purpose ?? "",
    });
  }

  async function handleSaveEdit() {
    if (!editTx) return;
    setSaving(true);
    try {
      await pdfApi.updateTransaction(editTx.id, {
        ...editForm,
        counterparty: editForm.counterparty || null,
        purpose: editForm.purpose || null,
        time: editForm.time || null,
      });
      setEditTx(null);
      loadData(filters);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTx) return;
    setSaving(true);
    try {
      await pdfApi.deleteTransaction(deleteTx.id);
      setDeleteTx(null);
      loadData(filters);
    } finally {
      setSaving(false);
    }
  }

  const label = BANK_LABELS[bankCode || ""] || bankCode;

  return (
    <div className="statements-page page-enter">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button type="button" className="btn-back" onClick={() => navigate("/pdf")}>
            <ArrowLeft size={20} />
          </button>
          <h1 className="page-title">{label}</h1>
        </div>
        <div className="page-header__actions page-header__actions--desktop">
          <Button variant="secondary" className="desktop-only" onClick={() => setExportOpen(true)}>
            <Download size={18} />
            {t("export.downloadExcel")}
          </Button>
          <Button onClick={() => setWizardOpen(true)}>
            <Upload size={18} />
            {t("pdf.uploadStatement")}
          </Button>
        </div>
      </div>

      {/* Mobile upload */}
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
          <ChevronDown
            size={14}
            className={`dds-toolbar__chevron ${filtersOpen ? "dds-toolbar__chevron--open" : ""}`}
          />
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

      {/* Filters */}
      {filtersOpen && (
        <div className="dds-filters">
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
                    <th>{t("dds.amount")}</th>
                    <th>{t("pdf.counterparty")}</th>
                    <th>{t("pdf.purpose")}</th>
                    <th>{t("pdf.balance")}</th>
                    <th>{t("pdf.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="table__empty">
                        {t("pdf.noTransactions")}
                      </td>
                    </tr>
                  ) : (
                    data.data.map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          {formatDate(tx.date)}
                          {tx.time ? ` ${tx.time}` : ""}
                        </td>
                        <td>
                          <span className={`amount amount--${tx.direction}`}>
                            {formatAmount(tx.amount, tx.direction)}
                          </span>
                        </td>
                        <td>{tx.counterparty ?? "—"}</td>
                        <td>{tx.purpose ?? "—"}</td>
                        <td>
                          {tx.balance
                            ? parseFloat(tx.balance).toLocaleString("ru-RU", {
                                minimumFractionDigits: 2,
                              })
                            : "—"}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.25rem" }}>
                            <button type="button" className="icon-btn" onClick={() => openEdit(tx)}>
                              <Pencil size={16} />
                            </button>
                            <button type="button" className="icon-btn icon-btn--danger" onClick={() => setDeleteTx(tx)}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
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
                  <TransactionCard
                    key={tx.id}
                    tx={tx}
                    formatAmount={formatAmount}
                    formatDate={formatDate}
                    onEdit={() => openEdit(tx)}
                    onDelete={() => setDeleteTx(tx)}
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

      <StatementWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onDone={handleWizardDone}
        initialBankCode={bankCode}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={(from, to) => exportApi.downloadStatementsExcel({ from, to, bankCode })}
      />

      {/* Edit Modal */}
      <Modal open={!!editTx} onClose={() => setEditTx(null)} title={t("pdf.editTransaction")} size="md">
        <div className="form-group">
          <label className="form-label">{t("dds.date")}</label>
          <input
            type="date"
            className="input-field__input"
            value={editForm.date ?? ""}
            onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t("dds.amount")}</label>
          <input
            type="number"
            step="0.01"
            className="input-field__input"
            value={editForm.amount ?? ""}
            onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t("pdf.direction")}</label>
          <select
            className="input-field__input input-field__select"
            value={editForm.direction ?? ""}
            onChange={(e) => setEditForm((f) => ({ ...f, direction: e.target.value }))}
          >
            <option value="income">{t("dds.income")}</option>
            <option value="expense">{t("dds.expense")}</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{t("pdf.counterparty")}</label>
          <input
            type="text"
            className="input-field__input"
            value={editForm.counterparty ?? ""}
            onChange={(e) => setEditForm((f) => ({ ...f, counterparty: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t("pdf.purpose")}</label>
          <textarea
            className="input-field__input"
            rows={3}
            value={editForm.purpose ?? ""}
            onChange={(e) => setEditForm((f) => ({ ...f, purpose: e.target.value }))}
          />
        </div>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setEditTx(null)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSaveEdit} loading={saving}>
            {t("common.save")}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteTx} onClose={() => setDeleteTx(null)} title={t("pdf.deleteTransaction")} size="sm">
        <p className="text-secondary">{t("pdf.deleteTransactionConfirm")}</p>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteTx(null)}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={saving}>
            {t("common.delete")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function TransactionCard({
  tx,
  formatAmount,
  formatDate,
  onEdit,
  onDelete,
}: {
  tx: BankTransaction;
  formatAmount: (amount: string, direction: string) => string;
  formatDate: (dateStr: string) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="op-card">
      <div className="op-card__top">
        <span className={`op-badge op-badge--${tx.direction}`}>
          {tx.direction === "income" ? "Приход" : "Расход"}
        </span>
        <span className="op-card__date">
          {formatDate(tx.date)}
          {tx.time ? ` ${tx.time}` : ""}
        </span>
      </div>
      <div className="op-card__amount-row">
        <span className={`amount amount--${tx.direction}`}>
          {formatAmount(tx.amount, tx.direction)}
        </span>
      </div>
      <div className="op-card__details">
        {tx.counterparty && <span className="op-card__meta">{tx.counterparty}</span>}
        {tx.purpose && <span className="op-card__comment">{tx.purpose}</span>}
        {tx.balance && (
          <span className="op-card__meta">
            Остаток: {parseFloat(tx.balance).toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>
      <div className="op-card__actions">
        <button type="button" className="icon-btn" onClick={onEdit}>
          <Pencil size={16} />
        </button>
        <button type="button" className="icon-btn icon-btn--danger" onClick={onDelete}>
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
