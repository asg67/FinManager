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

interface BalanceRow {
  date: string;
  amount: string;
  saving: boolean;
  saved: boolean;
}

export default function AccountsTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === "owner";

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
        for (const acc of data) {
          rows[acc.id] = {
            date: acc.initialBalanceDate ? acc.initialBalanceDate.slice(0, 10) : "",
            amount: acc.initialBalance ? String(parseFloat(acc.initialBalance)) : "",
            saving: false,
            saved: false,
          };
        }
        setBalanceRows(rows);
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
      [accId]: { ...prev[accId], [field]: value, saved: false },
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
    } catch {
      setBalanceRows((prev) => ({ ...prev, [accId]: { ...prev[accId], saving: false } }));
    }
  }

  function renderBalancesList() {
    // Only show accounts with a bank (i.e. real bank accounts, not cash/manual DDS ones)
    const bankAccounts = accounts.filter((a) => a.bank);
    if (bankAccounts.length === 0) return null;
    return (
      <div className="initial-balances">
        <h3 className="initial-balances__title">{t("settings.initialBalances")}</h3>
        <div className="initial-balances__list">
          {bankAccounts.map((acc) => {
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
                    className={`btn btn--sm initial-balances__save ${row.saved ? "initial-balances__save--ok" : ""}`}
                    onClick={() => saveBalance(acc.id)}
                    disabled={row.saving}
                  >
                    <Check size={16} />
                    {row.saved ? t("settings.balanceSaved") : t("common.save")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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
        {loading ? (
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
        <Select
          options={entities.map((e) => ({ value: e.id, label: e.name }))}
          value={selectedEntity}
          onChange={(e) => setSelectedEntity(e.target.value)}
          label={t("settings.selectEntity")}
        />
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
          {renderBalancesList()}
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
