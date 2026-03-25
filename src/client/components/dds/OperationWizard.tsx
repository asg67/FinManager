import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ddsApi, type CreateOperationPayload } from "../../api/dds.js";
import { accountsApi, type AccountWithEntity } from "../../api/accounts.js";
import { companyApi } from "../../api/company.js";
import { incomesApi } from "../../api/incomes.js";
import { Button, Input, Select, Modal } from "../ui/index.js";
import type { Entity, Account, ExpenseType, IncomeType, CustomField, DdsOperation, DdsTemplate } from "@shared/types.js";

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
  const [otherCash, setOtherCash] = useState<AccountWithEntity[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [incomeTypes, setIncomeTypes] = useState<IncomeType[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [templates, setTemplates] = useState<DdsTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cfValues, setCfValues] = useState<Record<string, string>>({});

  const [form, setForm] = useState<CreateOperationPayload>({
    operationType: "income",
    amount: 0,
    entityId: "",
  });

  // Initialize form
  useEffect(() => {
    if (!open) return;
    setError("");
    setCfValues({});
    if (editOperation) {
      setForm({
        operationType: editOperation.operationType,
        amount: parseFloat(editOperation.amount),
        entityId: editOperation.entityId,
        fromAccountId: editOperation.fromAccountId ?? undefined,
        toAccountId: editOperation.toAccountId ?? undefined,
        expenseTypeId: editOperation.expenseTypeId ?? undefined,
        expenseArticleId: editOperation.expenseArticleId ?? undefined,
        incomeTypeId: editOperation.incomeTypeId ?? undefined,
        incomeArticleId: editOperation.incomeArticleId ?? undefined,
        orderNumber: editOperation.orderNumber ?? undefined,
        comment: editOperation.comment ?? undefined,
      });
      if (editOperation.customFieldValues) {
        const vals: Record<string, string> = {};
        editOperation.customFieldValues.forEach((cfv) => { vals[cfv.customFieldId] = cfv.value; });
        setCfValues(vals);
      }
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

  // Load income types when entity changes
  useEffect(() => {
    if (open && form.entityId) {
      incomesApi.listTypes(form.entityId).then(setIncomeTypes).catch(() => setIncomeTypes([]));
    } else {
      setIncomeTypes([]);
    }
  }, [open, form.entityId]);

  // Load custom fields
  useEffect(() => {
    if (open) {
      ddsApi.getCustomFields().then(setCustomFields).catch(() => setCustomFields([]));
    }
  }, [open]);

  // Load accounts when entity changes
  useEffect(() => {
    if (form.entityId) {
      accountsApi.list(form.entityId, "manual", true).then(setAccounts);
    }
  }, [form.entityId]);

  // Load cash accounts from other entities for transfers
  useEffect(() => {
    if (open && form.entityId && entities.length > 1) {
      accountsApi.listOtherCash(entities, form.entityId, "manual", true).then(setOtherCash);
    } else {
      setOtherCash([]);
    }
  }, [open, form.entityId, entities]);

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
      return true;
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
      const visibleCf = getVisibleCustomFields();
      const customFieldValues = visibleCf
        .filter((cf) => cfValues[cf.id]?.trim())
        .map((cf) => ({ customFieldId: cf.id, value: cfValues[cf.id] }));

      if (editOperation) {
        await ddsApi.updateOperation(editOperation.id, {
          amount: form.amount,
          fromAccountId: form.fromAccountId ?? null,
          toAccountId: form.toAccountId ?? null,
          expenseTypeId: form.expenseTypeId ?? null,
          expenseArticleId: form.expenseArticleId ?? null,
          incomeTypeId: form.incomeTypeId ?? null,
          incomeArticleId: form.incomeArticleId ?? null,
          orderNumber: form.orderNumber ?? null,
          comment: form.comment ?? null,
          customFieldValues,
        });
      } else {
        await ddsApi.createOperation({ ...form, customFieldValues });
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
  const selectedIncomeType = incomeTypes.find((it) => it.id === form.incomeTypeId);
  const isIncome = form.operationType === "income";
  const isExpense = form.operationType === "expense";
  const isTransfer = form.operationType === "transfer";
  const visibleCustomFields = getVisibleCustomFields();

  if (open && !editOperation && entities.length === 0) {
    return (
      <Modal open={open} onClose={onClose} title={t("dds.addOperation")} size="lg">
        <div className="wizard-empty">
          <p>{t("dds.noEntities")}</p>
        </div>
        <Modal.Footer>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t("common.close")}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

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

        {/* To Account (income — same entity; transfer — own accounts + other entities' cash) */}
        {(isIncome || isTransfer) && (
          <Select
            label={t("dds.toAccount")}
            options={[
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ...(isTransfer ? otherCash.map((a) => ({ value: a.id, label: `${a.entityName} — ${a.name}` })) : []),
            ]}
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

        {/* Income type & article */}
        {isIncome && incomeTypes.length > 0 && (
          <>
            <Select
              label="Тип прихода"
              options={incomeTypes.map((it) => ({ value: it.id, label: it.name }))}
              value={form.incomeTypeId ?? ""}
              onChange={(e) => {
                updateField("incomeTypeId", e.target.value || undefined);
                updateField("incomeArticleId", undefined);
              }}
              placeholder={t("common.select")}
            />
            {selectedIncomeType && selectedIncomeType.articles.length > 0 && (
              <Select
                label="Статья прихода"
                options={selectedIncomeType.articles.map((a) => ({ value: a.id, label: a.name }))}
                value={form.incomeArticleId ?? ""}
                onChange={(e) => updateField("incomeArticleId", e.target.value || undefined)}
                placeholder={t("common.select")}
              />
            )}
          </>
        )}

        {/* Custom fields */}
        {visibleCustomFields.map((cf) => (
          cf.fieldType === "select" && cf.options ? (
            <Select
              key={cf.id}
              label={`${cf.name}${cf.required ? " *" : ""}`}
              options={cf.options.map((opt) => ({ value: opt, label: opt }))}
              value={cfValues[cf.id] ?? ""}
              onChange={(e) => setCfValues((prev) => ({ ...prev, [cf.id]: e.target.value }))}
              placeholder={t("common.select")}
            />
          ) : (
            <Input
              key={cf.id}
              label={`${cf.name}${cf.required ? " *" : ""}`}
              type={cf.fieldType === "number" ? "number" : "text"}
              value={cfValues[cf.id] ?? ""}
              onChange={(e) => setCfValues((prev) => ({ ...prev, [cf.id]: e.target.value }))}
            />
          )
        ))}

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
