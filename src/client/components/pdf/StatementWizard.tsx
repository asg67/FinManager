import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { X, ArrowLeft, Upload, FileText, Check, AlertTriangle, CreditCard, Landmark } from "lucide-react";
import { entitiesApi } from "../../api/entities.js";
import { accountsApi } from "../../api/accounts.js";
import { pdfApi, type UploadResult } from "../../api/pdf.js";
import { Button } from "../ui/index.js";
import type { Entity, Account } from "@shared/types.js";

type Step = "bank" | "upload" | "uploading" | "preview" | "done";

const BANKS = [
  { code: "sber", label: "Карта Сбер", icon: CreditCard },
  { code: "tbank", label: "Карта Т-Банк", icon: CreditCard },
  { code: "tbank_deposit", label: "Депозит Т-Банк", icon: Landmark },
  { code: "ozon", label: "ОЗОН Банк", icon: CreditCard },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  initialFile?: File;
}

export default function StatementWizard({ open, onClose, onDone, initialFile }: Props) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("bank");
  const [bankCode, setBankCode] = useState("");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState("");

  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState<{ saved: number; skipped: number } | null>(null);

  // Load first entity → first account on open
  useEffect(() => {
    if (open) {
      entitiesApi.list({ mine: true }).then((entities) => {
        if (entities.length > 0) {
          accountsApi.list(entities[0].id).then((accounts) => {
            if (accounts.length > 0) setAccountId(accounts[0].id);
          });
        }
      });
    }
  }, [open]);

  function reset() {
    setStep("bank");
    setBankCode("");
    setError("");
    setUploadResult(null);
    setSelected(new Set());
    setConfirmResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function selectBank(code: string) {
    setBankCode(code);
    if (initialFile) {
      uploadFile(initialFile, code);
    } else {
      setStep("upload");
    }
  }

  async function uploadFile(file: File, bank: string) {
    setError("");
    setStep("uploading");
    try {
      const result = await pdfApi.upload(file, accountId, bank);
      setUploadResult(result);
      const nonDup = new Set<number>();
      result.transactions.forEach((tx, i) => { if (!tx.isDuplicate) nonDup.add(i); });
      setSelected(nonDup);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStep(initialFile ? "bank" : "upload");
    }
  }

  function goBack() {
    if (step === "upload") setStep("bank");
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file, bankCode);
    if (fileRef.current) fileRef.current.value = "";
  }

  function toggleSelect(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAll() {
    if (!uploadResult) return;
    if (selected.size === uploadResult.transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(uploadResult.transactions.map((_, i) => i)));
    }
  }

  async function handleConfirm() {
    if (!uploadResult) return;
    setConfirming(true);
    setError("");
    try {
      const selectedTxs = uploadResult.transactions.filter((_, i) => selected.has(i));
      const result = await pdfApi.confirm(uploadResult.pdfUploadId, selectedTxs);
      setConfirmResult(result);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setConfirming(false);
    }
  }

  function handleDone() {
    reset();
    onDone();
  }

  function formatAmount(amount: string, direction: string) {
    const num = parseFloat(amount);
    const formatted = num.toLocaleString("ru-RU", { minimumFractionDigits: 2 });
    return direction === "income" ? `+${formatted}` : `-${formatted}`;
  }

  if (!open) return null;

  const showBack = step === "upload";
  const stepTitle =
    step === "bank" ? t("pdf.selectBank") :
    step === "upload" ? t("pdf.uploadFile") :
    step === "uploading" ? t("pdf.parsing") :
    step === "preview" ? t("pdf.transactionsTab") :
    t("pdf.success");

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className={`modal ${step === "preview" ? "modal--lg" : "modal--md"}`}>
        <div className="modal__header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {showBack && (
              <button type="button" className="icon-btn" onClick={goBack}>
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="modal__title">{stepTitle}</h2>
          </div>
          <button type="button" className="modal__close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal__body">
          {step === "bank" && (
            <div className="stmt-wizard__grid">
              {BANKS.map((b) => {
                const Icon = b.icon;
                return (
                  <button
                    key={b.code}
                    type="button"
                    className="stmt-wizard__option"
                    onClick={() => selectBank(b.code)}
                  >
                    <Icon size={24} />
                    <span>{b.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {step === "upload" && (
            <>
              <div
                className="pdf-dropzone"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && file.type === "application/pdf") {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    if (fileRef.current) {
                      fileRef.current.files = dt.files;
                      fileRef.current.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                  }
                }}
              >
                <Upload size={40} className="pdf-dropzone__icon" />
                <p className="pdf-dropzone__text">{t("pdf.dropzone")}</p>
                <p className="pdf-dropzone__hint">{t("pdf.dropzoneHint")}</p>
              </div>
              <input ref={fileRef} type="file" accept=".pdf" hidden onChange={handleFileSelect} />
              {error && <div className="wizard-error">{error}</div>}
            </>
          )}

          {step === "uploading" && (
            <div className="pdf-upload__loading">
              <FileText size={48} className="pdf-loading-icon" />
              <p>{t("pdf.parsing")}</p>
            </div>
          )}

          {step === "preview" && uploadResult && (
            <div className="pdf-upload__preview">
              <div className="pdf-preview-header">
                <div>
                  <strong>{uploadResult.fileName}</strong>
                  <span className="pdf-preview-count">
                    {t("pdf.found", { count: uploadResult.totalCount })}
                    {uploadResult.duplicateCount > 0 && (
                      <span className="pdf-dup-count">
                        {" "}{t("pdf.duplicates", { count: uploadResult.duplicateCount })}
                      </span>
                    )}
                  </span>
                </div>
              </div>
              {uploadResult.identifierWarning && (
                <div className="pdf-id-warning">
                  <AlertTriangle size={16} />
                  <span>{uploadResult.identifierWarning}</span>
                </div>
              )}

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="table-check">
                        <input
                          type="checkbox"
                          checked={selected.size === uploadResult.transactions.length}
                          onChange={toggleAll}
                        />
                      </th>
                      <th>{t("dds.date")}</th>
                      <th>{t("dds.amount")}</th>
                      <th>{t("pdf.counterparty")}</th>
                      <th>{t("pdf.purpose")}</th>
                      <th>{t("pdf.balance")}</th>
                      <th>{t("pdf.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResult.transactions.map((tx, i) => (
                      <tr key={i} className={tx.isDuplicate ? "table-row--dup" : ""}>
                        <td className="table-check">
                          <input
                            type="checkbox"
                            checked={selected.has(i)}
                            onChange={() => toggleSelect(i)}
                          />
                        </td>
                        <td>{tx.date}{tx.time ? ` ${tx.time}` : ""}</td>
                        <td>
                          <span className={`amount amount--${tx.direction}`}>
                            {formatAmount(tx.amount, tx.direction)}
                          </span>
                        </td>
                        <td>{tx.counterparty ?? "—"}</td>
                        <td>{tx.purpose ?? "—"}</td>
                        <td>{tx.balance ? parseFloat(tx.balance).toLocaleString("ru-RU", { minimumFractionDigits: 2 }) : "—"}</td>
                        <td>
                          {tx.isDuplicate ? (
                            <span className="pdf-dup-badge">
                              <AlertTriangle size={14} />
                              {t("pdf.duplicate")}
                            </span>
                          ) : (
                            <span className="pdf-new-badge">{t("pdf.new")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {error && <div className="wizard-error">{error}</div>}
            </div>
          )}

          {step === "done" && confirmResult && (
            <div className="pdf-upload__done">
              <Check size={48} className="pdf-done-icon" />
              <h3>{t("pdf.success")}</h3>
              <p>{t("pdf.savedCount", { saved: confirmResult.saved, skipped: confirmResult.skipped })}</p>
            </div>
          )}
        </div>

        {step === "preview" && (
          <div className="modal__footer">
            <Button variant="secondary" onClick={() => reset()}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleConfirm} loading={confirming} disabled={selected.size === 0}>
              {t("pdf.confirm", { count: selected.size })}
            </Button>
          </div>
        )}
        {step === "done" && (
          <div className="modal__footer">
            <Button variant="secondary" onClick={() => reset()}>
              {t("pdf.uploadAnother")}
            </Button>
            <Button onClick={handleDone}>
              {t("common.close")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
