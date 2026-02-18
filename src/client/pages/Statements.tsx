import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, List, Landmark } from "lucide-react";
import clsx from "clsx";
import PdfUploadTab from "../components/pdf/PdfUploadTab.js";
import TransactionsTab from "../components/pdf/TransactionsTab.js";

type Tab = "upload" | "transactions" | "bankAccounts";

export default function Statements() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("upload");

  const tabs: { key: Tab; label: string; icon: typeof Upload }[] = [
    { key: "upload", label: t("pdf.uploadTab"), icon: Upload },
    { key: "transactions", label: t("pdf.transactionsTab"), icon: List },
    { key: "bankAccounts", label: t("pdf.bankAccountsTab"), icon: Landmark },
  ];

  return (
    <div className="statements-page page-enter">
      <h1 className="page-title">{t("nav.statements")}</h1>

      <div className="settings-tabs">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={clsx("settings-tab", activeTab === key && "settings-tab--active")}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="settings-content">
        {activeTab === "upload" && <PdfUploadTab />}
        {activeTab === "transactions" && <TransactionsTab />}
        {activeTab === "bankAccounts" && <BankAccountsTab />}
      </div>
    </div>
  );
}

function BankAccountsTab() {
  const { t } = useTranslation();

  return (
    <div className="bank-accounts-placeholder">
      <Landmark size={48} strokeWidth={1.5} />
      <p>{t("pdf.bankAccountsPlaceholder")}</p>
    </div>
  );
}
