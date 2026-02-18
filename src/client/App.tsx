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
import "./styles/onboarding.css";

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard.js"));
const DdsOperations = lazy(() => import("./pages/DdsOperations.js"));
const Settings = lazy(() => import("./pages/Settings.js"));
const Statements = lazy(() => import("./pages/Statements.js"));
const Admin = lazy(() => import("./pages/Admin.js"));
const ShareTarget = lazy(() => import("./pages/ShareTarget.js"));

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

  return (
    <>
      <Routes>
        {/* Guest-only routes */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Protected routes with layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Suspense fallback={pageFallback}><Dashboard /></Suspense>} />
            <Route path="/dds" element={<Suspense fallback={pageFallback}><DdsOperations /></Suspense>} />
            <Route path="/pdf" element={<Suspense fallback={pageFallback}><Statements /></Suspense>} />
            <Route path="/settings" element={<Suspense fallback={pageFallback}><Settings /></Suspense>} />
            <Route path="/admin" element={<Suspense fallback={pageFallback}><Admin /></Suspense>} />
            <Route path="/share-target" element={<Suspense fallback={pageFallback}><ShareTarget /></Suspense>} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </>
  );
}
