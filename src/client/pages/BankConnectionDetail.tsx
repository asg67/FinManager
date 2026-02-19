import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
  ChevronDown,
  LayoutGrid,
  LayoutList,
  RefreshCw,
} from "lucide-react";
import { bankConnectionsApi, type SyncPayload } from "../api/bankConnections.js";
import { exportApi } from "../api/export.js";
import { Button, Select, Modal } from "../components/ui/index.js";
import ExportModal from "../components/ExportModal.js";
import type { BankConnection, Account, PaginatedResponse } from "@shared/types.js";
import type { BankTransaction, TransactionFilters } from "../api/pdf.js";

const BANK_LABELS: Record<string, string> = {
  tbank: "Т-Банк",
  modulbank: "Модульбанк",
  tochka: "Точка",
};

export default function BankConnectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [connection, setConnection] = useState<BankConnection | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [data, setData] = useState<PaginatedResponse<BankTransaction>>({
    data: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    window.innerWidth <= 768 ? "cards" : "table",
  );

  // Export modal
  const [exportOpen, setExportOpen] = useState(false);

  // Sync modal
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncFrom, setSyncFrom] = useState("");
  const [syncTo, setSyncTo] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResultText, setSyncResultText] = useState("");

  // Set default sync dates
  useEffect(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    setSyncTo(now.toISOString().slice(0, 10));
    setSyncFrom(from.toISOString().slice(0, 10));
  }, []);

  // Load connection + accounts
  useEffect(() => {
    if (!id) return;
    Promise.all([
      bankConnectionsApi.get(id),
      bankConnectionsApi.listLocalAccounts(id),
    ])
      .then(([conn, accs]) => {
        setConnection(conn);
        setAccounts(accs);
      })
      .catch(() => navigate("/bank-accounts"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  // Load transactions
  const loadTransactions = useCallback(
    async (f: TransactionFilters) => {
      if (!id) return;
      setTxLoading(true);
      try {
        const result = await bankConnectionsApi.listTransactions(id, f);
        setData(result);
      } finally {
        setTxLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    if (!loading) loadTransactions(filters);
  }, [filters, loadTransactions, loading]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
  }

  function handlePage(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  async function handleSync() {
    if (!id || !syncFrom || !syncTo) return;
    setSyncing(true);
    setSyncResultText("");
    try {
      const payload: SyncPayload = { from: syncFrom, to: syncTo };
      const result = await bankConnectionsApi.sync(id, payload);
      setSyncResultText(
        t("bankAccounts.syncResult", {
          saved: result.transactionsSaved,
          skipped: result.transactionsSkipped,
        }),
      );
      // Reload data
      const [conn, accs] = await Promise.all([
        bankConnectionsApi.get(id),
        bankConnectionsApi.listLocalAccounts(id),
      ]);
      setConnection(conn);
      setAccounts(accs);
      loadTransactions(filters);
    } catch (err) {
      setSyncResultText(
        t("bankAccounts.syncError", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    } finally {
      setSyncing(false);
    }
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

  if (loading) {
    return (
      <div className="bank-detail-page">
        <div className="skeleton skeleton--text" style={{ width: 200, margin: "2rem auto" }} />
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="bank-detail-page">
        <p style={{ color: "var(--text-secondary)" }}>{t("common.notFound")}</p>
      </div>
    );
  }

  const bankLabel = BANK_LABELS[connection.bankCode] || connection.bankCode;

  return (
    <div className="bank-detail-page">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button type="button" className="btn-back" onClick={() => navigate("/bank-accounts")}>
            <ArrowLeft size={20} />
          </button>
          <h1>{bankLabel}</h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button variant="secondary" size="sm" className="desktop-only" onClick={() => setExportOpen(true)}>
            <Download size={14} />
            {t("export.downloadExcel")}
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setSyncResultText(""); setSyncModalOpen(true); }}>
            <RefreshCw size={14} />
            {t("bankAccounts.sync")}
          </Button>
        </div>
      </div>

      {/* Connection info */}
      <div className="bank-detail-info">
        <div className="bank-detail-info__item">
          <span className="bank-detail-info__label">{t("bankAccounts.token")}</span>
          <span className="bank-detail-info__value" style={{ fontFamily: "monospace" }}>
            {connection.tokenMasked}
          </span>
        </div>
        <div className="bank-detail-info__item">
          <span className="bank-detail-info__label">{t("bankAccounts.lastSync")}</span>
          <span className="bank-detail-info__value">
            {connection.lastSyncAt
              ? new Date(connection.lastSyncAt).toLocaleString("ru-RU")
              : t("bankAccounts.lastSyncNever")}
          </span>
        </div>
        <div className="bank-detail-info__item">
          <span className="bank-detail-info__label">{t("bankAccounts.statusLabel")}</span>
          <span className="bank-detail-info__value">
            {connection.lastSyncStatus ? (
              <span className={`bank-card__status-badge bank-card__status-badge--${connection.lastSyncStatus}`}>
                {t(`bankAccounts.status${connection.lastSyncStatus.charAt(0).toUpperCase() + connection.lastSyncStatus.slice(1)}`)}
              </span>
            ) : (
              "—"
            )}
          </span>
        </div>
        {connection.label && (
          <div className="bank-detail-info__item">
            <span className="bank-detail-info__label">{t("bankAccounts.label")}</span>
            <span className="bank-detail-info__value">{connection.label}</span>
          </div>
        )}
      </div>

      {/* Accounts */}
      {accounts.length > 0 && (
        <div className="bank-detail-accounts">
          <h2>{t("bankAccounts.localAccounts")}</h2>
          <div className="bank-detail-accounts__list">
            {accounts.map((acc) => (
              <div key={acc.id} className="bank-detail-account-card">
                <span className="bank-detail-account-card__name">{acc.name}</span>
                {acc.accountNumber && (
                  <span className="bank-detail-account-card__number">{acc.accountNumber}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions section */}
      <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.75rem" }}>
        {t("bankAccounts.transactions")}
      </h2>

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
          {accounts.length > 1 && (
            <Select
              options={[
                { value: "", label: t("bankAccounts.allAccounts") },
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
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
      {txLoading ? (
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
                      <td colSpan={6} className="table__empty">
                        {t("bankAccounts.noTransactionsYet")}
                      </td>
                    </tr>
                  ) : (
                    data.data.map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          {formatDate(tx.date)}
                          {tx.time ? ` ${tx.time}` : ""}
                        </td>
                        <td>{tx.account.name}</td>
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="op-cards">
              {data.data.length === 0 ? (
                <div className="tab-empty">{t("bankAccounts.noTransactionsYet")}</div>
              ) : (
                data.data.map((tx) => (
                  <TransactionCard
                    key={tx.id}
                    tx={tx}
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

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={(from, to) => exportApi.downloadBankTxExcel({ from, to, connectionId: id! })}
      />

      {/* Sync Modal */}
      <Modal
        open={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        title={t("bankAccounts.sync")}
      >
        <div className="bank-modal__field">
          <label>{t("bankAccounts.syncFrom")}</label>
          <input type="date" value={syncFrom} onChange={(e) => setSyncFrom(e.target.value)} />
        </div>
        <div className="bank-modal__field">
          <label>{t("bankAccounts.syncTo")}</label>
          <input type="date" value={syncTo} onChange={(e) => setSyncTo(e.target.value)} />
        </div>
        {syncResultText && (
          <div className="bank-sync-result bank-sync-result--success" style={{ marginTop: "0.75rem" }}>
            {syncResultText}
          </div>
        )}
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setSyncModalOpen(false)}>
            {t("common.close")}
          </Button>
          <Button
            variant="primary"
            loading={syncing}
            onClick={handleSync}
            disabled={!syncFrom || !syncTo}
          >
            <RefreshCw size={14} />
            {syncing ? t("bankAccounts.syncing") : t("bankAccounts.sync")}
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
}: {
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
