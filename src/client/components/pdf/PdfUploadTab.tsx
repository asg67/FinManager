import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Upload, FileText, Check, AlertTriangle } from "lucide-react";
import { entitiesApi } from "../../api/entities.js";
import { accountsApi } from "../../api/accounts.js";
import { pdfApi, type ParsedTransaction, type UploadResult } from "../../api/pdf.js";
import { Button, Select } from "../ui/index.js";
import type { Entity, Account } from "@shared/types.js";

const BANK_CODES = [
  { value: "sber", label: "Сбер" },
  { value: "tbank", label: "Т-Банк" },
  { value: "tbank_deposit", label: "Т-Банк (вклад)" },
];

type Step = "select" | "uploading" | "preview" | "done";

export default function PdfUploadTab() {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [entities, setEntities] = useState<Entity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [bankCode, setBankCode] = useState("sber");
  const [step, setStep] = useState<Step>("select");
  const [error, setError] = useState("");

  // Preview state
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState<{ saved: number; skipped: number } | null>(null);

  useEffect(() => {
    entitiesApi.list().then((data) => {
      setEntities(data);
      if (data.length > 0) setSelectedEntity(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedEntity) {
      accountsApi.list(selectedEntity).then((data) => {
        setAccounts(data);
        if (data.length > 0) {
          setSelectedAccount(data[0].id);
          // Auto-detect bank code from account
          const acc = data[0];
          if (acc.bank) {
            const match = BANK_CODES.find((b) => b.value === acc.bank || (acc.bank === "tbank" && b.value === "tbank"));
            if (match) setBankCode(match.value);
          }
        }
      });
    }
  }, [selectedEntity]);

  function handleAccountChange(accId: string) {
    setSelectedAccount(accId);
    const acc = accounts.find((a) => a.id === accId);
    if (acc?.bank) {
      const match = BANK_CODES.find((b) => b.value === acc.bank);
      if (match) setBankCode(match.value);
    }
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setStep("uploading");

    try {
      const result = await pdfApi.upload(file, selectedAccount, bankCode);
      setUploadResult(result);

      // Pre-select non-duplicate transactions
      const nonDupIndices = new Set<number>();
      result.transactions.forEach((tx, i) => {
        if (!tx.isDuplicate) nonDupIndices.add(i);
      });
      setSelected(nonDupIndices);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStep("select");
    }

    // Reset file input
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

  function reset() {
    setStep("select");
    setUploadResult(null);
    setSelected(new Set());
    setConfirmResult(null);
    setError("");
  }

  function formatAmount(amount: string, direction: string) {
    const num = parseFloat(amount);
    const formatted = num.toLocaleString("ru-RU", { minimumFractionDigits: 2 });
    return direction === "income" ? `+${formatted}` : `-${formatted}`;
  }

  return (
    <div className="pdf-upload">
      {/* Step 1: Select account */}
      {step === "select" && (
        <div className="pdf-upload__select">
          <div className="pdf-upload__fields">
            <Select
              label={t("pdf.entity")}
              options={entities.map((e) => ({ value: e.id, label: e.name }))}
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
            />
            <Select
              label={t("pdf.account")}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              value={selectedAccount}
              onChange={(e) => handleAccountChange(e.target.value)}
            />
            <Select
              label={t("pdf.bankFormat")}
              options={BANK_CODES.map((b) => ({ value: b.value, label: b.label }))}
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
            />
          </div>

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

          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            hidden
            onChange={handleFileSelect}
          />

          {error && <div className="wizard-error">{error}</div>}
        </div>
      )}

      {/* Step 2: Loading */}
      {step === "uploading" && (
        <div className="pdf-upload__loading">
          <FileText size={48} className="pdf-loading-icon" />
          <p>{t("pdf.parsing")}</p>
        </div>
      )}

      {/* Step 3: Preview */}
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
            <div className="pdf-preview-actions">
              <Button variant="secondary" size="sm" onClick={reset}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={handleConfirm} loading={confirming} disabled={selected.size === 0}>
                {t("pdf.confirm", { count: selected.size })}
              </Button>
            </div>
          </div>

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
                        <span className="pdf-new-badge">
                          {t("pdf.new")}
                        </span>
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

      {/* Step 4: Done */}
      {step === "done" && confirmResult && (
        <div className="pdf-upload__done">
          <Check size={48} className="pdf-done-icon" />
          <h3>{t("pdf.success")}</h3>
          <p>{t("pdf.savedCount", { saved: confirmResult.saved, skipped: confirmResult.skipped })}</p>
          <Button onClick={reset}>{t("pdf.uploadAnother")}</Button>
        </div>
      )}
    </div>
  );
}
