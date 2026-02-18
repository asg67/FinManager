import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Link as LinkIcon, AlertCircle } from "lucide-react";
import { useAuthStore } from "../../stores/auth.js";
import { companyApi } from "../../api/company.js";
import { authApi } from "../../api/auth.js";
import { ApiError } from "../../api/client.js";
import { Button, Input } from "../ui/index.js";

export default function CompanySetup() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");

  return (
    <div className="company-setup">
      {mode === "choose" && <ChooseMode onMode={setMode} />}
      {mode === "create" && <CreateCompany onBack={() => setMode("choose")} />}
      {mode === "join" && <JoinCompany onBack={() => setMode("choose")} />}
    </div>
  );
}

function ChooseMode({ onMode }: { onMode: (m: "create" | "join") => void }) {
  const { t } = useTranslation();

  return (
    <div className="company-setup__choose">
      <p className="company-setup__subtitle">{t("dds.setupRequired")}</p>

      <div className="company-setup__options">
        <button
          type="button"
          className="company-setup__option"
          onClick={() => onMode("create")}
        >
          <Building2 size={32} />
          <span className="company-setup__option-title">{t("dds.createCompanyOption")}</span>
          <span className="company-setup__option-desc">{t("dds.createCompanyDesc")}</span>
        </button>

        <button
          type="button"
          className="company-setup__option"
          onClick={() => onMode("join")}
        >
          <LinkIcon size={32} />
          <span className="company-setup__option-title">{t("dds.joinCompanyOption")}</span>
          <span className="company-setup__option-desc">{t("dds.joinCompanyDesc")}</span>
        </button>
      </div>
    </div>
  );
}

function CreateCompany({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await companyApi.create({ name: name.trim() });
      const me = await authApi.getMe();
      useAuthStore.setState({ user: me });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError(t("dds.companyNameTaken"));
        } else {
          setError(err.message);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="company-setup__form-card">
      <h2 className="company-setup__form-title">{t("dds.createCompanyOption")}</h2>

      {error && (
        <div className="company-setup__error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Input
          label={t("onboarding.companyName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("onboarding.companyPlaceholder")}
          required
          autoFocus
        />
        <div className="company-setup__actions">
          <Button variant="secondary" type="button" onClick={onBack}>
            {t("onboarding.back")}
          </Button>
          <Button type="submit" loading={saving} disabled={!name.trim()}>
            {t("onboarding.createCompany")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function JoinCompany({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [inviteInput, setInviteInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [companyName, setCompanyName] = useState<string | null>(null);

  function extractToken(input: string): string {
    // Accept full URL or just the token
    const match = input.match(/[?&]invite=([a-f0-9-]+)/i);
    if (match) return match[1];
    // If it looks like a UUID, return as-is
    const trimmed = input.trim();
    if (/^[a-f0-9-]{36}$/i.test(trimmed)) return trimmed;
    return trimmed;
  }

  async function handleCheck(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCompanyName(null);
    const token = extractToken(inviteInput);
    if (!token) return;

    setChecking(true);
    try {
      const res = await companyApi.checkInvite(token);
      setCompanyName(res.companyName);
    } catch {
      setError(t("auth.inviteExpired"));
    } finally {
      setChecking(false);
    }
  }

  // If invite is valid, user needs to re-register via invite link
  // But since they're already logged in, we show them the company name
  // and explain they need to use the invite link during registration
  const token = extractToken(inviteInput);

  return (
    <div className="company-setup__form-card">
      <h2 className="company-setup__form-title">{t("dds.joinCompanyOption")}</h2>
      <p className="company-setup__hint">{t("dds.pasteInviteHint")}</p>

      {error && (
        <div className="company-setup__error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {companyName && (
        <div className="company-setup__invite-found">
          <p>{t("dds.inviteForCompany", { company: companyName })}</p>
          <p className="company-setup__hint">{t("dds.inviteReregisterHint")}</p>
        </div>
      )}

      <form onSubmit={handleCheck}>
        <Input
          label={t("dds.inviteLink")}
          value={inviteInput}
          onChange={(e) => setInviteInput(e.target.value)}
          placeholder="https://fm.../register?invite=..."
          required
          autoFocus
        />
        <div className="company-setup__actions">
          <Button variant="secondary" type="button" onClick={onBack}>
            {t("onboarding.back")}
          </Button>
          <Button type="submit" loading={checking} disabled={!inviteInput.trim()}>
            {t("dds.checkInvite")}
          </Button>
        </div>
      </form>
    </div>
  );
}
