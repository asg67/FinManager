import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check } from "lucide-react";
import { ddsApi, type CreateOperationPayload } from "../../api/dds.js";
import { accountsApi, type AccountWithEntity } from "../../api/accounts.js";
import { companyApi } from "../../api/company.js";
import { incomesApi } from "../../api/incomes.js";
import { Button, Input, Modal } from "../ui/index.js";
import type { Entity, Account, ExpenseType, IncomeType, CustomField, DdsOperation, DdsTemplate } from "@shared/types.js";

type Step = "entity" | "opType" | "fromAccount" | "category" | "article" | "incomeCategory" | "incomeArticle" | "details" | "review";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  editOperation: DdsOperation | null;
  entities: Entity[];
}

export default function StepWizard({ open, onClose, onDone, editOperation, entities }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("entity");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [otherCash, setOtherCash] = useState<AccountWithEntity[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [incomeTypes, setIncomeTypes] = useState<IncomeType[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [templates, setTemplates] = useState<DdsTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<CreateOperationPayload>({
    operationType: "expense",
    amount: 0,
    entityId: "",
  });

  // Custom field values state: { [customFieldId]: value }
  const [cfValues, setCfValues] = useState<Record<string, string>>({});

  // Initialize when opened
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
      // Restore custom field values
      if (editOperation.customFieldValues) {
        const vals: Record<string, string> = {};
        editOperation.customFieldValues.forEach((cfv) => { vals[cfv.customFieldId] = cfv.value; });
        setCfValues(vals);
      }
      setStep("review");
    } else {
      const autoEntity = entities.length === 1 ? entities[0].id : "";
      setForm({
        operationType: "expense",
        amount: 0,
        entityId: autoEntity,
      });
      setCfValues({});
      setStep(entities.length === 1 ? "opType" : "entity");
      ddsApi.listTemplates().then(setTemplates);
    }
  }, [open, editOperation, entities]);

  // Load expense types (company-wide)
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
    } else {
      setAccounts([]);
    }
  }, [form.entityId]);

  // Load cash accounts from other entities for transfers
  useEffect(() => {
    if (open && form.entityId) {
      accountsApi.listOtherCash(entities, form.entityId).then(setOtherCash);
    } else {
      setOtherCash([]);
    }
  }, [open, form.entityId, entities]);

  function updateField<K extends keyof CreateOperationPayload>(key: K, value: CreateOperationPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function selectEntity(entityId: string) {
    setForm((prev) => ({ ...prev, entityId, fromAccountId: undefined, toAccountId: undefined }));
    setStep("opType");
  }

  function selectOpType(opType: string) {
    setForm((prev) => ({ ...prev, operationType: opType, expenseTypeId: undefined, expenseArticleId: undefined, incomeTypeId: undefined, incomeArticleId: undefined }));
    if (opType === "expense") {
      setStep("fromAccount");
    } else if (opType === "income" && incomeTypes.length > 0) {
      setStep("incomeCategory");
    } else {
      setStep("details");
    }
  }

  function selectFromAccount(accountId: string) {
    setForm((prev) => ({ ...prev, fromAccountId: accountId }));
    setStep("category");
  }

  function selectCategory(categoryId: string) {
    const cat = expenseTypes.find((et) => et.id === categoryId);
    setForm((prev) => ({ ...prev, expenseTypeId: categoryId, expenseArticleId: undefined }));
    if (cat && cat.articles.length > 0) {
      setStep("article");
    } else {
      setStep("details");
    }
  }

  function selectArticle(articleId: string) {
    setForm((prev) => ({ ...prev, expenseArticleId: articleId }));
    setStep("details");
  }

  function selectIncomeCategory(typeId: string) {
    const cat = incomeTypes.find((it) => it.id === typeId);
    setForm((prev) => ({ ...prev, incomeTypeId: typeId, incomeArticleId: undefined }));
    if (cat && cat.articles.length > 0) {
      setStep("incomeArticle");
    } else {
      setStep("details");
    }
  }

  function selectIncomeArticle(articleId: string) {
    setForm((prev) => ({ ...prev, incomeArticleId: articleId }));
    setStep("details");
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
    setStep("details");
  }

  function goBack() {
    switch (step) {
      case "opType":
        if (entities.length > 1) setStep("entity");
        break;
      case "fromAccount":
        setStep("opType");
        break;
      case "category":
        setStep("fromAccount");
        break;
      case "article":
        setStep("category");
        break;
      case "incomeCategory":
        setStep("opType");
        break;
      case "incomeArticle":
        setStep("incomeCategory");
        break;
      case "details":
        if (form.operationType === "expense") {
          const cat = expenseTypes.find((et) => et.id === form.expenseTypeId);
          if (cat && cat.articles.length > 0) {
            setStep("article");
          } else {
            setStep("category");
          }
        } else if (form.operationType === "income" && incomeTypes.length > 0) {
          const cat = incomeTypes.find((it) => it.id === form.incomeTypeId);
          if (cat && cat.articles.length > 0) {
            setStep("incomeArticle");
          } else {
            setStep("incomeCategory");
          }
        } else {
          setStep("opType");
        }
        break;
      case "review":
        setStep("details");
        break;
    }
  }

  // Get visible custom fields based on current form state
  function getVisibleCustomFields(): CustomField[] {
    return customFields.filter((cf) => {
      if (!cf.showWhen) return true; // always show
      const sw = cf.showWhen;
      if (sw.operationType && sw.operationType !== form.operationType) return false;
      if (sw.expenseTypeId && sw.expenseTypeId !== form.expenseTypeId) return false;
      if (sw.expenseArticleId && sw.expenseArticleId !== form.expenseArticleId) return false;
      return true;
    });
  }

  async function handleSubmit() {
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

  const isIncome = form.operationType === "income";
  const isExpense = form.operationType === "expense";
  const isTransfer = form.operationType === "transfer";

  // Resolve display names for review
  const entityName = entities.find((e) => e.id === form.entityId)?.name ?? "";
  const fromAccountName = accounts.find((a) => a.id === form.fromAccountId)?.name;
  const toAccOwn = accounts.find((a) => a.id === form.toAccountId);
  const toAccOther = !toAccOwn && isTransfer ? otherCash.find((a) => a.id === form.toAccountId) : undefined;
  const toAccountName = toAccOther ? `${toAccOther.entityName} — ${toAccOther.name}` : toAccOwn?.name;
  const expenseTypeName = expenseTypes.find((et) => et.id === form.expenseTypeId)?.name;
  const selectedExpenseType = expenseTypes.find((et) => et.id === form.expenseTypeId);
  const expenseArticleName = selectedExpenseType?.articles.find((a) => a.id === form.expenseArticleId)?.name;
  const incomeTypeName = incomeTypes.find((it) => it.id === form.incomeTypeId)?.name;
  const selectedIncomeType = incomeTypes.find((it) => it.id === form.incomeTypeId);
  const incomeArticleName = selectedIncomeType?.articles.find((a) => a.id === form.incomeArticleId)?.name;

  const visibleCustomFields = getVisibleCustomFields();

  const stepLabels: Record<Step, string> = {
    entity: t("dds.selectEntity"),
    opType: t("dds.selectType"),
    fromAccount: t("dds.fromAccount"),
    category: t("dds.selectCategory"),
    article: t("dds.selectArticle"),
    incomeCategory: "Тип прихода",
    incomeArticle: "Статья прихода",
    details: t("dds.fillDetails"),
    review: t("dds.reviewTitle"),
  };

  const canGoBack = step !== "entity" && !(step === "opType" && entities.length <= 1);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editOperation ? t("dds.editOperation") : t("dds.addOperation")}
      size="md"
    >
      <div className="step-wizard">
        {/* Header: Back + Step Label */}
        <div className="step-wizard__header">
          {canGoBack && (
            <button type="button" className="step-wizard__back" onClick={goBack}>
              <ArrowLeft size={20} />
            </button>
          )}
          <span className="step-wizard__step-label">{stepLabels[step]}</span>
        </div>

        {/* Templates (on first step, create mode only) */}
        {!editOperation && step === (entities.length === 1 ? "opType" : "entity") && templates.length > 0 && (
          <div className="step-wizard__templates">
            <span className="step-wizard__templates-label">{t("dds.fromTemplate")}</span>
            <div className="step-wizard__templates-list">
              {templates.map((tpl) => (
                <button key={tpl.id} type="button" className="wizard-template-btn" onClick={() => applyTemplate(tpl)}>
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Entity */}
        {step === "entity" && (
          <div className="step-wizard__grid">
            {entities.map((e) => (
              <button
                key={e.id}
                type="button"
                className={`step-wizard__option ${form.entityId === e.id ? "step-wizard__option--selected" : ""}`}
                onClick={() => selectEntity(e.id)}
              >
                {e.name}
              </button>
            ))}
          </div>
        )}

        {/* Step: Operation Type */}
        {step === "opType" && (
          <div className="step-wizard__grid">
            <button
              type="button"
              className="step-wizard__op-btn step-wizard__op-btn--income"
              onClick={() => selectOpType("income")}
            >
              {t("dds.income")}
            </button>
            <button
              type="button"
              className="step-wizard__op-btn step-wizard__op-btn--expense"
              onClick={() => selectOpType("expense")}
            >
              {t("dds.expense")}
            </button>
            <button
              type="button"
              className="step-wizard__op-btn step-wizard__op-btn--transfer"
              onClick={() => selectOpType("transfer")}
            >
              {t("dds.transfer")}
            </button>
          </div>
        )}

        {/* Step: From Account (expense only, right after opType) */}
        {step === "fromAccount" && (
          <div className="step-wizard__grid">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`step-wizard__option ${form.fromAccountId === a.id ? "step-wizard__option--selected" : ""}`}
                onClick={() => selectFromAccount(a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}

        {/* Step: Category (expense) */}
        {step === "category" && (
          <div className="step-wizard__grid">
            {expenseTypes.map((et) => (
              <button
                key={et.id}
                type="button"
                className={`step-wizard__option ${form.expenseTypeId === et.id ? "step-wizard__option--selected" : ""}`}
                onClick={() => selectCategory(et.id)}
              >
                {et.name}
              </button>
            ))}
          </div>
        )}

        {/* Step: Article (expense) */}
        {step === "article" && selectedExpenseType && (
          <div className="step-wizard__grid">
            {selectedExpenseType.articles.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`step-wizard__option ${form.expenseArticleId === a.id ? "step-wizard__option--selected" : ""}`}
                onClick={() => selectArticle(a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}

        {/* Step: Income Category */}
        {step === "incomeCategory" && (
          <div className="step-wizard__grid">
            {incomeTypes.map((it) => (
              <button
                key={it.id}
                type="button"
                className={`step-wizard__option ${form.incomeTypeId === it.id ? "step-wizard__option--selected" : ""}`}
                onClick={() => selectIncomeCategory(it.id)}
              >
                {it.name}
              </button>
            ))}
          </div>
        )}

        {/* Step: Income Article */}
        {step === "incomeArticle" && selectedIncomeType && (
          <div className="step-wizard__grid">
            {selectedIncomeType.articles.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`step-wizard__option ${form.incomeArticleId === a.id ? "step-wizard__option--selected" : ""}`}
                onClick={() => selectIncomeArticle(a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}

        {/* Step: Details */}
        {step === "details" && (
          <div className="step-wizard__details">
            {/* From Account (transfer only — expense already selected in fromAccount step) */}
            {isTransfer && (
              <div className="step-wizard__field">
                <label className="step-wizard__field-label">{t("dds.fromAccount")}</label>
                <div className="step-wizard__grid step-wizard__grid--compact">
                  {accounts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`step-wizard__option step-wizard__option--sm ${form.fromAccountId === a.id ? "step-wizard__option--selected" : ""}`}
                      onClick={() => updateField("fromAccountId", a.id)}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* To Account (income — same entity; transfer — own accounts + other entities' cash) */}
            {(isIncome || isTransfer) && (
              <div className="step-wizard__field">
                <label className="step-wizard__field-label">{t("dds.toAccount")}</label>
                <div className="step-wizard__grid step-wizard__grid--compact">
                  {accounts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`step-wizard__option step-wizard__option--sm ${form.toAccountId === a.id ? "step-wizard__option--selected" : ""}`}
                      onClick={() => updateField("toAccountId", a.id)}
                    >
                      {a.name}
                    </button>
                  ))}
                  {isTransfer && otherCash.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`step-wizard__option step-wizard__option--sm ${form.toAccountId === a.id ? "step-wizard__option--selected" : ""}`}
                      onClick={() => updateField("toAccountId", a.id)}
                    >
                      {a.entityName} — {a.name}
                    </button>
                  ))}
                </div>
              </div>
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
              autoFocus
            />

            {/* Order number (expense only) */}
            {isExpense && (
              <Input
                label={t("dds.orderNumber")}
                value={form.orderNumber ?? ""}
                onChange={(e) => updateField("orderNumber", e.target.value || undefined)}
              />
            )}

            {/* Custom fields */}
            {visibleCustomFields.map((cf) => (
              <div key={cf.id} className="step-wizard__field">
                {cf.fieldType === "select" && cf.options ? (
                  <>
                    <label className="step-wizard__field-label">{cf.name}{cf.required ? " *" : ""}</label>
                    <div className="step-wizard__grid step-wizard__grid--compact">
                      {cf.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={`step-wizard__option step-wizard__option--sm ${cfValues[cf.id] === opt ? "step-wizard__option--selected" : ""}`}
                          onClick={() => setCfValues((prev) => ({ ...prev, [cf.id]: opt }))}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <Input
                    label={`${cf.name}${cf.required ? " *" : ""}`}
                    type={cf.fieldType === "number" ? "number" : "text"}
                    value={cfValues[cf.id] ?? ""}
                    onChange={(e) => setCfValues((prev) => ({ ...prev, [cf.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}

            {/* Comment */}
            <Input
              label={t("dds.comment")}
              value={form.comment ?? ""}
              onChange={(e) => updateField("comment", e.target.value || undefined)}
            />

            <Button onClick={() => setStep("review")} disabled={!form.amount || (isIncome && !form.toAccountId) || (isTransfer && (!form.fromAccountId || !form.toAccountId))}>
              {t("common.next")}
            </Button>
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && (
          <div className="step-wizard__review">
            <div className="step-wizard__review-row">
              <span className="step-wizard__review-label">{t("dds.entity")}</span>
              <span className="step-wizard__review-value">{entityName}</span>
            </div>
            <div className="step-wizard__review-row">
              <span className="step-wizard__review-label">{t("dds.operationType")}</span>
              <span className={`step-wizard__review-value op-badge op-badge--${form.operationType}`}>
                {t(`dds.${form.operationType}`)}
              </span>
            </div>
            {fromAccountName && (
              <div className="step-wizard__review-row">
                <span className="step-wizard__review-label">{t("dds.fromAccount")}</span>
                <span className="step-wizard__review-value">{fromAccountName}</span>
              </div>
            )}
            {toAccountName && (
              <div className="step-wizard__review-row">
                <span className="step-wizard__review-label">{t("dds.toAccount")}</span>
                <span className="step-wizard__review-value">{toAccountName}</span>
              </div>
            )}
            {expenseTypeName && (
              <div className="step-wizard__review-row">
                <span className="step-wizard__review-label">{t("dds.expenseType")}</span>
                <span className="step-wizard__review-value">{expenseTypeName}</span>
              </div>
            )}
            {expenseArticleName && (
              <div className="step-wizard__review-row">
                <span className="step-wizard__review-label">{t("dds.expenseArticle")}</span>
                <span className="step-wizard__review-value">{expenseArticleName}</span>
              </div>
            )}
            {incomeTypeName && (
              <div className="step-wizard__review-row">
                <span className="step-wizard__review-label">Тип прихода</span>
                <span className="step-wizard__review-value">{incomeTypeName}</span>
              </div>
            )}
            {incomeArticleName && (
              <div className="step-wizard__review-row">
                <span className="step-wizard__review-label">Статья прихода</span>
                <span className="step-wizard__review-value">{incomeArticleName}</span>
              </div>
            )}
            <div className="step-wizard__review-row">
              <span className="step-wizard__review-label">{t("dds.amount")}</span>
              <span className={`step-wizard__review-value step-wizard__review-amount amount--${form.operationType}`}>
                {form.amount.toLocaleString("ru-RU")}
              </span>
            </div>
            {form.orderNumber && (
              <div className="step-wizard__review-row">
                <span className="step-wizard__review-label">{t("dds.orderNumber")}</span>
                <span className="step-wizard__review-value">{form.orderNumber}</span>
              </div>
            )}
            {/* Custom field values in review */}
            {visibleCustomFields.filter((cf) => cfValues[cf.id]?.trim()).map((cf) => (
              <div key={cf.id} className="step-wizard__review-row">
                <span className="step-wizard__review-label">{cf.name}</span>
                <span className="step-wizard__review-value">{cfValues[cf.id]}</span>
              </div>
            ))}
            {form.comment && (
              <div className="step-wizard__review-row">
                <span className="step-wizard__review-label">{t("dds.comment")}</span>
                <span className="step-wizard__review-value">{form.comment}</span>
              </div>
            )}

            {error && <div className="wizard-error">{error}</div>}

            <div className="step-wizard__review-actions">
              <Button variant="secondary" onClick={() => setStep("details")}>
                {t("dds.reviewEdit")}
              </Button>
              <Button onClick={handleSubmit} loading={saving}>
                <Check size={18} />
                {editOperation ? t("common.save") : t("dds.confirm")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
