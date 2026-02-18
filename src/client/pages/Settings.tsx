import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Wallet, Tags, FileText, Users, Briefcase, UserCog } from "lucide-react";
import clsx from "clsx";
import { useAuthStore } from "../stores/auth.js";
import ProfileTab from "../components/settings/ProfileTab.js";
import CompanyTab from "../components/settings/CompanyTab.js";
import EntitiesTab from "../components/settings/EntitiesTab.js";
import AccountsTab from "../components/settings/AccountsTab.js";
import ExpensesTab from "../components/settings/ExpensesTab.js";
import TemplatesTab from "../components/settings/TemplatesTab.js";
import EmployeesTab from "../components/settings/EmployeesTab.js";

type Tab = "profile" | "company" | "entities" | "accounts" | "expenses" | "templates" | "employees";

export default function Settings() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === "owner";
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  const tabs: { key: Tab; label: string; icon: typeof Building2 }[] = [
    { key: "profile", label: t("profile.title"), icon: UserCog },
    ...(isOwner ? [
      { key: "company" as Tab, label: t("company.title"), icon: Briefcase },
      { key: "entities" as Tab, label: t("settings.entities"), icon: Building2 },
      { key: "accounts" as Tab, label: t("settings.accounts"), icon: Wallet },
      { key: "expenses" as Tab, label: t("settings.expenses"), icon: Tags },
      { key: "templates" as Tab, label: t("settings.templates"), icon: FileText },
      { key: "employees" as Tab, label: t("nav.employees"), icon: Users },
    ] : []),
  ];

  return (
    <div className="settings-page page-enter">
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
        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "company" && <CompanyTab />}
        {activeTab === "entities" && <EntitiesTab />}
        {activeTab === "accounts" && <AccountsTab />}
        {activeTab === "expenses" && <ExpensesTab />}
        {activeTab === "templates" && <TemplatesTab />}
        {activeTab === "employees" && <EmployeesTab />}
      </div>
    </div>
  );
}
