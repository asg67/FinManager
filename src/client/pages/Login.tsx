import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/auth.js";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login({ email, password });
      navigate("/");
    } catch {
      // error is set in store
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>FinManager</h1>
        <h2>{t("auth.login")}</h2>

        {error && (
          <div className="auth-error" role="alert">
            {error}
            <button type="button" onClick={clearError} aria-label={t("common.close")}>
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">{t("common.email")}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="email@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t("auth.password")}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              minLength={6}
              placeholder="••••••"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? t("auth.loginLoading") : t("auth.loginAction")}
          </button>
        </form>

        <p className="auth-link">
          {t("auth.noAccount")} <Link to="/register">{t("auth.registerAction")}</Link>
        </p>
      </div>
    </div>
  );
}
