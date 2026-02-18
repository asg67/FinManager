import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth.js";
import OnboardingWizard from "../components/onboarding/OnboardingWizard.js";
import CompanySetup from "../components/dds/CompanySetup.js";

export default function Admin() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === "owner";

  // Non-owners cannot access admin
  if (!isOwner) {
    return <Navigate to="/" replace />;
  }

  const hasCompany = !!user?.companyId;
  const onboardingDone = user?.company?.onboardingDone ?? false;

  // No company yet → show CompanySetup (create or join)
  if (!hasCompany) {
    return (
      <div className="dds-page page-enter">
        <div className="page-header">
          <h1 className="page-title">{t("nav.admin")}</h1>
        </div>
        <CompanySetup />
      </div>
    );
  }

  // Company exists but onboarding not done → show OnboardingWizard
  if (!onboardingDone) {
    return <OnboardingWizard />;
  }

  // Onboarding done → redirect to settings (admin manages settings there)
  return <Navigate to="/settings" replace />;
}
