import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "./stores/auth.js";
import { useThemeStore } from "./stores/theme.js";
import ProtectedRoute from "./components/ProtectedRoute.js";
import GuestRoute from "./components/GuestRoute.js";
import AppLayout from "./components/layout/AppLayout.js";
import Login from "./pages/Login.js";
import Register from "./pages/Register.js";
import Dashboard from "./pages/Dashboard.js";
import Settings from "./pages/Settings.js";
import DdsOperations from "./pages/DdsOperations.js";
import Statements from "./pages/Statements.js";
import "./i18n/index.js";
import "./styles/theme.css";
import "./styles/auth.css";
import "./styles/layout.css";
import "./styles/ui.css";
import "./styles/settings.css";
import "./styles/dds.css";
import "./styles/pdf.css";

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
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      {/* Guest-only routes */}
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Protected routes with layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dds" element={<DdsOperations />} />
          <Route path="/pdf" element={<Statements />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
