import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Landmark,
  Wallet,
  Tags,
  Plus,
  Pencil,
  Trash2,
  Check,
  ChevronRight,
  Copy,
  Link as LinkIcon,
} from "lucide-react";
import clsx from "clsx";
import { useAuthStore } from "../../stores/auth.js";
import { companyApi } from "../../api/company.js";
import { entitiesApi } from "../../api/entities.js";
import { accountsApi, type CreateAccountPayload } from "../../api/accounts.js";
import { expensesApi } from "../../api/expenses.js";
import { authApi } from "../../api/auth.js";
import { Button, Input, Select, Modal } from "../ui/index.js";
import type { Entity, Account, ExpenseType } from "@shared/types.js";

const ACCOUNT_TYPES = [
  { value: "checking", labelKey: "settings.typeChecking" },
  { value: "card", labelKey: "settings.typeCard" },
  { value: "cash", labelKey: "settings.typeCash" },
  { value: "deposit", labelKey: "settings.typeDeposit" },
];

const BANKS = [
  { value: "sber", label: "Сбер" },
  { value: "tbank", label: "Т-Банк" },
  { value: "module", label: "Модуль" },
  { value: "other", label: "Другой" },
];

type Step = 0 | 1 | 2 | 3;

export default function OnboardingWizard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState<Step>(0);
  const [completing, setCompleting] = useState(false);

  // Check if company already created → skip step 0
  useEffect(() => {
    if (user?.companyId && user.company) {
      setStep(1);
    }
  }, []);

  const steps = [
    { icon: Building2, label: t("onboarding.stepCompany") },
    { icon: Landmark, label: t("onboarding.stepEntities") },
    { icon: Wallet, label: t("onboarding.stepAccounts") },
    { icon: Tags, label: t("onboarding.stepExpenses") },
  ];

  async function handleComplete() {
    setCompleting(true);
    try {
      await companyApi.completeOnboarding();
      const me = await authApi.getMe();
      useAuthStore.setState({ user: me });
    } catch {
      setCompleting(false);
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding__container">
        <h1 className="onboarding__title">FinManager</h1>
        <p className="onboarding__subtitle">{t("onboarding.subtitle")}</p>

        {/* Stepper */}
        <div className="onboarding__stepper">
          {steps.map(({ icon: Icon, label }, i) => (
            <div
              key={i}
              className={clsx(
                "onboarding__step-indicator",
                i < step && "onboarding__step-indicator--done",
                i === step && "onboarding__step-indicator--active",
              )}
            >
              <div className="onboarding__step-circle">
                {i < step ? <Check size={16} /> : <Icon size={16} />}
              </div>
              <span className="onboarding__step-label">{label}</span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="onboarding__card">
          {step === 0 && <StepCompany onNext={() => setStep(1)} />}
          {step === 1 && <StepEntities onNext={() => setStep(2)} onBack={() => setStep(0)} />}
          {step === 2 && <StepAccounts onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && (
            <StepExpenses
              onComplete={handleComplete}
              onBack={() => setStep(2)}
              completing={completing}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Step 0: Company ─── */

function StepCompany({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const company = await companyApi.create({ name: companyName });
      const me = await authApi.getMe();
      useAuthStore.setState({ user: me });
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  }

  const user = useAuthStore((s) => s.user);
  const hasCompany = !!user?.companyId;

  async function handleCreateInvite() {
    try {
      const inv = await companyApi.createInvite();
      const link = `${window.location.origin}/register?invite=${inv.token}`;
      setInviteLink(link);
    } catch {
      // handled
    }
  }

  function handleCopy() {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div>
      <h2 className="onboarding__step-title">{t("onboarding.companyTitle")}</h2>

      {!hasCompany ? (
        <form onSubmit={handleCreate}>
          <Input
            label={t("onboarding.companyName")}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={t("onboarding.companyPlaceholder")}
            required
            autoFocus
          />
          <div className="onboarding__actions">
            <Button type="submit" loading={saving}>
              {t("onboarding.createCompany")}
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <p className="onboarding__success">
            <Check size={18} /> {t("onboarding.companyCreated", { name: user?.company?.name })}
          </p>

          <div className="onboarding__invite-section">
            <p className="onboarding__invite-hint">{t("onboarding.inviteHint")}</p>
            {!inviteLink ? (
              <Button variant="secondary" size="sm" onClick={handleCreateInvite}>
                <LinkIcon size={16} />
                {t("onboarding.createInvite")}
              </Button>
            ) : (
              <div className="onboarding__invite-link">
                <code>{inviteLink}</code>
                <button type="button" className="icon-btn" onClick={handleCopy} title={t("onboarding.copy")}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            )}
          </div>

          <div className="onboarding__actions">
            <Button onClick={onNext}>
              {t("onboarding.next")} <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Step 1: Entities ─── */

function StepEntities({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function load() {
    const data = await entitiesApi.list();
    setEntities(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await entitiesApi.create({ name: name.trim() });
      setName("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    await entitiesApi.update(id, { name: editName.trim() });
    setEditId(null);
    await load();
  }

  async function handleDelete(id: string) {
    await entitiesApi.delete(id);
    await load();
  }

  return (
    <div>
      <h2 className="onboarding__step-title">{t("onboarding.entitiesTitle")}</h2>
      <p className="onboarding__hint">{t("onboarding.entitiesHint")}</p>

      <form onSubmit={handleAdd} className="onboarding__inline-form">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("settings.entityPlaceholder")}
          autoFocus
        />
        <Button type="submit" size="sm" loading={saving} disabled={!name.trim()}>
          <Plus size={16} /> {t("common.add")}
        </Button>
      </form>

      {loading ? (
        <div className="tab-loading">{t("common.loading")}</div>
      ) : (
        <ul className="onboarding__list">
          {entities.map((ent) => (
            <li key={ent.id} className="onboarding__list-item">
              {editId === ent.id ? (
                <div className="onboarding__inline-form">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                  <Button size="sm" onClick={() => handleSaveEdit(ent.id)}>
                    <Check size={14} />
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditId(null)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              ) : (
                <>
                  <span>{ent.name}</span>
                  <div className="onboarding__list-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        setEditId(ent.id);
                        setEditName(ent.name);
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => handleDelete(ent.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="onboarding__actions">
        <Button variant="secondary" onClick={onBack}>
          {t("onboarding.back")}
        </Button>
        <Button onClick={onNext} disabled={entities.length === 0}>
          {t("onboarding.next")} <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}

/* ─── Step 2: Accounts ─── */

function StepAccounts({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAccounts, setTotalAccounts] = useState(0);

  // Form
  const [form, setForm] = useState<CreateAccountPayload>({ name: "", type: "checking" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    entitiesApi.list().then((data) => {
      setEntities(data);
      if (data.length > 0) setSelectedEntity(data[0].id);
      setLoading(false);
    });
  }, []);

  async function loadAccounts() {
    if (!selectedEntity) return;
    const data = await accountsApi.list(selectedEntity);
    setAccounts(data);
  }

  async function countTotal() {
    let total = 0;
    for (const ent of entities) {
      const accs = await accountsApi.list(ent.id);
      total += accs.length;
    }
    setTotalAccounts(total);
  }

  useEffect(() => {
    if (selectedEntity) loadAccounts();
  }, [selectedEntity]);

  useEffect(() => {
    if (entities.length > 0) countTotal();
  }, [entities, accounts]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await accountsApi.create(selectedEntity, form);
      setForm({ name: "", type: "checking" });
      await loadAccounts();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await accountsApi.delete(selectedEntity, id);
    await loadAccounts();
  }

  const showBank = form.type !== "cash";

  return (
    <div>
      <h2 className="onboarding__step-title">{t("onboarding.accountsTitle")}</h2>
      <p className="onboarding__hint">{t("onboarding.accountsHint")}</p>

      {entities.length > 1 && (
        <Select
          options={entities.map((e) => ({ value: e.id, label: e.name }))}
          value={selectedEntity}
          onChange={(e) => setSelectedEntity(e.target.value)}
          label={t("settings.selectEntity")}
        />
      )}

      <form onSubmit={handleAdd} className="onboarding__account-form">
        <Input
          label={t("settings.accountName")}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          autoFocus
        />
        <Select
          label={t("settings.accountType")}
          options={ACCOUNT_TYPES.map((a) => ({ value: a.value, label: t(a.labelKey) }))}
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        />
        {showBank && (
          <Select
            label={t("settings.bank")}
            options={BANKS}
            value={form.bank ?? ""}
            onChange={(e) => setForm({ ...form, bank: e.target.value || undefined })}
            placeholder={t("settings.selectBank")}
          />
        )}
        <Button type="submit" size="sm" loading={saving} disabled={!form.name.trim()}>
          <Plus size={16} /> {t("common.add")}
        </Button>
      </form>

      {loading ? (
        <div className="tab-loading">{t("common.loading")}</div>
      ) : (
        <ul className="onboarding__list">
          {accounts.map((acc) => (
            <li key={acc.id} className="onboarding__list-item">
              <span>
                {acc.name}{" "}
                <span className="onboarding__list-meta">
                  {ACCOUNT_TYPES.find((a) => a.value === acc.type)
                    ? t(ACCOUNT_TYPES.find((a) => a.value === acc.type)!.labelKey)
                    : acc.type}
                </span>
              </span>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                onClick={() => handleDelete(acc.id)}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="onboarding__actions">
        <Button variant="secondary" onClick={onBack}>
          {t("onboarding.back")}
        </Button>
        <Button onClick={onNext} disabled={totalAccounts === 0}>
          {t("onboarding.next")} <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}

/* ─── Step 3: Expense Categories ─── */

function StepExpenses({
  onComplete,
  onBack,
  completing,
}: {
  onComplete: () => void;
  onBack: () => void;
  completing: boolean;
}) {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [types, setTypes] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalTypes, setTotalTypes] = useState(0);

  // Form
  const [typeName, setTypeName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    entitiesApi.list().then((data) => {
      setEntities(data);
      if (data.length > 0) setSelectedEntity(data[0].id);
      setLoading(false);
    });
  }, []);

  async function loadTypes() {
    if (!selectedEntity) return;
    const data = await expensesApi.listTypes(selectedEntity);
    setTypes(data);
  }

  async function countTotal() {
    let total = 0;
    for (const ent of entities) {
      const data = await expensesApi.listTypes(ent.id);
      total += data.length;
    }
    setTotalTypes(total);
  }

  useEffect(() => {
    if (selectedEntity) loadTypes();
  }, [selectedEntity]);

  useEffect(() => {
    if (entities.length > 0) countTotal();
  }, [entities, types]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!typeName.trim()) return;
    setSaving(true);
    try {
      await expensesApi.createType(selectedEntity, { name: typeName.trim() });
      setTypeName("");
      await loadTypes();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await expensesApi.deleteType(selectedEntity, id);
    await loadTypes();
  }

  return (
    <div>
      <h2 className="onboarding__step-title">{t("onboarding.expensesTitle")}</h2>
      <p className="onboarding__hint">{t("onboarding.expensesHint")}</p>

      {entities.length > 1 && (
        <Select
          options={entities.map((e) => ({ value: e.id, label: e.name }))}
          value={selectedEntity}
          onChange={(e) => setSelectedEntity(e.target.value)}
          label={t("settings.selectEntity")}
        />
      )}

      <form onSubmit={handleAdd} className="onboarding__inline-form">
        <Input
          value={typeName}
          onChange={(e) => setTypeName(e.target.value)}
          placeholder={t("onboarding.expensePlaceholder")}
          autoFocus
        />
        <Button type="submit" size="sm" loading={saving} disabled={!typeName.trim()}>
          <Plus size={16} /> {t("common.add")}
        </Button>
      </form>

      {loading ? (
        <div className="tab-loading">{t("common.loading")}</div>
      ) : (
        <ul className="onboarding__list">
          {types.map((type) => (
            <li key={type.id} className="onboarding__list-item">
              <span>{type.name}</span>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                onClick={() => handleDelete(type.id)}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="onboarding__actions">
        <Button variant="secondary" onClick={onBack}>
          {t("onboarding.back")}
        </Button>
        <Button onClick={onComplete} disabled={totalTypes === 0} loading={completing}>
          <Check size={16} /> {t("onboarding.finish")}
        </Button>
      </div>
    </div>
  );
}
