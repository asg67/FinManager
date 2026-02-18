import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Landmark,
  Wallet,
  Tags,
  Plus,
  Pencil,
  Trash2,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useAuthStore } from "../../stores/auth.js";
import { companyApi } from "../../api/company.js";
import { entitiesApi } from "../../api/entities.js";
import { accountsApi, type CreateAccountPayload } from "../../api/accounts.js";
import { expensesApi } from "../../api/expenses.js";
import { authApi } from "../../api/auth.js";
import { Button, Input, Select } from "../ui/index.js";
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

function generateAccountName(
  type: string,
  bank: string | undefined,
  entityName: string,
  userName: string,
): string {
  const bankLabel =
    bank && bank !== "other"
      ? BANKS.find((b) => b.value === bank)?.label
      : undefined;
  switch (type) {
    case "checking":
      return bankLabel ? `р/с ${bankLabel} ${entityName}` : `р/с ${entityName}`;
    case "card":
      return bankLabel
        ? `Карта ${bankLabel} ${entityName}`
        : `Карта ${entityName}`;
    case "cash":
      return `Наличные ${userName}`;
    case "deposit":
      return `Депозит ${userName}`;
    default:
      return "";
  }
}

export default function OnboardingWizard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [completing, setCompleting] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(true);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [totalTypes, setTotalTypes] = useState(0);

  async function loadEntities() {
    const data = await entitiesApi.list();
    setEntities(data);
    setEntitiesLoading(false);
  }

  useEffect(() => {
    loadEntities();
  }, []);

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

  const canComplete = entities.length > 0 && totalAccounts > 0 && totalTypes > 0;

  return (
    <div className="onboarding">
      <div className="onboarding__container">
        <h1 className="onboarding__title">
          {user?.company?.name ?? "FinManager"}
        </h1>
        <p className="onboarding__subtitle">{t("onboarding.subtitle")}</p>

        {/* Section 1: Entities */}
        <div className="onboarding__section">
          <div className="onboarding__section-header">
            <Landmark size={18} className="onboarding__section-icon" />
            <h2 className="onboarding__section-title">
              {t("onboarding.entitiesTitle")}
            </h2>
            {entities.length > 0 && (
              <span className="onboarding__badge">{entities.length}</span>
            )}
          </div>
          <p className="onboarding__hint">{t("onboarding.entitiesHint")}</p>
          <EntitiesBlock
            entities={entities}
            loading={entitiesLoading}
            onReload={loadEntities}
          />
        </div>

        {/* Section 2: Accounts */}
        {entities.length > 0 && (
          <div className="onboarding__section">
            <div className="onboarding__section-header">
              <Wallet size={18} className="onboarding__section-icon" />
              <h2 className="onboarding__section-title">
                {t("onboarding.accountsTitle")}
              </h2>
              {totalAccounts > 0 && (
                <span className="onboarding__badge">{totalAccounts}</span>
              )}
            </div>
            <p className="onboarding__hint">{t("onboarding.accountsHint")}</p>
            <AccountsBlock
              entities={entities}
              userName={user?.name ?? ""}
              onTotalChange={setTotalAccounts}
            />
          </div>
        )}

        {/* Section 3: Expense Categories */}
        {entities.length > 0 && (
          <div className="onboarding__section">
            <div className="onboarding__section-header">
              <Tags size={18} className="onboarding__section-icon" />
              <h2 className="onboarding__section-title">
                {t("onboarding.expensesTitle")}
              </h2>
              {totalTypes > 0 && (
                <span className="onboarding__badge">{totalTypes}</span>
              )}
            </div>
            <p className="onboarding__hint">{t("onboarding.expensesHint")}</p>
            <ExpensesBlock
              entities={entities}
              onTotalChange={setTotalTypes}
            />
          </div>
        )}

        {/* Complete */}
        <div className="onboarding__complete">
          <Button
            onClick={handleComplete}
            disabled={!canComplete}
            loading={completing}
          >
            <Check size={16} /> {t("onboarding.finish")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Entities Block ─── */

function EntitiesBlock({
  entities,
  loading,
  onReload,
}: {
  entities: Entity[];
  loading: boolean;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await entitiesApi.create({ name: name.trim() });
      setName("");
      await onReload();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    await entitiesApi.update(id, { name: editName.trim() });
    setEditId(null);
    await onReload();
  }

  async function handleDelete(id: string) {
    await entitiesApi.delete(id);
    await onReload();
  }

  return (
    <div>
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
        entities.length > 0 && (
          <ul className="onboarding__list">
            {entities.map((ent) => (
              <li key={ent.id} className="onboarding__list-item">
                {editId === ent.id ? (
                  <div className="onboarding__inline-form onboarding__inline-form--nested">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <Button size="sm" onClick={() => handleSaveEdit(ent.id)}>
                      <Check size={14} />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditId(null)}
                    >
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
        )
      )}
    </div>
  );
}

/* ─── Accounts Block ─── */

function AccountsBlock({
  entities,
  userName,
  onTotalChange,
}: {
  entities: Entity[];
  userName: string;
  onTotalChange: (total: number) => void;
}) {
  const { t } = useTranslation();
  const [selectedEntity, setSelectedEntity] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountType, setAccountType] = useState("checking");
  const [accountBank, setAccountBank] = useState("");
  const [accountName, setAccountName] = useState("");

  // Sync selected entity when entities change
  useEffect(() => {
    if (entities.length > 0) {
      if (!selectedEntity || !entities.find((e) => e.id === selectedEntity)) {
        setSelectedEntity(entities[0].id);
      }
    }
  }, [entities]);

  async function loadAccounts() {
    if (!selectedEntity) return;
    const data = await accountsApi.list(selectedEntity);
    setAccounts(data);
    setLoading(false);
  }

  async function countTotal() {
    let total = 0;
    for (const ent of entities) {
      const accs = await accountsApi.list(ent.id);
      total += accs.length;
    }
    onTotalChange(total);
  }

  useEffect(() => {
    if (selectedEntity) loadAccounts();
  }, [selectedEntity]);

  useEffect(() => {
    if (entities.length > 0) countTotal();
  }, [entities, accounts]);

  // Auto-generate name when type/bank/entity changes
  useEffect(() => {
    const entityName =
      entities.find((e) => e.id === selectedEntity)?.name ?? "";
    const newName = generateAccountName(
      accountType,
      accountBank || undefined,
      entityName,
      userName,
    );
    setAccountName(newName);
  }, [accountType, accountBank, selectedEntity, entities, userName]);

  const showBank = accountType !== "cash" && accountType !== "deposit";

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!accountName.trim()) return;
    setSaving(true);
    try {
      const payload: CreateAccountPayload = {
        name: accountName.trim(),
        type: accountType,
      };
      if (showBank && accountBank) {
        payload.bank = accountBank;
      }
      await accountsApi.create(selectedEntity, payload);
      setAccountType("checking");
      setAccountBank("");
      await loadAccounts();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await accountsApi.delete(selectedEntity, id);
    await loadAccounts();
  }

  return (
    <div>
      {entities.length > 1 && (
        <div className="onboarding__entity-select">
          <Select
            options={entities.map((e) => ({ value: e.id, label: e.name }))}
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            label={t("settings.selectEntity")}
          />
        </div>
      )}

      <form onSubmit={handleAdd} className="onboarding__account-form">
        <div className="onboarding__account-row">
          <Select
            label={t("settings.accountType")}
            options={ACCOUNT_TYPES.map((a) => ({
              value: a.value,
              label: t(a.labelKey),
            }))}
            value={accountType}
            onChange={(e) => {
              setAccountType(e.target.value);
              if (e.target.value === "cash" || e.target.value === "deposit") {
                setAccountBank("");
              }
            }}
          />
          {showBank && (
            <Select
              label={t("settings.bank")}
              options={BANKS}
              value={accountBank}
              onChange={(e) => setAccountBank(e.target.value)}
              placeholder={t("settings.selectBank")}
            />
          )}
        </div>
        <Input
          label={t("settings.accountName")}
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          required
        />
        <Button
          type="submit"
          size="sm"
          loading={saving}
          disabled={!accountName.trim()}
        >
          <Plus size={16} /> {t("common.add")}
        </Button>
      </form>

      {loading ? (
        <div className="tab-loading">{t("common.loading")}</div>
      ) : (
        accounts.length > 0 && (
          <ul className="onboarding__list">
            {accounts.map((acc) => (
              <li key={acc.id} className="onboarding__list-item">
                <span>{acc.name}</span>
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
        )
      )}
    </div>
  );
}

/* ─── Expenses Block ─── */

function ExpensesBlock({
  entities,
  onTotalChange,
}: {
  entities: Entity[];
  onTotalChange: (total: number) => void;
}) {
  const { t } = useTranslation();
  const entityId = entities[0]?.id ?? "";
  const [types, setTypes] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null);
  const [articleName, setArticleName] = useState("");
  const [savingArticle, setSavingArticle] = useState(false);

  async function loadTypes() {
    if (!entityId) return;
    const data = await expensesApi.listTypes(entityId);
    setTypes(data);
    setLoading(false);
  }

  async function countTotal() {
    let total = 0;
    for (const ent of entities) {
      const data = await expensesApi.listTypes(ent.id);
      total += data.length;
    }
    onTotalChange(total);
  }

  useEffect(() => {
    if (entityId) loadTypes();
  }, [entityId]);

  useEffect(() => {
    if (entities.length > 0) countTotal();
  }, [entities, types]);

  async function handleAddType(e: FormEvent) {
    e.preventDefault();
    if (!typeName.trim()) return;
    setSaving(true);
    try {
      const created = await expensesApi.createType(entityId, {
        name: typeName.trim(),
      });
      setTypeName("");
      await loadTypes();
      setExpandedTypeId(created.id);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteType(id: string) {
    await expensesApi.deleteType(entityId, id);
    if (expandedTypeId === id) setExpandedTypeId(null);
    await loadTypes();
  }

  async function handleAddArticle(e: FormEvent, typeId: string) {
    e.preventDefault();
    if (!articleName.trim()) return;
    setSavingArticle(true);
    try {
      await expensesApi.createArticle(entityId, typeId, {
        name: articleName.trim(),
      });
      setArticleName("");
      await loadTypes();
    } finally {
      setSavingArticle(false);
    }
  }

  async function handleDeleteArticle(typeId: string, articleId: string) {
    await expensesApi.deleteArticle(entityId, typeId, articleId);
    await loadTypes();
  }

  return (
    <div>
      <form onSubmit={handleAddType} className="onboarding__inline-form">
        <Input
          value={typeName}
          onChange={(e) => setTypeName(e.target.value)}
          placeholder={t("onboarding.expensePlaceholder")}
        />
        <Button
          type="submit"
          size="sm"
          loading={saving}
          disabled={!typeName.trim()}
        >
          <Plus size={16} /> {t("common.add")}
        </Button>
      </form>

      {loading ? (
        <div className="tab-loading">{t("common.loading")}</div>
      ) : (
        types.length > 0 && (
          <ul className="onboarding__list">
            {types.map((type) => (
              <li key={type.id} className="onboarding__type-item">
                <div className="onboarding__type-header">
                  <button
                    type="button"
                    className="onboarding__type-toggle"
                    onClick={() => {
                      if (expandedTypeId === type.id) {
                        setExpandedTypeId(null);
                      } else {
                        setExpandedTypeId(type.id);
                        setArticleName("");
                      }
                    }}
                  >
                    {expandedTypeId === type.id ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                    <span>{type.name}</span>
                    {type.articles.length > 0 && (
                      <span className="onboarding__list-meta">
                        ({type.articles.length})
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    onClick={() => handleDeleteType(type.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {expandedTypeId === type.id && (
                  <div className="onboarding__articles">
                    {type.articles.map((article) => (
                      <div
                        key={article.id}
                        className="onboarding__article-item"
                      >
                        <span>{article.name}</span>
                        <button
                          type="button"
                          className="icon-btn icon-btn--danger"
                          onClick={() =>
                            handleDeleteArticle(type.id, article.id)
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <form
                      onSubmit={(e) => handleAddArticle(e, type.id)}
                      className="onboarding__inline-form onboarding__inline-form--small"
                    >
                      <Input
                        value={articleName}
                        onChange={(e) => setArticleName(e.target.value)}
                        placeholder={t("onboarding.articlePlaceholder")}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        loading={savingArticle}
                        disabled={!articleName.trim()}
                      >
                        <Plus size={14} />
                      </Button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
