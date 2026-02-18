import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/auth.js";
import { companyApi } from "../api/company.js";
import { setAccessToken } from "../api/client.js";

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, isLoading, error, clearError } = useAuthStore();

  const inviteToken = searchParams.get("invite");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check invite validity
  useEffect(() => {
    if (inviteToken) {
      companyApi.checkInvite(inviteToken).then(
        (res) => setCompanyName(res.companyName),
        () => setInviteError(true),
      );
    }
  }, [inviteToken]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError("");

    if (password !== confirmPassword) {
      setLocalError(t("auth.passwordsMismatch"));
      return;
    }

    try {
      if (inviteToken) {
        // Register via invite
        setSubmitting(true);
        const res = await companyApi.registerInvite({
          email,
          password,
          name,
          token: inviteToken,
        });
        setAccessToken(res.accessToken);
        localStorage.setItem("refreshToken", res.refreshToken);
        useAuthStore.setState({ user: res.user });
        navigate("/");
      } else {
        await register({ email, password, name });
        navigate("/");
      }
    } catch (err: any) {
      if (err?.message) setLocalError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const displayError = localError || error;
  const loading = isLoading || submitting;

  if (inviteToken && inviteError) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>FinManager</h1>
          <div className="auth-error" role="alert">
            {t("auth.inviteExpired")}
          </div>
          <p className="auth-link">
            <Link to="/register">{t("auth.registerAction")}</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>FinManager</h1>
        <h2>{t("auth.register")}</h2>

        {inviteToken && companyName && (
          <p className="auth-invite-info">
            {t("auth.inviteJoin", { company: companyName })}
          </p>
        )}

        {displayError && (
          <div className="auth-error" role="alert">
            {displayError}
            <button
              type="button"
              onClick={() => {
                setLocalError("");
                clearError();
              }}
              aria-label={t("common.close")}
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">{t("auth.name")}</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder={t("auth.namePlaceholder")}
            />
          </div>

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
              autoComplete="new-password"
              minLength={6}
              placeholder={t("auth.passwordPlaceholder")}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{t("auth.confirmPassword")}</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
              placeholder={t("auth.confirmPlaceholder")}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? t("auth.registerLoading") : t("auth.registerAction")}
          </button>
        </form>

        <p className="auth-link">
          {t("auth.hasAccount")} <Link to="/login">{t("auth.loginAction")}</Link>
        </p>
      </div>
    </div>
  );
}
