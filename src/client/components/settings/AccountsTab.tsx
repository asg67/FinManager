import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Check } from "lucide-react";
import { entitiesApi } from "../../api/entities.js";
import { accountsApi, type CreateAccountPayload } from "../../api/accounts.js";
import { useAuthStore } from "../../stores/auth.js";
import { Button, Input, Select, Modal, Table, DatePicker } from "../ui/index.js";
import type { Entity, Account } from "@shared/types.js";

const ACCOUNT_TYPES = [
  { value: "checking", labelKey: "settings.typeChecking" },
  { value: "card", labelKey: "settings.typeCard" },
  { value: "cash", labelKey: "settings.typeCash" },
  { value: "deposit", labelKey: "settings.typeDeposit" },
];

const BANKS = [
  { value: "sber", label: "Сбер" },
  { value: "tbank", label: "Т-Банк" },
  { value: "module", label: "Модуль" },
  { value: "other", label: "Другой" },
];

// Standard bank codes — only these show in initial balances
const STANDARD_BANK_CODES = ["sber", "tbank", "module", "tochka", "ozon"];

interface BalanceRow {
  date: string;
  amount: string;
  saving: boolean;
  saved: boolean;
  error: boolean;
}

export default function AccountsTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === "owner";
  const isDdsOnly = user?.company?.mode === "dds_only";

  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [form, setForm] = useState<CreateAccountPayload>({ name: "", type: "checking" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [balanceRows, setBalanceRows] = useState<Record<string, BalanceRow>>({});
  const [shownBalanceIds, setShownBalanceIds] = useState<Set<string>>(new Set());
  const [balancePickerOpen, setBalancePickerOpen] = useState(false);

  useEffect(() => {
    entitiesApi.list({ mine: true }).then((data) => {
      setEntities(data);
      if (data.length > 0) setSelectedEntity(data[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedEntity) {
      setLoading(true);
      accountsApi.list(selectedEntity).then((data) => {
        setAccounts(data);
        const rows: Record<string, BalanceRow> = {};
        const shown = new Set<string>();
        for (const acc of data) {
          rows[acc.id] = {
            date: acc.initialBalanceDate ? acc.initialBalanceDate.slice(0, 10) : "",
            amount: acc.initialBalance ? String(parseFloat(acc.initialBalance)) : "",
            saving: false,
            saved: false,
            error: false,
          };
          // Show by default: cash accounts OR accounts that already have a balance set
          const hasBalance = acc.initialBalance && parseFloat(acc.initialBalance) !== 0;
          if (acc.type === "cash" || hasBalance) {
            shown.add(acc.id);
          }
        }
        setBalanceRows(rows);
        setShownBalanceIds(shown);
        setBalancePickerOpen(false);
        setLoading(false);
      });
    }
  }, [selectedEntity]);

  function openCreate() {
    setEditAccount(null);
    setForm({ name: "", type: "checking" });
    setModalOpen(true);
  }

  function openEdit(acc: Account) {
    setEditAccount(acc);
    setForm({
      name: acc.name,
      type: acc.type,
      bank: acc.bank ?? undefined,
      accountNumber: acc.accountNumber ?? undefined,
      contractNumber: acc.contractNumber ?? undefined,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editAccount) {
        await accountsApi.update(selectedEntity, editAccount.id, form);
      } else {
        await accountsApi.create(selectedEntity, form);
      }
      setModalOpen(false);
      const data = await accountsApi.list(selectedEntity);
      setAccounts(data);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await accountsApi.delete(selectedEntity, deleteId);
    setDeleteId(null);
    const data = await accountsApi.list(selectedEntity);
    setAccounts(data);
  }

  function updateBalanceRow(accId: string, field: "date" | "amount", value: string) {
    setBalanceRows((prev) => ({
      ...prev,
      [accId]: { ...prev[accId], [field]: value, saved: false, error: false },
    }));
  }

  async function saveBalance(accId: string) {
    const row = balanceRows[accId];
    if (!row) return;
    setBalanceRows((prev) => ({ ...prev, [accId]: { ...prev[accId], saving: true } }));
    try {
      await accountsApi.update(selectedEntity, accId, {
        initialBalance: row.amount || null,
        initialBalanceDate: row.date || null,
      });
      setBalanceRows((prev) => ({
        ...prev,
        [accId]: { ...prev[accId], saving: false, saved: true },
      }));
      setTimeout(() => {
        setBalanceRows((prev) => ({
          ...prev,
          [accId]: prev[accId] ? { ...prev[accId], saved: false } : prev[accId],
        }));
      }, 2000);
    } catch (err) {
      console.error("Save balance error:", err);
      setBalanceRows((prev) => ({ ...prev, [accId]: { ...prev[accId], saving: false, error: true } }));
    }
  }

  function renderBalanceRow(acc: Account) {
    const row = balanceRows[acc.id];
    if (!row) return null;
    return (
      <div key={acc.id} className="initial-balances__row">
        <span className="initial-balances__name">{acc.name}</span>
        <div className="initial-balances__fields">
          <DatePicker
            label={t("settings.balanceDate")}
            value={row.date}
            onChange={(val) => updateBalanceRow(acc.id, "date", val)}
          />
          <Input
            type="number"
            step="0.01"
            label={t("settings.balanceAmount")}
            placeholder="0.00"
            value={row.amount}
            onChange={(e) => updateBalanceRow(acc.id, "amount", e.target.value)}
            className="initial-balances__amount"
          />
          <button
            type="button"
            className={`btn btn--sm initial-balances__save ${row.saved ? "initial-balances__save--ok" : ""} ${row.error ? "initial-balances__save--error" : ""}`}
            onClick={() => saveBalance(acc.id)}
            disabled={row.saving}
          >
            <Check size={16} />
            {row.saved ? t("settings.balanceSaved") : row.error ? t("common.error") : t("common.save")}
          </button>
        </div>
      </div>
    );
  }

  function renderBalancesList() {
    // All eligible accounts: standard bank accounts (excluding disabled) + cash
    const disabledBanks = user?.disabledBanks ?? [];
    const allEligible = accounts.filter(
      (a) =>
        a.type === "cash" ||
        (a.bank && STANDARD_BANK_CODES.includes(a.bank) && !disabledBanks.includes(a.bank)),
    );
    if (allEligible.length === 0) return null;

    // Only show accounts that are in the shown set
    const visibleAccounts = allEligible.filter((a) => shownBalanceIds.has(a.id));
    const hiddenAccounts = allEligible.filter((a) => !shownBalanceIds.has(a.id));

    const checkingAccounts = visibleAccounts.filter((a) => a.type === "checking");
    const otherAccounts = visibleAccounts.filter((a) => a.type !== "checking");

    function addBalanceAccount(accId: string) {
      setShownBalanceIds((prev) => new Set([...prev, accId]));
      setBalancePickerOpen(false);
    }

    return (
      <div className="initial-balances">
        <div className="initial-balances__header">
          <h3 className="initial-balances__title">{t("settings.initialBalances")}</h3>
          {hiddenAccounts.length > 0 && (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="btn btn--sm btn--outline"
                onClick={() => setBalancePickerOpen(!balancePickerOpen)}
              >
                <Plus size={14} />
                {t("settings.addBalanceAccount")}
              </button>
              {balancePickerOpen && (
                <div className="initial-balances__picker">
                  {hiddenAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      className="initial-balances__picker-item"
                      onClick={() => addBalanceAccount(acc.id)}
                    >
                      {acc.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {checkingAccounts.length > 0 && (
          <div className="initial-balances__group">
            <h4 className="initial-balances__group-title">{t("settings.balanceChecking")}</h4>
            <div className="initial-balances__list">
              {checkingAccounts.map(renderBalanceRow)}
            </div>
          </div>
        )}

        {otherAccounts.length > 0 && (
          <div className="initial-balances__group">
            <h4 className="initial-balances__group-title">{t("settings.balanceCards")}</h4>
            <div className="initial-balances__list">
              {otherAccounts.map(renderBalanceRow)}
            </div>
          </div>
        )}

        {visibleAccounts.length === 0 && (
          <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
            {t("settings.noBalanceAccountsYet")}
          </p>
        )}
      </div>
    );
  }

  const typeLabel = (type: string) => {
    const found = ACCOUNT_TYPES.find((a) => a.value === type);
    return found ? t(found.labelKey) : type;
  };

  const bankLabel = (bank: string | null) => {
    if (!bank) return "—";
    return BANKS.find((b) => b.value === bank)?.label ?? bank;
  };

  const showBank = form.type !== "cash";

  const columns = [
    { key: "name", header: t("settings.accountName") },
    { key: "type", header: t("settings.accountType"), render: (r: Account) => typeLabel(r.type) },
    { key: "bank", header: t("settings.bank"), render: (r: Account) => bankLabel(r.bank) },
    {
      key: "actions",
      header: "",
      className: "table-actions",
      render: (row: Account) => (
        <div className="table-actions-cell">
          <button type="button" className="icon-btn" onClick={() => openEdit(row)} title={t("common.edit")}>
            <Pencil size={16} />
          </button>
          <button type="button" className="icon-btn icon-btn--danger" onClick={() => setDeleteId(row.id)} title={t("common.delete")}>
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  // Members: only show initial balances
  if (!isOwner) {
    return (
      <div>
        {entities.length > 1 && (
          <div className="tab-header">
            <Select
              options={entities.map((e) => ({ value: e.id, label: e.name }))}
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              label={t("settings.selectEntity")}
            />
          </div>
        )}
        {isDdsOnly ? null : loading ? (
          <div className="tab-loading">{t("common.loading")}</div>
        ) : accounts.length > 0 ? (
          renderBalancesList()
        ) : (
          <div className="tab-empty">{t("settings.noAccounts")}</div>
        )}
      </div>
    );
  }

  // Owner: full CRUD + initial balances
  return (
    <div>
      <div className="tab-header">
        {entities.length > 1 && (
          <Select
            options={entities.map((e) => ({ value: e.id, label: e.name }))}
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            label={t("settings.selectEntity")}
          />
        )}
        <Button size="sm" onClick={openCreate} disabled={!selectedEntity}>
          <Plus size={16} />
          {t("settings.addAccount")}
        </Button>
      </div>

      {loading ? (
        <div className="tab-loading">{t("common.loading")}</div>
      ) : (
        <>
          <Table columns={columns} data={accounts} rowKey={(r) => r.id} emptyMessage={t("settings.noAccounts")} />
          {!isDdsOnly && renderBalancesList()}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editAccount ? t("settings.editAccount") : t("settings.addAccount")}>
        <form onSubmit={handleSubmit}>
          <Input label={t("settings.accountName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
          <Select label={t("settings.accountType")} options={ACCOUNT_TYPES.map((a) => ({ value: a.value, label: t(a.labelKey) }))} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
          {showBank && <Select label={t("settings.bank")} options={BANKS} value={form.bank ?? ""} onChange={(e) => setForm({ ...form, bank: e.target.value || undefined })} placeholder={t("settings.selectBank")} />}
          {showBank && <Input label={t("settings.accountNumber")} value={form.accountNumber ?? ""} onChange={(e) => setForm({ ...form, accountNumber: e.target.value || undefined })} />}
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={saving}>{t("common.save")}</Button>
          </Modal.Footer>
        </form>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title={t("common.confirmDelete")} size="sm">
        <p>{t("settings.deleteAccountConfirm")}</p>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteId(null)}>{t("common.cancel")}</Button>
          <Button variant="danger" onClick={handleDelete}>{t("common.delete")}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
