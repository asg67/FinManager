import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Landmark, Plus, RefreshCw, Trash2, CheckCircle, XCircle, Plug } from "lucide-react";
import { entitiesApi } from "../api/entities.js";
import { bankConnectionsApi, type CreateBankConnectionPayload, type SyncPayload } from "../api/bankConnections.js";
import { Button, Modal } from "../components/ui/index.js";
import type { Entity, BankConnection, BankCode, SyncResult } from "@shared/types.js";

const BANKS: { code: BankCode; labelKey: string }[] = [
  { code: "tbank", labelKey: "bankAccounts.tbank" },
  { code: "modulbank", labelKey: "bankAccounts.modulbank" },
  { code: "tochka", labelKey: "bankAccounts.tochka" },
];

export default function BankAccounts() {
  const { t } = useTranslation();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addBankCode, setAddBankCode] = useState<BankCode>("tbank");
  const [addToken, setAddToken] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Sync modal
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncConnId, setSyncConnId] = useState("");
  const [syncFrom, setSyncFrom] = useState("");
  const [syncTo, setSyncTo] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState("");

  // Test
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; count?: number }>>({});

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Load entities on mount
  useEffect(() => {
    entitiesApi.list({ mine: true }).then((data) => {
      setEntities(data);
      if (data.length > 0) setSelectedEntity(data[0].id);
      setLoading(false);
    });
  }, []);

  // Load connections when entity changes
  useEffect(() => {
    if (!selectedEntity) {
      setConnections([]);
      return;
    }
    setLoading(true);
    bankConnectionsApi
      .list(selectedEntity)
      .then(setConnections)
      .catch(() => setConnections([]))
      .finally(() => setLoading(false));
  }, [selectedEntity]);

  // Default date range: last 30 days
  useEffect(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    setSyncTo(now.toISOString().slice(0, 10));
    setSyncFrom(from.toISOString().slice(0, 10));
  }, []);

  function getConnection(bankCode: BankCode): BankConnection | undefined {
    return connections.find((c) => c.bankCode === bankCode);
  }

  // --- Add / Edit ---

  function openAddModal(bankCode: BankCode, existingConn?: BankConnection) {
    setAddBankCode(bankCode);
    setAddToken("");
    setAddLabel(existingConn?.label || "");
    setEditingId(existingConn?.id || null);
    setAddModalOpen(true);
  }

  // Auto-sync state
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [autoSyncResult, setAutoSyncResult] = useState<SyncResult | null>(null);

  async function handleSave() {
    if (!addToken.trim() && !editingId) return;
    setAddSaving(true);
    try {
      let createdConn: BankConnection | null = null;

      if (editingId) {
        await bankConnectionsApi.update(editingId, {
          ...(addToken.trim() ? { token: addToken.trim() } : {}),
          label: addLabel.trim() || undefined,
        });
      } else {
        const payload: CreateBankConnectionPayload = {
          entityId: selectedEntity,
          bankCode: addBankCode,
          token: addToken.trim(),
          label: addLabel.trim() || undefined,
        };
        createdConn = await bankConnectionsApi.create(payload);
      }
      // Reload
      const updated = await bankConnectionsApi.list(selectedEntity);
      setConnections(updated);
      setAddModalOpen(false);

      // Auto-sync last 2 months for newly created connections
      if (createdConn) {
        const now = new Date();
        const twoMonthsAgo = new Date(now);
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        const fromStr = twoMonthsAgo.toISOString().slice(0, 10);
        const toStr = now.toISOString().slice(0, 10);

        setAutoSyncing(true);
        setAutoSyncResult(null);
        try {
          const result = await bankConnectionsApi.sync(createdConn.id, { from: fromStr, to: toStr });
          setAutoSyncResult(result);
          // Reload connections to update lastSync status
          const refreshed = await bankConnectionsApi.list(selectedEntity);
          setConnections(refreshed);
        } catch (err) {
          console.error("Auto-sync error:", err);
        } finally {
          setAutoSyncing(false);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddSaving(false);
    }
  }

  // --- Test ---

  async function handleTest(conn: BankConnection) {
    setTestingId(conn.id);
    try {
      const result = await bankConnectionsApi.test(conn.id);
      setTestResults((prev) => ({
        ...prev,
        [conn.id]: { ok: result.ok, count: result.accountCount },
      }));
    } catch {
      setTestResults((prev) => ({ ...prev, [conn.id]: { ok: false } }));
    } finally {
      setTestingId(null);
    }
  }

  // --- Sync ---

  function openSyncModal(connId: string) {
    setSyncConnId(connId);
    setSyncResult(null);
    setSyncError("");
    setSyncModalOpen(true);
  }

  async function handleSync() {
    if (!syncFrom || !syncTo) return;
    setSyncing(true);
    setSyncResult(null);
    setSyncError("");
    try {
      const payload: SyncPayload = { from: syncFrom, to: syncTo };
      const result = await bankConnectionsApi.sync(syncConnId, payload);
      setSyncResult(result);
      // Reload connections to update lastSync
      const updated = await bankConnectionsApi.list(selectedEntity);
      setConnections(updated);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  // --- Delete ---

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await bankConnectionsApi.delete(deleteId);
      setConnections((prev) => prev.filter((c) => c.id !== deleteId));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteId(null);
    }
  }

  // --- Render ---

  if (loading && entities.length === 0) {
    return (
      <div className="bank-accounts-page">
        <div className="skeleton skeleton--text" style={{ width: 200, margin: "2rem auto" }} />
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="bank-accounts-page">
        <div className="page-header">
          <h1>{t("bankAccounts.title")}</h1>
        </div>
        <p style={{ color: "var(--text-secondary)" }}>{t("bankAccounts.noEntities")}</p>
      </div>
    );
  }

  return (
    <div className="bank-accounts-page">
      <div className="page-header">
        <h1>{t("bankAccounts.title")}</h1>
      </div>

      {/* Entity selector */}
      <div className="bank-entity-select">
        <select
          value={selectedEntity}
          onChange={(e) => setSelectedEntity(e.target.value)}
        >
          {entities.map((ent) => (
            <option key={ent.id} value={ent.id}>
              {ent.name}
            </option>
          ))}
        </select>
      </div>

      {/* Auto-sync banner */}
      {autoSyncing && (
        <div className="bank-sync-result bank-sync-result--success" style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <RefreshCw size={14} className="spinning" />
          {t("bankAccounts.autoSyncing")}
        </div>
      )}
      {!autoSyncing && autoSyncResult && (
        <div className="bank-sync-result bank-sync-result--success" style={{ marginBottom: "1rem" }}>
          {t("bankAccounts.autoSyncDone", {
            saved: autoSyncResult.transactionsSaved,
            skipped: autoSyncResult.transactionsSkipped,
          })}
          <button
            type="button"
            onClick={() => setAutoSyncResult(null)}
            style={{ marginLeft: "0.5rem", background: "none", border: "none", color: "inherit", cursor: "pointer", textDecoration: "underline", fontSize: "inherit" }}
          >
            {t("common.close")}
          </button>
        </div>
      )}

      {/* Bank cards */}
      <div className="bank-cards">
        {BANKS.map(({ code, labelKey }) => {
          const conn = getConnection(code);
          const testResult = conn ? testResults[conn.id] : undefined;
          const isTesting = conn?.id === testingId;

          return (
            <div
              key={code}
              className={`bank-card ${!conn ? "bank-card--disconnected" : ""}`}
            >
              <div className="bank-card__header">
                <div className="bank-card__bank-name">
                  <Landmark size={20} />
                  {t(labelKey)}
                </div>
              </div>

              {conn ? (
                <>
                  <div className="bank-card__token">
                    {t("bankAccounts.token")}: {conn.tokenMasked}
                  </div>

                  <div className="bank-card__status">
                    <span>
                      {t("bankAccounts.lastSync")}:{" "}
                      {conn.lastSyncAt
                        ? new Date(conn.lastSyncAt).toLocaleString("ru-RU")
                        : t("bankAccounts.lastSyncNever")}
                    </span>
                    {conn.lastSyncStatus && (
                      <span
                        className={`bank-card__status-badge bank-card__status-badge--${conn.lastSyncStatus}`}
                      >
                        {t(`bankAccounts.status${conn.lastSyncStatus.charAt(0).toUpperCase() + conn.lastSyncStatus.slice(1)}`)}
                      </span>
                    )}
                    {testResult && (
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        {testResult.ok ? (
                          <>
                            <CheckCircle size={14} style={{ color: "var(--color-income)" }} />
                            <span style={{ color: "var(--color-income)", fontSize: "0.8125rem" }}>
                              {t("bankAccounts.testSuccess")}
                              {testResult.count != null && ` (${t("bankAccounts.accounts", { count: testResult.count })})`}
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle size={14} style={{ color: "var(--color-expense)" }} />
                            <span style={{ color: "var(--color-expense)", fontSize: "0.8125rem" }}>
                              {t("bankAccounts.testFailed")}
                            </span>
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="bank-card__actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={isTesting}
                      onClick={() => handleTest(conn)}
                    >
                      <Plug size={14} />
                      {isTesting ? t("bankAccounts.testing") : t("bankAccounts.testConnection")}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => openSyncModal(conn.id)}
                    >
                      <RefreshCw size={14} />
                      {t("bankAccounts.sync")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openAddModal(code, conn)}
                    >
                      {t("bankAccounts.editConnection")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(conn.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="bank-card__connect-btn"
                  onClick={() => openAddModal(code)}
                >
                  <Plus size={16} />
                  {t("bankAccounts.connect")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={editingId ? t("bankAccounts.editConnection") : t("bankAccounts.addConnection")}
      >
        <div className="bank-modal__field">
          <label>{t("bankAccounts.token")}</label>
          <textarea
            value={addToken}
            onChange={(e) => setAddToken(e.target.value)}
            placeholder={editingId ? "(leave empty to keep current)" : t("bankAccounts.tokenPlaceholder")}
          />
        </div>
        <div className="bank-modal__field">
          <label>{t("bankAccounts.label")}</label>
          <input
            value={addLabel}
            onChange={(e) => setAddLabel(e.target.value)}
            placeholder={t("bankAccounts.labelPlaceholder")}
          />
        </div>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setAddModalOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            loading={addSaving}
            onClick={handleSave}
            disabled={!addToken.trim() && !editingId}
          >
            {t("common.save")}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Sync Modal */}
      <Modal
        open={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        title={t("bankAccounts.sync")}
      >
        <div className="bank-modal__field">
          <label>{t("bankAccounts.syncFrom")}</label>
          <input
            type="date"
            value={syncFrom}
            onChange={(e) => setSyncFrom(e.target.value)}
          />
        </div>
        <div className="bank-modal__field">
          <label>{t("bankAccounts.syncTo")}</label>
          <input
            type="date"
            value={syncTo}
            onChange={(e) => setSyncTo(e.target.value)}
          />
        </div>

        {syncResult && (
          <div className="bank-sync-result bank-sync-result--success">
            {t("bankAccounts.syncResult", {
              saved: syncResult.transactionsSaved,
              skipped: syncResult.transactionsSkipped,
            })}
          </div>
        )}
        {syncError && (
          <div className="bank-sync-result bank-sync-result--error">
            {t("bankAccounts.syncError", { error: syncError })}
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

      {/* Delete Confirm Modal */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={t("bankAccounts.deleteConnection")}
        size="sm"
      >
        <p style={{ color: "var(--text-secondary)", margin: "0 0 1rem" }}>
          {t("bankAccounts.deleteConfirm")}
        </p>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteId(null)}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            {t("common.delete")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
