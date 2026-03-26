import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Save } from "lucide-react";
import { ddsApi, type CreateOperationPayload } from "../../api/dds.js";
import { accountsApi, type AccountWithEntity } from "../../api/accounts.js";
import { companyApi } from "../../api/company.js";
import { incomesApi } from "../../api/incomes.js";
import { Button, Input, Select } from "../ui/index.js";
import { useAuthStore } from "../../stores/auth.js";
import type { Entity, Account, ExpenseType, IncomeType, CustomField, DdsTemplate } from "@shared/types.js";

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
  const user = useAuthStore((s) => s.user);
  const isDdsOnly = user?.company?.mode === "dds_only";
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [otherCash, setOtherCash] = useState<AccountWithEntity[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [incomeTypes, setIncomeTypes] = useState<IncomeType[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [templates, setTemplates] = useState<DdsTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [cfValues, setCfValues] = useState<Record<string, string>>({});

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

  // Load expense types once (company-wide)
  useEffect(() => {
    companyApi.listExpenseTypes().then(setExpenseTypes);
  }, []);

  // Load income types when entity changes
  useEffect(() => {
    if (form.entityId) {
      incomesApi.listTypes(form.entityId).then(setIncomeTypes).catch(() => setIncomeTypes([]));
    } else {
      setIncomeTypes([]);
    }
  }, [form.entityId]);

  // Load custom fields
  useEffect(() => {
    ddsApi.getCustomFields().then(setCustomFields).catch(() => setCustomFields([]));
  }, []);

  // Load accounts when entity changes
  useEffect(() => {
    if (form.entityId) {
      accountsApi.list(form.entityId, "manual", true).then(setAccounts);
    } else {
      setAccounts([]);
    }
  }, [form.entityId]);

  // Load cash accounts from other entities for transfers
  useEffect(() => {
    if (form.entityId) {
      accountsApi.listOtherCash(entities, form.entityId).then(setOtherCash);
    } else {
      setOtherCash([]);
    }
  }, [form.entityId, entities]);

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
      incomeTypeId: tpl.incomeTypeId ?? undefined,
      incomeArticleId: tpl.incomeArticleId ?? undefined,
    });
    setCfValues({});
  }

  // Get visible custom fields based on current form state
  function getVisibleCustomFields(): CustomField[] {
    return customFields.filter((cf) => {
      if (!cf.showWhen) return true;
      const sw = cf.showWhen;
      if (sw.operationType && sw.operationType !== form.operationType) return false;
      if (sw.expenseTypeId && sw.expenseTypeId !== form.expenseTypeId) return false;
      if (sw.expenseArticleId && sw.expenseArticleId !== form.expenseArticleId) return false;
      // Match by name (works across entities with same type/article names)
      if (sw.expenseTypeName) {
        const selType = expenseTypes.find((et) => et.id === form.expenseTypeId);
        if (!selType || selType.name !== sw.expenseTypeName) return false;
      }
      if (sw.expenseArticleName) {
        const selType = expenseTypes.find((et) => et.id === form.expenseTypeId);
        const selArt = selType?.articles.find((a) => a.id === form.expenseArticleId);
        if (!selArt || selArt.name !== sw.expenseArticleName) return false;
      }
      return true;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const visibleCf = getVisibleCustomFields();
      const customFieldValues = visibleCf
        .filter((cf) => cfValues[cf.id]?.trim())
        .map((cf) => ({ customFieldId: cf.id, value: cfValues[cf.id] }));

      await ddsApi.createOperation({ ...form, customFieldValues });
      // Reset form but keep entity and operation type
      setForm((prev) => ({
        operationType: prev.operationType,
        amount: 0,
        entityId: prev.entityId,
      }));
      setCfValues({});
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
  const selectedIncomeType = incomeTypes.find((it) => it.id === form.incomeTypeId);
  const isIncome = form.operationType === "income";
  const isExpense = form.operationType === "expense";
  const isTransfer = form.operationType === "transfer";
  const visibleCustomFields = getVisibleCustomFields();

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
          }}
        />

        {/* Operation type buttons */}
        <div className="quick-add__op-types">
          {OP_TYPES
            .filter((op) => !isDdsOnly || op.value !== "transfer")
            .map((op) => (
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
        {/* From Account (expense, transfer) — hidden for dds_only */}
        {!isDdsOnly && (isExpense || isTransfer) && (
          <Select
            placeholder={t("dds.fromAccount")}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            value={form.fromAccountId ?? ""}
            onChange={(e) => updateField("fromAccountId", e.target.value || undefined)}
          />
        )}

        {/* To Account — hidden for dds_only */}
        {!isDdsOnly && (isIncome || isTransfer) && (
          <Select
            placeholder={t("dds.toAccount")}
            options={[
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ...(isTransfer ? otherCash.map((a) => ({ value: a.id, label: `${a.entityName} — ${a.name}` })) : []),
            ]}
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

        {/* Income type */}
        {isIncome && incomeTypes.length > 0 && (
          <Select
            placeholder="Тип прихода"
            options={incomeTypes.map((it) => ({ value: it.id, label: it.name }))}
            value={form.incomeTypeId ?? ""}
            onChange={(e) => {
              updateField("incomeTypeId", e.target.value || undefined);
              updateField("incomeArticleId", undefined);
            }}
          />
        )}

        {/* Income article */}
        {isIncome && selectedIncomeType && selectedIncomeType.articles.length > 0 && (
          <Select
            placeholder="Статья прихода"
            options={selectedIncomeType.articles.map((a) => ({ value: a.id, label: a.name }))}
            value={form.incomeArticleId ?? ""}
            onChange={(e) => updateField("incomeArticleId", e.target.value || undefined)}
          />
        )}

        {/* Custom fields */}
        {visibleCustomFields.map((cf) => (
          cf.fieldType === "select" && cf.options ? (
            <Select
              key={cf.id}
              placeholder={`${cf.name}${cf.required ? " *" : ""}`}
              options={cf.options.map((opt) => ({ value: opt, label: opt }))}
              value={cfValues[cf.id] ?? ""}
              onChange={(e) => setCfValues((prev) => ({ ...prev, [cf.id]: e.target.value }))}
            />
          ) : (
            <Input
              key={cf.id}
              type={cf.fieldType === "number" ? "number" : "text"}
              value={cfValues[cf.id] ?? ""}
              onChange={(e) => setCfValues((prev) => ({ ...prev, [cf.id]: e.target.value }))}
              placeholder={`${cf.name}${cf.required ? " *" : ""}`}
            />
          )
        ))}
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
