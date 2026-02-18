import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { Settings, Plus, Check, Users, Building2 } from "lucide-react";
import { useAuthStore } from "../stores/auth.js";
import { companyApi, type CompanyListItem } from "../api/company.js";
import { authApi } from "../api/auth.js";
import OnboardingWizard from "../components/onboarding/OnboardingWizard.js";
import CompanySetup from "../components/dds/CompanySetup.js";
import { Button, Input, Modal } from "../components/ui/index.js";
import { ApiError } from "../api/client.js";

export default function Admin() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === "owner";

  if (!isOwner) {
    return <Navigate to="/" replace />;
  }

  const hasCompany = !!user?.companyId;
  const onboardingDone = user?.company?.onboardingDone ?? false;

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

  if (!onboardingDone) {
    return <OnboardingWizard />;
  }

  return <CompanyDashboard />;
}

function CompanyDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    setLoading(true);
    try {
      const data = await companyApi.listMyCompanies();
      setCompanies(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitch(companyId: string) {
    setSwitching(companyId);
    try {
      const updatedUser = await companyApi.switchCompany(companyId);
      useAuthStore.setState({ user: updatedUser });
      await loadCompanies();
    } finally {
      setSwitching(null);
    }
  }

  async function handleCreated() {
    setCreateOpen(false);
    const me = await authApi.getMe();
    useAuthStore.setState({ user: me });
  }

  return (
    <div className="dds-page page-enter">
      <div className="page-header">
        <h1 className="page-title">{t("admin.title")}</h1>
        <div className="page-header__actions">
          <Button variant="secondary" onClick={() => navigate("/settings")}>
            <Settings size={18} />
            {t("admin.goToSettings")}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={18} />
            {t("admin.createNewCompany")}
          </Button>
        </div>
      </div>

      <h2 className="admin-section-title">{t("admin.myCompanies")}</h2>

      {loading ? (
        <div className="tab-loading">{t("common.loading")}</div>
      ) : companies.length === 0 ? (
        <p className="text-secondary">{t("admin.noCompanies")}</p>
      ) : (
        <div className="admin-companies">
          {companies.map((c) => (
            <div
              key={c.id}
              className={`admin-company-card ${c.isActive ? "admin-company-card--active" : ""}`}
            >
              <div className="admin-company-card__header">
                <span className="admin-company-card__name">{c.name}</span>
                {c.isActive && (
                  <span className="admin-company-card__badge">{t("admin.active")}</span>
                )}
              </div>
              <div className="admin-company-card__meta">
                <span><Users size={14} /> {c.usersCount}</span>
                <span><Building2 size={14} /> {c.entitiesCount}</span>
                {!c.onboardingDone && (
                  <span className="admin-company-card__setup">
                    {t("onboarding.subtitle")}
                  </span>
                )}
              </div>
              <div className="admin-company-card__actions">
                {c.isActive ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate("/settings")}
                  >
                    <Settings size={14} />
                    {t("admin.goToSettings")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleSwitch(c.id)}
                    loading={switching === c.id}
                  >
                    {t("admin.switchCompany")}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateCompanyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}

function CreateCompanyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setError("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await companyApi.create({ name: name.trim() });
      onCreated();
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
    <Modal open={open} onClose={onClose} title={t("admin.createNewCompany")} size="sm">
      <form onSubmit={handleSubmit} className="wizard-form">
        <Input
          label={t("onboarding.companyName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("onboarding.companyPlaceholder")}
          required
          autoFocus
        />
        {error && <div className="wizard-error">{error}</div>}
        <Modal.Footer>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={saving} disabled={!name.trim()}>
            {t("onboarding.createCompany")}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
