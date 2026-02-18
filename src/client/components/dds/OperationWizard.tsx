import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ddsApi, type CreateOperationPayload } from "../../api/dds.js";
import { accountsApi } from "../../api/accounts.js";
import { companyApi } from "../../api/company.js";
import { Button, Input, Select, Modal } from "../ui/index.js";
import type { Entity, Account, ExpenseType, DdsOperation, DdsTemplate } from "@shared/types.js";

const OP_TYPES = [
  { value: "income", labelKey: "dds.income" },
  { value: "expense", labelKey: "dds.expense" },
  { value: "transfer", labelKey: "dds.transfer" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  editOperation: DdsOperation | null;
  entities: Entity[];
}

export default function OperationWizard({ open, onClose, onDone, editOperation, entities }: Props) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [templates, setTemplates] = useState<DdsTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<CreateOperationPayload>({
    operationType: "income",
    amount: 0,
    entityId: "",
  });

  // Initialize form
  useEffect(() => {
    if (!open) return;
    setError("");
    if (editOperation) {
      setForm({
        operationType: editOperation.operationType,
        amount: parseFloat(editOperation.amount),
        entityId: editOperation.entityId,
        fromAccountId: editOperation.fromAccountId ?? undefined,
        toAccountId: editOperation.toAccountId ?? undefined,
        expenseTypeId: editOperation.expenseTypeId ?? undefined,
        expenseArticleId: editOperation.expenseArticleId ?? undefined,
        orderNumber: editOperation.orderNumber ?? undefined,
        comment: editOperation.comment ?? undefined,
      });
    } else {
      setForm({
        operationType: "income",
        amount: 0,
        entityId: entities[0]?.id ?? "",
      });
      ddsApi.listTemplates().then(setTemplates);
    }
  }, [open, editOperation, entities]);

  // Load expense types once (company-wide)
  useEffect(() => {
    if (open) companyApi.listExpenseTypes().then(setExpenseTypes);
  }, [open]);

  // Load accounts when entity changes
  useEffect(() => {
    if (form.entityId) {
      accountsApi.list(form.entityId).then(setAccounts);
    }
  }, [form.entityId]);

  function applyTemplate(tpl: DdsTemplate) {
    setForm({
      operationType: tpl.operationType,
      amount: 0,
      entityId: tpl.entityId,
      fromAccountId: tpl.fromAccountId ?? undefined,
      toAccountId: tpl.toAccountId ?? undefined,
      expenseTypeId: tpl.expenseTypeId ?? undefined,
      expenseArticleId: tpl.expenseArticleId ?? undefined,
    });
  }

  function updateField<K extends keyof CreateOperationPayload>(key: K, value: CreateOperationPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editOperation) {
        await ddsApi.updateOperation(editOperation.id, {
          amount: form.amount,
          fromAccountId: form.fromAccountId ?? null,
          toAccountId: form.toAccountId ?? null,
          expenseTypeId: form.expenseTypeId ?? null,
          expenseArticleId: form.expenseArticleId ?? null,
          orderNumber: form.orderNumber ?? null,
          comment: form.comment ?? null,
        });
      } else {
        await ddsApi.createOperation(form);
      }
      onDone();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const selectedExpenseType = expenseTypes.find((et) => et.id === form.expenseTypeId);
  const isIncome = form.operationType === "income";
  const isExpense = form.operationType === "expense";
  const isTransfer = form.operationType === "transfer";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editOperation ? t("dds.editOperation") : t("dds.addOperation")}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="wizard-form">
        {/* Templates (only for create) */}
        {!editOperation && templates.length > 0 && (
          <div className="wizard-templates">
            <label className="input-field__label">{t("dds.fromTemplate")}</label>
            <div className="wizard-templates__list">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className="wizard-template-btn"
                  onClick={() => applyTemplate(tpl)}
                >
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Entity */}
        {!editOperation && (
          <Select
            label={t("dds.entity")}
            options={entities.map((e) => ({ value: e.id, label: e.name }))}
            value={form.entityId}
            onChange={(e) => updateField("entityId", e.target.value)}
          />
        )}

        {/* Operation type */}
        {!editOperation && (
          <div className="wizard-op-types">
            <label className="input-field__label">{t("dds.operationType")}</label>
            <div className="wizard-op-types__btns">
              {OP_TYPES.map((op) => (
                <button
                  key={op.value}
                  type="button"
                  className={`op-type-btn op-type-btn--${op.value} ${form.operationType === op.value ? "op-type-btn--active" : ""}`}
                  onClick={() => updateField("operationType", op.value)}
                >
                  {t(op.labelKey)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* From Account (expense, transfer) */}
        {(isExpense || isTransfer) && (
          <Select
            label={t("dds.fromAccount")}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            value={form.fromAccountId ?? ""}
            onChange={(e) => updateField("fromAccountId", e.target.value || undefined)}
            placeholder={t("common.select")}
          />
        )}

        {/* To Account (income, transfer) */}
        {(isIncome || isTransfer) && (
          <Select
            label={t("dds.toAccount")}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            value={form.toAccountId ?? ""}
            onChange={(e) => updateField("toAccountId", e.target.value || undefined)}
            placeholder={t("common.select")}
          />
        )}

        {/* Expense type & article */}
        {isExpense && (
          <>
            <Select
              label={t("dds.expenseType")}
              options={expenseTypes.map((et) => ({ value: et.id, label: et.name }))}
              value={form.expenseTypeId ?? ""}
              onChange={(e) => {
                updateField("expenseTypeId", e.target.value || undefined);
                updateField("expenseArticleId", undefined);
              }}
              placeholder={t("common.select")}
            />
            {selectedExpenseType && selectedExpenseType.articles.length > 0 && (
              <Select
                label={t("dds.expenseArticle")}
                options={selectedExpenseType.articles.map((a) => ({ value: a.id, label: a.name }))}
                value={form.expenseArticleId ?? ""}
                onChange={(e) => updateField("expenseArticleId", e.target.value || undefined)}
                placeholder={t("common.select")}
              />
            )}
            <Input
              label={t("dds.orderNumber")}
              value={form.orderNumber ?? ""}
              onChange={(e) => updateField("orderNumber", e.target.value || undefined)}
            />
          </>
        )}

        {/* Amount */}
        <Input
          label={t("dds.amount")}
          type="number"
          min={0.01}
          step={0.01}
          value={form.amount || ""}
          onChange={(e) => updateField("amount", parseFloat(e.target.value) || 0)}
          required
        />

        {/* Comment */}
        <Input
          label={t("dds.comment")}
          value={form.comment ?? ""}
          onChange={(e) => updateField("comment", e.target.value || undefined)}
        />

        {error && <div className="wizard-error">{error}</div>}

        <Modal.Footer>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={saving}>
            {editOperation ? t("common.save") : t("dds.create")}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
