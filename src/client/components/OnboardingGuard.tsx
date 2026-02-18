import { Outlet } from "react-router-dom";
import { useAuthStore } from "../stores/auth.js";
import OnboardingWizard from "./onboarding/OnboardingWizard.js";

export default function OnboardingGuard() {
  const user = useAuthStore((s) => s.user);

  // Members (invited via link) skip onboarding — owner does it
  if (user?.role === "owner" && (!user.companyId || !user.company?.onboardingDone)) {
    return <OnboardingWizard />;
  }

  return <Outlet />;
}
