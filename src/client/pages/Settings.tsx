import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Wallet, Tags, FileText } from "lucide-react";
import clsx from "clsx";
import EntitiesTab from "../components/settings/EntitiesTab.js";
import AccountsTab from "../components/settings/AccountsTab.js";
import ExpensesTab from "../components/settings/ExpensesTab.js";
import TemplatesTab from "../components/settings/TemplatesTab.js";

type Tab = "entities" | "accounts" | "expenses" | "templates";

export default function Settings() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("entities");

  const tabs: { key: Tab; label: string; icon: typeof Building2 }[] = [
    { key: "entities", label: t("settings.entities"), icon: Building2 },
    { key: "accounts", label: t("settings.accounts"), icon: Wallet },
    { key: "expenses", label: t("settings.expenses"), icon: Tags },
    { key: "templates", label: t("settings.templates"), icon: FileText },
  ];

  return (
    <div className="settings-page">
      <h1 className="page-title">{t("nav.settings")}</h1>

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
        {activeTab === "entities" && <EntitiesTab />}
        {activeTab === "accounts" && <AccountsTab />}
        {activeTab === "expenses" && <ExpensesTab />}
        {activeTab === "templates" && <TemplatesTab />}
      </div>
    </div>
  );
}
