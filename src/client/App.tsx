import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "./stores/auth.js";
import { useThemeStore } from "./stores/theme.js";
import ProtectedRoute from "./components/ProtectedRoute.js";
import GuestRoute from "./components/GuestRoute.js";
import AppLayout from "./components/layout/AppLayout.js";
import ToastContainer from "./components/ui/ToastContainer.js";
import Login from "./pages/Login.js";
import Register from "./pages/Register.js";
import "./i18n/index.js";
import "./styles/theme.css";
import "./styles/auth.css";
import "./styles/layout.css";
import "./styles/ui.css";
import "./styles/settings.css";
import "./styles/dds.css";
import "./styles/pdf.css";
import "./styles/dashboard.css";
import "./styles/bank-accounts.css";
import "./styles/onboarding.css";
import "./styles/datepicker.css";
import "./styles/admin.css";
import "./styles/manager.css";

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard.js"));
const DdsOperations = lazy(() => import("./pages/DdsOperations.js"));
const Settings = lazy(() => import("./pages/Settings.js"));
const Statements = lazy(() => import("./pages/Statements.js"));
const StatementDetail = lazy(() => import("./pages/StatementDetail.js"));
const BankAccounts = lazy(() => import("./pages/BankAccounts.js"));
const BankConnectionDetail = lazy(() => import("./pages/BankConnectionDetail.js"));
const Admin = lazy(() => import("./pages/Admin.js"));
const ShareTarget = lazy(() => import("./pages/ShareTarget.js"));
const ManagerCabinet = lazy(() => import("./pages/manager/ManagerCabinet.js"));
const ManagerCompanyView = lazy(() => import("./pages/manager/ManagerCompanyView.js"));

export default function App() {
  const { i18n } = useTranslation();
  const init = useAuthStore((s) => s.init);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const user = useAuthStore((s) => s.user);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    init();
  }, [init]);

  // Sync theme from user profile after login/init
  useEffect(() => {
    if (user?.theme === "dark" || user?.theme === "light") {
      setTheme(user.theme);
    }
  }, [user?.theme, setTheme]);

  // Sync language from user profile after login/init
  useEffect(() => {
    if (user?.language && (user.language === "ru" || user.language === "en")) {
      i18n.changeLanguage(user.language);
      localStorage.setItem("language", user.language);
    }
  }, [user?.language, i18n]);

  if (!isInitialized) {
    return (
      <div className="auth-page" style={{ background: "var(--bg-base)", color: "var(--text-secondary)" }}>
        <div className="skeleton skeleton--text" style={{ width: 120 }} />
      </div>
    );
  }

  const pageFallback = (
    <div className="tab-loading" style={{ padding: "3rem", textAlign: "center" }}>
      <div className="skeleton skeleton--text" style={{ width: 200, margin: "0 auto" }} />
    </div>
  );

  // Owner (admin) always sees admin panel, regular users see normal app
  const isOwner = user?.role === "owner";
  const isManager = user?.role === "manager";

  return (
    <>
      <Routes>
        {/* Guest-only routes */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          {isOwner ? (
            <>
              {/* Admin — full screen, no sidebar, all routes redirect here */}
              <Route path="/admin" element={<Suspense fallback={pageFallback}><Admin /></Suspense>} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </>
          ) : isManager ? (
            <>
              {/* Manager cabinet — own layout, no sidebar */}
              <Route path="/manager" element={<Suspense fallback={pageFallback}><ManagerCabinet /></Suspense>} />
              <Route path="/manager/:companyId" element={<Suspense fallback={pageFallback}><ManagerCompanyView /></Suspense>} />
              <Route path="*" element={<Navigate to="/manager" replace />} />
            </>
          ) : (
            <>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Suspense fallback={pageFallback}><Dashboard /></Suspense>} />
                <Route path="/dds" element={<Suspense fallback={pageFallback}><DdsOperations /></Suspense>} />
                <Route path="/pdf" element={<Suspense fallback={pageFallback}><Statements /></Suspense>} />
                <Route path="/pdf/:bankCode" element={<Suspense fallback={pageFallback}><StatementDetail /></Suspense>} />
                <Route path="/bank-accounts" element={<Suspense fallback={pageFallback}><BankAccounts /></Suspense>} />
                <Route path="/bank-accounts/:id" element={<Suspense fallback={pageFallback}><BankConnectionDetail /></Suspense>} />
                <Route path="/settings" element={<Suspense fallback={pageFallback}><Settings /></Suspense>} />
                <Route path="/share-target" element={<Suspense fallback={pageFallback}><ShareTarget /></Suspense>} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Route>

        {/* Fallback for non-authenticated */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <ToastContainer />
    </>
  );
}
