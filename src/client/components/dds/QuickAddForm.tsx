import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Save } from "lucide-react";
import { ddsApi, type CreateOperationPayload } from "../../api/dds.js";
import { accountsApi } from "../../api/accounts.js";
import { expensesApi } from "../../api/expenses.js";
import { Button, Input, Select } from "../ui/index.js";
import type { Entity, Account, ExpenseType, DdsTemplate } from "@shared/types.js";

const OP_TYPES = [
  { value: "income", labelKey: "dds.income" },
  { value: "expense", labelKey: "dds.expense" },
  { value: "transfer", labelKey: "dds.transfer" },
];

interface Props {
  entities: Entity[];
  onSaved: () => void;
}

export default function QuickAddForm({ entities, onSaved }: Props) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [templates, setTemplates] = useState<DdsTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<CreateOperationPayload>({
    operationType: "expense",
    amount: 0,
    entityId: entities[0]?.id ?? "",
  });

  // Load templates once
  useEffect(() => {
    ddsApi.listTemplates().then(setTemplates);
  }, []);

  // Set default entity when entities load
  useEffect(() => {
    if (!form.entityId && entities.length > 0) {
      setForm((prev) => ({ ...prev, entityId: entities[0].id }));
    }
  }, [entities, form.entityId]);

  // Load accounts and expense types when entity changes
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

  function updateField<K extends keyof CreateOperationPayload>(key: K, value: CreateOperationPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await ddsApi.createOperation(form);
      // Reset form but keep entity and operation type
      setForm((prev) => ({
        operationType: prev.operationType,
        amount: 0,
        entityId: prev.entityId,
      }));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 1500);
      onSaved();
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
    <form onSubmit={handleSubmit} className="quick-add">
      {/* Templates */}
      {templates.length > 0 && (
        <div className="quick-add__templates">
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
      )}

      <div className="quick-add__row">
        {/* Entity */}
        <Select
          options={entities.map((e) => ({ value: e.id, label: e.name }))}
          value={form.entityId}
          onChange={(e) => {
            updateField("entityId", e.target.value);
            updateField("fromAccountId", undefined);
            updateField("toAccountId", undefined);
            updateField("expenseTypeId", undefined);
            updateField("expenseArticleId", undefined);
          }}
        />

        {/* Operation type buttons */}
        <div className="quick-add__op-types">
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

      <div className="quick-add__row">
        {/* From Account (expense, transfer) */}
        {(isExpense || isTransfer) && (
          <Select
            placeholder={t("dds.fromAccount")}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            value={form.fromAccountId ?? ""}
            onChange={(e) => updateField("fromAccountId", e.target.value || undefined)}
          />
        )}

        {/* To Account (income, transfer) */}
        {(isIncome || isTransfer) && (
          <Select
            placeholder={t("dds.toAccount")}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            value={form.toAccountId ?? ""}
            onChange={(e) => updateField("toAccountId", e.target.value || undefined)}
          />
        )}

        {/* Expense type */}
        {isExpense && (
          <Select
            placeholder={t("dds.expenseType")}
            options={expenseTypes.map((et) => ({ value: et.id, label: et.name }))}
            value={form.expenseTypeId ?? ""}
            onChange={(e) => {
              updateField("expenseTypeId", e.target.value || undefined);
              updateField("expenseArticleId", undefined);
            }}
          />
        )}

        {/* Expense article */}
        {isExpense && selectedExpenseType && selectedExpenseType.articles.length > 0 && (
          <Select
            placeholder={t("dds.expenseArticle")}
            options={selectedExpenseType.articles.map((a) => ({ value: a.id, label: a.name }))}
            value={form.expenseArticleId ?? ""}
            onChange={(e) => updateField("expenseArticleId", e.target.value || undefined)}
          />
        )}
      </div>

      <div className="quick-add__row">
        {/* Amount */}
        <Input
          type="number"
          min={0.01}
          step={0.01}
          value={form.amount || ""}
          onChange={(e) => updateField("amount", parseFloat(e.target.value) || 0)}
          placeholder={t("dds.amount")}
          required
        />

        {/* Order number (expense only) */}
        {isExpense && (
          <Input
            value={form.orderNumber ?? ""}
            onChange={(e) => updateField("orderNumber", e.target.value || undefined)}
            placeholder={t("dds.orderNumber")}
          />
        )}

        {/* Comment */}
        <Input
          value={form.comment ?? ""}
          onChange={(e) => updateField("comment", e.target.value || undefined)}
          placeholder={t("dds.comment")}
        />

        {/* Save button */}
        <Button type="submit" loading={saving} className={success ? "btn--success" : ""}>
          <Save size={16} />
          {t("common.save")}
        </Button>
      </div>

      {error && <div className="quick-add__error">{error}</div>}
    </form>
  );
}
