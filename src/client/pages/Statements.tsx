import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, List } from "lucide-react";
import clsx from "clsx";
import PdfUploadTab from "../components/pdf/PdfUploadTab.js";
import TransactionsTab from "../components/pdf/TransactionsTab.js";

type Tab = "upload" | "transactions";

export default function Statements() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("upload");

  const tabs: { key: Tab; label: string; icon: typeof Upload }[] = [
    { key: "upload", label: t("pdf.uploadTab"), icon: Upload },
    { key: "transactions", label: t("pdf.transactionsTab"), icon: List },
  ];

  return (
    <div className="statements-page">
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
      </div>
    </div>
  );
}
