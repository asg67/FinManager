import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ddsApi, type CreateTemplatePayload } from "../../api/dds.js";
import { entitiesApi } from "../../api/entities.js";
import { accountsApi } from "../../api/accounts.js";
import { expensesApi } from "../../api/expenses.js";
import { Button, Input, Select, Modal, Table } from "../ui/index.js";
import type { Entity, Account, ExpenseType, DdsTemplate } from "@shared/types.js";

const OP_TYPES = [
  { value: "income", labelKey: "dds.income" },
  { value: "expense", labelKey: "dds.expense" },
  { value: "transfer", labelKey: "dds.transfer" },
];

export default function TemplatesTab() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<DdsTemplate[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<DdsTemplate | null>(null);
  const [form, setForm] = useState<CreateTemplatePayload>({
    name: "",
    operationType: "income",
    entityId: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    try {
      const [tpls, ents] = await Promise.all([ddsApi.listTemplates(), entitiesApi.list()]);
      setTemplates(tpls);
      setEntities(ents);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Load accounts/expenses when entity changes in form
  useEffect(() => {
    if (form.entityId) {
      Promise.all([accountsApi.list(form.entityId), expensesApi.listTypes(form.entityId)]).then(
        ([accs, types]) => {
          setAccounts(accs);
          setExpenseTypes(types);
        },
      );
    } else {
      setAccounts([]);
      setExpenseTypes([]);
    }
  }, [form.entityId]);

  function openCreate() {
    setEditTemplate(null);
    setForm({ name: "", operationType: "income", entityId: entities[0]?.id ?? "" });
    setModalOpen(true);
  }

  function openEdit(tpl: DdsTemplate) {
    setEditTemplate(tpl);
    setForm({
      name: tpl.name,
      operationType: tpl.operationType,
      entityId: tpl.entityId,
      fromAccountId: tpl.fromAccountId ?? undefined,
      toAccountId: tpl.toAccountId ?? undefined,
      expenseTypeId: tpl.expenseTypeId ?? undefined,
      expenseArticleId: tpl.expenseArticleId ?? undefined,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editTemplate) {
        await ddsApi.updateTemplate(editTemplate.id, { name: form.name });
      } else {
        await ddsApi.createTemplate(form);
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await ddsApi.deleteTemplate(deleteId);
    setDeleteId(null);
    await load();
  }

  const opLabel = (op: string) => {
    const found = OP_TYPES.find((o) => o.value === op);
    return found ? t(found.labelKey) : op;
  };

  const columns = [
    { key: "name", header: t("settings.templateName") },
    {
      key: "operationType",
      header: t("dds.operationType"),
      render: (r: DdsTemplate) => (
        <span className={`op-badge op-badge--${r.operationType}`}>{opLabel(r.operationType)}</span>
      ),
    },
    { key: "entity", header: t("settings.entity"), render: (r: DdsTemplate) => r.entity?.name ?? "" },
    { key: "expenseType", header: t("settings.expenseType"), render: (r: DdsTemplate) => r.expenseType?.name ?? "—" },
    {
      key: "actions",
      header: "",
      className: "table-actions",
      render: (row: DdsTemplate) => (
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

  const selectedExpenseType = expenseTypes.find((et) => et.id === form.expenseTypeId);

  if (loading) return <div className="tab-loading">{t("common.loading")}</div>;

  return (
    <div>
      <div className="tab-header">
        <Button size="sm" onClick={openCreate}>
          <Plus size={16} />
          {t("settings.addTemplate")}
        </Button>
      </div>

      <Table columns={columns} data={templates} rowKey={(r) => r.id} emptyMessage={t("settings.noTemplates")} />

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTemplate ? t("settings.editTemplate") : t("settings.addTemplate")} size="lg">
        <form onSubmit={handleSubmit}>
          <Input
            label={t("settings.templateName")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoFocus
          />
          {!editTemplate && (
            <>
              <Select
                label={t("dds.operationType")}
                options={OP_TYPES.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                value={form.operationType}
                onChange={(e) => setForm({ ...form, operationType: e.target.value })}
              />
              <Select
                label={t("settings.entity")}
                options={entities.map((e) => ({ value: e.id, label: e.name }))}
                value={form.entityId}
                onChange={(e) => setForm({ ...form, entityId: e.target.value })}
              />
              {(form.operationType === "expense" || form.operationType === "transfer") && (
                <Select
                  label={t("dds.fromAccount")}
                  options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                  value={form.fromAccountId ?? ""}
                  onChange={(e) => setForm({ ...form, fromAccountId: e.target.value || undefined })}
                  placeholder={t("common.select")}
                />
              )}
              {(form.operationType === "income" || form.operationType === "transfer") && (
                <Select
                  label={t("dds.toAccount")}
                  options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                  value={form.toAccountId ?? ""}
                  onChange={(e) => setForm({ ...form, toAccountId: e.target.value || undefined })}
                  placeholder={t("common.select")}
                />
              )}
              {form.operationType === "expense" && (
                <>
                  <Select
                    label={t("settings.expenseType")}
                    options={expenseTypes.map((et) => ({ value: et.id, label: et.name }))}
                    value={form.expenseTypeId ?? ""}
                    onChange={(e) => setForm({ ...form, expenseTypeId: e.target.value || undefined, expenseArticleId: undefined })}
                    placeholder={t("common.select")}
                  />
                  {selectedExpenseType && selectedExpenseType.articles.length > 0 && (
                    <Select
                      label={t("settings.expenseArticle")}
                      options={selectedExpenseType.articles.map((a) => ({ value: a.id, label: a.name }))}
                      value={form.expenseArticleId ?? ""}
                      onChange={(e) => setForm({ ...form, expenseArticleId: e.target.value || undefined })}
                      placeholder={t("common.select")}
                    />
                  )}
                </>
              )}
            </>
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
        <p>{t("settings.deleteTemplateConfirm")}</p>
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
