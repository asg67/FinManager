import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/auth.js";

export default function Dashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <h1 className="page-title">{t("dashboard.title")}</h1>
      <div className="card-grid">
        <div className="card">
          <div className="card__label">{t("dashboard.welcome")}</div>
          <div className="card__value">{user?.name}</div>
        </div>
        <div className="card">
          <div className="card__label">{t("common.email")}</div>
          <div className="card__value">{user?.email}</div>
        </div>
        <div className="card">
          <div className="card__label">{t("dashboard.role")}</div>
          <div className="card__value">
            {user?.role === "owner" ? t("dashboard.owner") : t("dashboard.employee")}
          </div>
        </div>
      </div>
    </div>
  );
}
