import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { entitiesApi } from "../../api/entities.js";
import { accountsApi, type CreateAccountPayload } from "../../api/accounts.js";
import { Button, Input, Select, Modal, Table } from "../ui/index.js";
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

export default function AccountsTab() {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [form, setForm] = useState<CreateAccountPayload>({ name: "", type: "checking" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    entitiesApi.list().then((data) => {
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
        <Table columns={columns} data={accounts} rowKey={(r) => r.id} emptyMessage={t("settings.noAccounts")} />
      )}

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editAccount ? t("settings.editAccount") : t("settings.addAccount")}>
        <form onSubmit={handleSubmit}>
          <Input
            label={t("settings.accountName")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoFocus
          />
          <Select
            label={t("settings.accountType")}
            options={ACCOUNT_TYPES.map((a) => ({ value: a.value, label: t(a.labelKey) }))}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          />
          {showBank && (
            <Select
              label={t("settings.bank")}
              options={BANKS}
              value={form.bank ?? ""}
              onChange={(e) => setForm({ ...form, bank: e.target.value || undefined })}
              placeholder={t("settings.selectBank")}
            />
          )}
          {showBank && (
            <Input
              label={t("settings.accountNumber")}
              value={form.accountNumber ?? ""}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value || undefined })}
            />
          )}
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={saving}>
              {t("common.save")}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title={t("common.confirmDelete")} size="sm">
        <p>{t("settings.deleteAccountConfirm")}</p>
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
