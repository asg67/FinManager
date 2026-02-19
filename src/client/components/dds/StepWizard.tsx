import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check } from "lucide-react";
import { ddsApi, type CreateOperationPayload } from "../../api/dds.js";
import { accountsApi } from "../../api/accounts.js";
import { companyApi } from "../../api/company.js";
import { Button, Input, Modal } from "../ui/index.js";
import type { Entity, Account, ExpenseType, DdsOperation, DdsTemplate } from "@shared/types.js";

type Step = "entity" | "opType" | "fromAccount" | "category" | "article" | "details" | "review";

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
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [templates, setTemplates] = useState<DdsTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<CreateOperationPayload>({
    operationType: "expense",
    amount: 0,
    entityId: "",
  });

  // Initialize when opened
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
      setStep("review");
    } else {
      const autoEntity = entities.length === 1 ? entities[0].id : "";
      setForm({
        operationType: "expense",
        amount: 0,
        entityId: autoEntity,
      });
      setStep(entities.length === 1 ? "opType" : "entity");
      ddsApi.listTemplates().then(setTemplates);
    }
  }, [open, editOperation, entities]);

  // Load expense types (company-wide)
  useEffect(() => {
    if (open) companyApi.listExpenseTypes().then(setExpenseTypes);
  }, [open]);

  // Load accounts when entity changes
  useEffect(() => {
    if (form.entityId) {
      accountsApi.list(form.entityId, "manual").then(setAccounts);
    } else {
      setAccounts([]);
    }
  }, [form.entityId]);

  function updateField<K extends keyof CreateOperationPayload>(key: K, value: CreateOperationPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function selectEntity(entityId: string) {
    setForm((prev) => ({ ...prev, entityId, fromAccountId: undefined, toAccountId: undefined }));
    setStep("opType");
  }

  function selectOpType(opType: string) {
    setForm((prev) => ({ ...prev, operationType: opType, expenseTypeId: undefined, expenseArticleId: undefined }));
    if (opType === "expense") {
      setStep("fromAccount");
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
      case "details":
        if (form.operationType === "expense") {
          const cat = expenseTypes.find((et) => et.id === form.expenseTypeId);
          if (cat && cat.articles.length > 0) {
            setStep("article");
          } else {
            setStep("category");
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

  async function handleSubmit() {
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

  // Resolve display names for review
  const entityName = entities.find((e) => e.id === form.entityId)?.name ?? "";
  const fromAccountName = accounts.find((a) => a.id === form.fromAccountId)?.name;
  const toAccountName = accounts.find((a) => a.id === form.toAccountId)?.name;
  const expenseTypeName = expenseTypes.find((et) => et.id === form.expenseTypeId)?.name;
  const selectedExpenseType = expenseTypes.find((et) => et.id === form.expenseTypeId);
  const expenseArticleName = selectedExpenseType?.articles.find((a) => a.id === form.expenseArticleId)?.name;

  const isIncome = form.operationType === "income";
  const isExpense = form.operationType === "expense";
  const isTransfer = form.operationType === "transfer";

  const stepLabels: Record<Step, string> = {
    entity: t("dds.selectEntity"),
    opType: t("dds.selectType"),
    fromAccount: t("dds.fromAccount"),
    category: t("dds.selectCategory"),
    article: t("dds.selectArticle"),
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

        {/* Step: Category */}
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

        {/* Step: Article */}
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

            {/* To Account (income, transfer) */}
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
