import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen, Tags, Landmark, Compass, ArrowLeft, ArrowLeftRight,
  ChevronRight, ChevronDown, Plus, Pencil, Trash2, Check, X,
  ToggleLeft, ToggleRight,
  Wallet, CreditCard, Banknote, PiggyBank, Sparkles,
} from "lucide-react";
import clsx from "clsx";
import { directoryApi, type DirExpenseType, type DirExpenseArticle, type DirAccount, type DirDirectionItem, type DirCategoryRule, type DirEntity } from "../api/directory.js";
import { useAuthStore } from "../stores/auth.js";

type Section = "main" | "dds" | "accountsMgmt";
type DdsTab = "articles" | "accounts" | "directions" | "categorization";

export default function Directory() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [section, setSection] = useState<Section>("main");
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    directoryApi.canEdit().then((r) => setCanEdit(r.canEdit)).catch(() => {});
  }, []);

  if (!user?.companyId) {
    return (
      <div className="page-enter" style={{ padding: "2rem" }}>
        <div className="glass-card" style={{ padding: "3rem", textAlign: "center" }}>
          <BookOpen size={48} style={{ color: "#aaa", marginBottom: 16 }} />
          <h2 style={{ marginBottom: 8 }}>{t("nav.directory")}</h2>
          <p style={{ color: "#888" }}>{t("directory.noCompany")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="directory-page page-enter">
      {section !== "main" && (
        <button type="button" className="dir-back-btn" onClick={() => setSection("main")}>
          <ArrowLeft size={18} />
          <span>{t("nav.directory")}</span>
        </button>
      )}

      {section === "main" && <MainView onSelect={setSection} />}
      {section === "dds" && <DdsView canEdit={canEdit} />}
      {section === "accountsMgmt" && <AccountsManageView canEdit={canEdit} />}
    </div>
  );
}

/* ===== MAIN VIEW ===== */
function MainView({ onSelect }: { onSelect: (s: Section) => void }) {
  const { t } = useTranslation();

  return (
    <>
      <h1 className="page-title">{t("nav.directory")}</h1>
      <div className="dir-cards-grid">
        <button type="button" className="glass-card dir-nav-card" onClick={() => onSelect("dds")}>
          <div className="dir-nav-card__icon" style={{ background: "rgba(99,102,241,0.08)", color: "#6366f1" }}>
            <ArrowLeftRight size={24} />
          </div>
          <div className="dir-nav-card__text">
            <h3 className="dir-nav-card__title">{t("directory.ddsBlock")}</h3>
            <p className="dir-nav-card__desc">{t("directory.ddsBlockDesc")}</p>
          </div>
          <ChevronRight size={20} className="dir-nav-card__arrow" />
        </button>

        <button type="button" className="glass-card dir-nav-card" onClick={() => onSelect("accountsMgmt")}>
          <div className="dir-nav-card__icon" style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e" }}>
            <CreditCard size={24} />
          </div>
          <div className="dir-nav-card__text">
            <h3 className="dir-nav-card__title">{t("directory.accountsBlock")}</h3>
            <p className="dir-nav-card__desc">{t("directory.accountsBlockDesc")}</p>
          </div>
          <ChevronRight size={20} className="dir-nav-card__arrow" />
        </button>
      </div>
    </>
  );
}

/* ===== DDS VIEW (tabs: articles, accounts, directions) ===== */
function DdsView({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DdsTab>("articles");

  const tabs: { key: DdsTab; label: string; icon: typeof Tags }[] = [
    { key: "articles", label: t("directory.articles"), icon: Tags },
    { key: "accounts", label: t("directory.accounts"), icon: Landmark },
    { key: "directions", label: t("directory.directions"), icon: Compass },
    { key: "categorization", label: t("directory.categorization"), icon: Sparkles },
  ];

  return (
    <div className="dir-section">
      <h2 className="dir-section__title">{t("directory.ddsBlock")}</h2>

      <div className="dir-tabs">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            className={clsx("dir-tab", tab === tb.key && "dir-tab--active")}
            onClick={() => setTab(tb.key)}
          >
            <tb.icon size={16} />
            <span>{tb.label}</span>
          </button>
        ))}
      </div>

      {tab === "articles" && <ArticlesView canEdit={canEdit} />}
      {tab === "accounts" && <AccountsView canEdit={canEdit} />}
      {tab === "directions" && <DirectionsView />}
      {tab === "categorization" && <CategorizationView canEdit={canEdit} />}
    </div>
  );
}

/* ===== ARTICLES VIEW ===== */
function ArticlesView({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const [types, setTypes] = useState<DirExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());
  const [addingType, setAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [addingArticle, setAddingArticle] = useState<string | null>(null);
  const [newArticleName, setNewArticleName] = useState("");
  const [editingArticle, setEditingArticle] = useState<string | null>(null);
  const [editArticleName, setEditArticleName] = useState("");
  const [addingDirection, setAddingDirection] = useState<string | null>(null);
  const [newDirName, setNewDirName] = useState("");
  const [editingDirection, setEditingDirection] = useState<string | null>(null);
  const [editDirName, setEditDirName] = useState("");

  useEffect(() => {
    directoryApi.listExpenseTypes().then((data) => {
      setTypes(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setExpanded((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleArticle(id: string) {
    setExpandedArticles((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  async function handleAddType() {
    if (!newTypeName.trim()) return;
    const created = await directoryApi.createExpenseType(newTypeName.trim());
    setTypes((prev) => [...prev, created]);
    setNewTypeName("");
    setAddingType(false);
  }

  async function handleUpdateType(id: string) {
    if (!editTypeName.trim()) return;
    const updated = await directoryApi.updateExpenseType(id, editTypeName.trim());
    setTypes((prev) => prev.map((tp) => tp.id === id ? updated : tp));
    setEditingType(null);
  }

  async function handleDeleteType(id: string) {
    if (!confirm(t("settings.deleteTypeConfirm"))) return;
    await directoryApi.deleteExpenseType(id);
    setTypes((prev) => prev.filter((tp) => tp.id !== id));
  }

  async function handleAddArticle(typeId: string) {
    if (!newArticleName.trim()) return;
    const created = await directoryApi.createArticle(typeId, newArticleName.trim());
    setTypes((prev) => prev.map((tp) => tp.id === typeId ? { ...tp, articles: [...tp.articles, { ...created, directions: created.directions || [] }] } : tp));
    setNewArticleName("");
    setAddingArticle(null);
  }

  async function handleUpdateArticle(id: string) {
    if (!editArticleName.trim()) return;
    const updated = await directoryApi.updateArticle(id, editArticleName.trim());
    setTypes((prev) => prev.map((tp) => ({
      ...tp,
      articles: tp.articles.map((a) => a.id === id ? { ...a, name: updated.name, directions: updated.directions || a.directions } : a),
    })));
    setEditingArticle(null);
  }

  async function handleDeleteArticle(id: string, typeId: string) {
    if (!confirm(t("settings.deleteArticleConfirm"))) return;
    await directoryApi.deleteArticle(id);
    setTypes((prev) => prev.map((tp) => tp.id === typeId ? { ...tp, articles: tp.articles.filter((a) => a.id !== id) } : tp));
  }

  async function handleAddDirection(articleId: string) {
    if (!newDirName.trim()) return;
    const created = await directoryApi.createDirection(articleId, newDirName.trim());
    setTypes((prev) => prev.map((tp) => ({
      ...tp,
      articles: tp.articles.map((a) => a.id === articleId ? { ...a, directions: [...a.directions, created] } : a),
    })));
    setNewDirName("");
    setAddingDirection(null);
  }

  async function handleUpdateDirection(id: string) {
    if (!editDirName.trim()) return;
    const updated = await directoryApi.updateDirection(id, editDirName.trim());
    setTypes((prev) => prev.map((tp) => ({
      ...tp,
      articles: tp.articles.map((a) => ({
        ...a,
        directions: a.directions.map((d) => d.id === id ? { ...d, name: updated.name } : d),
      })),
    })));
    setEditingDirection(null);
  }

  async function handleDeleteDirection(id: string) {
    await directoryApi.deleteDirection(id);
    setTypes((prev) => prev.map((tp) => ({
      ...tp,
      articles: tp.articles.map((a) => ({ ...a, directions: a.directions.filter((d) => d.id !== id) })),
    })));
  }

  if (loading) return <div className="dir-loading">{t("common.loading")}</div>;

  return (
    <div className="dir-sub">
      <div className="dir-sub__header">
        <h3 className="dir-sub__title">{t("directory.articles")}</h3>
        {canEdit && (
          <button type="button" className="dir-add-btn" onClick={() => { setAddingType(true); setNewTypeName(""); }}>
            <Plus size={16} />
            <span>{t("settings.addExpenseType")}</span>
          </button>
        )}
      </div>

      {addingType && (
        <div className="dir-inline-form">
          <input className="dir-inline-input" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder={t("settings.typeName")} autoFocus onKeyDown={(e) => e.key === "Enter" && handleAddType()} />
          <button type="button" className="dir-inline-btn dir-inline-btn--ok" onClick={handleAddType}><Check size={16} /></button>
          <button type="button" className="dir-inline-btn dir-inline-btn--cancel" onClick={() => setAddingType(false)}><X size={16} /></button>
        </div>
      )}

      {types.length === 0 && !addingType && (
        <div className="dir-empty">{t("settings.noExpenseTypes")}</div>
      )}

      <div className="dir-tree">
        {types.map((type) => {
          const isOpen = expanded.has(type.id);
          return (
            <div key={type.id} className="dir-tree__group">
              <div className="dir-tree__row dir-tree__row--type">
                <button type="button" className="dir-tree__toggle" onClick={() => toggle(type.id)}>
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {editingType === type.id ? (
                  <div className="dir-inline-form dir-inline-form--compact">
                    <input className="dir-inline-input" value={editTypeName} onChange={(e) => setEditTypeName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && handleUpdateType(type.id)} />
                    <button type="button" className="dir-inline-btn dir-inline-btn--ok" onClick={() => handleUpdateType(type.id)}><Check size={14} /></button>
                    <button type="button" className="dir-inline-btn dir-inline-btn--cancel" onClick={() => setEditingType(null)}><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <span className="dir-tree__name">{type.name}</span>
                    <span className="dir-tree__count">{type.articles.length}</span>
                    {canEdit && (
                      <div className="dir-tree__actions">
                        <button type="button" className="dir-icon-btn" onClick={() => { setEditingType(type.id); setEditTypeName(type.name); }}><Pencil size={14} /></button>
                        <button type="button" className="dir-icon-btn dir-icon-btn--danger" onClick={() => handleDeleteType(type.id)}><Trash2 size={14} /></button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {isOpen && (
                <div className="dir-tree__children">
                  {type.articles.map((article) => {
                    const artOpen = expandedArticles.has(article.id);
                    return (
                      <div key={article.id} className="dir-tree__group">
                        <div className="dir-tree__row dir-tree__row--article">
                          {article.directions.length > 0 ? (
                            <button type="button" className="dir-tree__toggle" onClick={() => toggleArticle(article.id)}>
                              {artOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          ) : (
                            <span className="dir-tree__toggle-spacer" />
                          )}
                          {editingArticle === article.id ? (
                            <div className="dir-inline-form dir-inline-form--compact">
                              <input className="dir-inline-input" value={editArticleName} onChange={(e) => setEditArticleName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && handleUpdateArticle(article.id)} />
                              <button type="button" className="dir-inline-btn dir-inline-btn--ok" onClick={() => handleUpdateArticle(article.id)}><Check size={14} /></button>
                              <button type="button" className="dir-inline-btn dir-inline-btn--cancel" onClick={() => setEditingArticle(null)}><X size={14} /></button>
                            </div>
                          ) : (
                            <>
                              <span className="dir-tree__name">{article.name}</span>
                              {article.directions.length > 0 && <span className="dir-tree__count">{article.directions.length}</span>}
                              {canEdit && (
                                <div className="dir-tree__actions">
                                  <button type="button" className="dir-icon-btn" onClick={() => { setAddingDirection(article.id); setNewDirName(""); }}><Plus size={14} /></button>
                                  <button type="button" className="dir-icon-btn" onClick={() => { setEditingArticle(article.id); setEditArticleName(article.name); }}><Pencil size={14} /></button>
                                  <button type="button" className="dir-icon-btn dir-icon-btn--danger" onClick={() => handleDeleteArticle(article.id, type.id)}><Trash2 size={14} /></button>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {artOpen && article.directions.length > 0 && (
                          <div className="dir-tree__children">
                            {article.directions.map((dir) => (
                              <div key={dir.id} className="dir-tree__row dir-tree__row--direction">
                                <span className="dir-tree__toggle-spacer" />
                                {editingDirection === dir.id ? (
                                  <div className="dir-inline-form dir-inline-form--compact">
                                    <input className="dir-inline-input" value={editDirName} onChange={(e) => setEditDirName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && handleUpdateDirection(dir.id)} />
                                    <button type="button" className="dir-inline-btn dir-inline-btn--ok" onClick={() => handleUpdateDirection(dir.id)}><Check size={14} /></button>
                                    <button type="button" className="dir-inline-btn dir-inline-btn--cancel" onClick={() => setEditingDirection(null)}><X size={14} /></button>
                                  </div>
                                ) : (
                                  <>
                                    <Compass size={12} className="dir-tree__dir-icon" />
                                    <span className="dir-tree__name dir-tree__name--direction">{dir.name}</span>
                                    {canEdit && (
                                      <div className="dir-tree__actions">
                                        <button type="button" className="dir-icon-btn" onClick={() => { setEditingDirection(dir.id); setEditDirName(dir.name); }}><Pencil size={12} /></button>
                                        <button type="button" className="dir-icon-btn dir-icon-btn--danger" onClick={() => handleDeleteDirection(dir.id)}><Trash2 size={12} /></button>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {addingDirection === article.id && (
                          <div className="dir-inline-form" style={{ paddingLeft: 40 }}>
                            <input className="dir-inline-input" value={newDirName} onChange={(e) => setNewDirName(e.target.value)} placeholder={t("directory.directionName")} autoFocus onKeyDown={(e) => e.key === "Enter" && handleAddDirection(article.id)} />
                            <button type="button" className="dir-inline-btn dir-inline-btn--ok" onClick={() => handleAddDirection(article.id)}><Check size={14} /></button>
                            <button type="button" className="dir-inline-btn dir-inline-btn--cancel" onClick={() => setAddingDirection(null)}><X size={14} /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {canEdit && (
                    <>
                      {addingArticle === type.id ? (
                        <div className="dir-inline-form" style={{ paddingLeft: 28 }}>
                          <input className="dir-inline-input" value={newArticleName} onChange={(e) => setNewArticleName(e.target.value)} placeholder={t("settings.articleName")} autoFocus onKeyDown={(e) => e.key === "Enter" && handleAddArticle(type.id)} />
                          <button type="button" className="dir-inline-btn dir-inline-btn--ok" onClick={() => handleAddArticle(type.id)}><Check size={14} /></button>
                          <button type="button" className="dir-inline-btn dir-inline-btn--cancel" onClick={() => setAddingArticle(null)}><X size={14} /></button>
                        </div>
                      ) : (
                        <button type="button" className="dir-tree__add-child" onClick={() => { setAddingArticle(type.id); setNewArticleName(""); }}>
                          <Plus size={14} />
                          <span>{t("settings.addArticle")}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===== ACCOUNTS VIEW ===== */
function AccountsView({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<DirAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    directoryApi.listAccounts().then((data) => {
      setAccounts(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleToggle(id: string) {
    const result = await directoryApi.toggleAccount(id);
    setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, enabled: result.enabled } : a));
  }

  const enabled = accounts.filter((a) => a.enabled);
  const disabled = accounts.filter((a) => !a.enabled);

  const typeConfig: Record<string, { label: string; icon: typeof Wallet }> = {
    checking: { label: t("settings.typeChecking"), icon: Wallet },
    card: { label: t("settings.typeCard"), icon: CreditCard },
    cash: { label: t("settings.typeCash"), icon: Banknote },
    deposit: { label: t("settings.typeDeposit"), icon: PiggyBank },
  };

  function getTypeLabel(type: string) {
    return typeConfig[type]?.label || type;
  }

  if (loading) return <div className="dir-loading">{t("common.loading")}</div>;

  return (
    <div className="dir-sub">
      {/* В ДДС */}
      <div className="dir-acc-split">
        <div className="dir-acc-split__header">
          <div className="dir-acc-split__badge dir-acc-split__badge--active">
            <ToggleRight size={16} />
            <span>{t("directory.inDds")}</span>
          </div>
          <span className="dir-acc-split__count">{enabled.length}</span>
        </div>

        {enabled.length === 0 && <div className="dir-empty">{t("directory.noEnabledAccounts")}</div>}

        {enabled.length > 0 && (
          <div className="dir-acc-table">
            <div className="dir-acc-table__head">
              <span>{t("settings.accountName")}</span>
              <span>{t("settings.entity")}</span>
              <span>{t("settings.accountType")}</span>
              <span>{t("settings.bank")}</span>
              <span></span>
            </div>
            {enabled.map((acc) => (
              <div key={acc.id} className="dir-acc-table__row">
                <span className="dir-acc-table__name">{acc.name}</span>
                <span className="dir-acc-table__entity">{acc.entityName}</span>
                <span className="dir-acc-table__type">{getTypeLabel(acc.type)}</span>
                <span className="dir-acc-table__bank">{acc.bank || "—"}</span>
                <span className="dir-acc-table__toggle">
                  {canEdit && (
                    <button type="button" className="dir-toggle-btn" onClick={() => handleToggle(acc.id)} title={t("directory.disable")}>
                      <ToggleRight size={22} className="dir-toggle--on" />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Вне ДДС */}
      <div className="dir-acc-split">
        <div className="dir-acc-split__header">
          <div className="dir-acc-split__badge dir-acc-split__badge--inactive">
            <ToggleLeft size={16} />
            <span>{t("directory.outsideDds")}</span>
          </div>
          <span className="dir-acc-split__count">{disabled.length}</span>
        </div>

        {disabled.length === 0 && <div className="dir-empty">{t("directory.noDisabledAccounts")}</div>}

        {disabled.length > 0 && (
          <div className="dir-acc-table">
            <div className="dir-acc-table__head">
              <span>{t("settings.accountName")}</span>
              <span>{t("settings.entity")}</span>
              <span>{t("settings.accountType")}</span>
              <span>{t("settings.bank")}</span>
              <span></span>
            </div>
            {disabled.map((acc) => (
              <div key={acc.id} className="dir-acc-table__row dir-acc-table__row--disabled">
                <span className="dir-acc-table__name">{acc.name}</span>
                <span className="dir-acc-table__entity">{acc.entityName}</span>
                <span className="dir-acc-table__type">{getTypeLabel(acc.type)}</span>
                <span className="dir-acc-table__bank">{acc.bank || "—"}</span>
                <span className="dir-acc-table__toggle">
                  {canEdit && (
                    <button type="button" className="dir-toggle-btn" onClick={() => handleToggle(acc.id)} title={t("directory.enable")}>
                      <ToggleLeft size={22} className="dir-toggle--off" />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== DIRECTIONS VIEW ===== */
function DirectionsView() {
  const { t } = useTranslation();
  const [directions, setDirections] = useState<DirDirectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    directoryApi.listDirections().then((data) => {
      setDirections(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="dir-loading">{t("common.loading")}</div>;

  return (
    <div className="dir-sub">
      <h3 className="dir-sub__title">{t("directory.directions")}</h3>

      {directions.length === 0 && <div className="dir-empty">{t("directory.noDirections")}</div>}

      <div className="dir-directions-list">
        {directions.map((d, i) => (
          <div key={i} className="dir-direction-item">
            <Compass size={16} className="dir-direction-item__icon" />
            <div className="dir-direction-item__text">
              <span className="dir-direction-item__name">{d.name}</span>
              <span className="dir-direction-item__article">{d.articleName}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== ACCOUNTS MANAGE VIEW ===== */
function AccountsManageView({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<DirAccount[]>([]);
  const [entities, setEntities] = useState<DirEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = { name: "", type: "checking", customType: "", entityId: "", bank: "", accountNumber: "" };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    Promise.all([directoryApi.listOwnAccounts(), directoryApi.listEntities()]).then(([a, e]) => {
      setAccounts(a);
      setEntities(e);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const stdTypes = ["checking", "card", "cash", "deposit"];

  const typeConfig: Record<string, { label: string; icon: typeof Wallet }> = {
    checking: { label: t("settings.typeChecking"), icon: Wallet },
    card: { label: t("settings.typeCard"), icon: CreditCard },
    cash: { label: t("settings.typeCash"), icon: Banknote },
    deposit: { label: t("settings.typeDeposit"), icon: PiggyBank },
  };

  function getTypeLabel(type: string) {
    return typeConfig[type]?.label || type;
  }
  function getTypeIcon(type: string) {
    const Icon = typeConfig[type]?.icon || Wallet;
    return <Icon size={16} />;
  }

  function startAdd() {
    setForm({ ...emptyForm, entityId: entities[0]?.id || "" });
    setAdding(true);
    setEditingId(null);
  }

  function startEdit(acc: DirAccount) {
    const isStd = stdTypes.includes(acc.type);
    setForm({
      name: acc.name,
      type: isStd ? acc.type : "other",
      customType: isStd ? "" : acc.type,
      entityId: acc.entityId,
      bank: acc.bank || "",
      accountNumber: acc.accountNumber || "",
    });
    setEditingId(acc.id);
    setAdding(false);
  }

  function cancelForm() {
    setAdding(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    const resolvedType = form.type === "other" ? form.customType.trim() : form.type;
    if (!resolvedType) return;

    const data = {
      name: form.name.trim(),
      type: resolvedType,
      bank: form.bank.trim() || undefined,
      accountNumber: form.accountNumber.trim() || undefined,
    };

    if (editingId) {
      const updated = await directoryApi.updateAccount(editingId, data);
      setAccounts((prev) => prev.map((a) => a.id === editingId ? updated : a));
    } else {
      const created = await directoryApi.createAccount({ ...data, entityId: form.entityId });
      setAccounts((prev) => [...prev, created]);
    }
    cancelForm();
  }

  async function handleDelete(id: string) {
    if (!confirm(t("directory.deleteAccountConfirm"))) return;
    await directoryApi.deleteAccount(id);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleToggle(id: string) {
    const result = await directoryApi.toggleAccount(id);
    setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, enabled: result.enabled } : a));
  }

  if (loading) return <div className="dir-loading">{t("common.loading")}</div>;

  const grouped = entities.map((e) => ({
    entity: e,
    accounts: accounts.filter((a) => a.entityId === e.id),
  })).filter((g) => g.accounts.length > 0 || adding);

  const isEditing = adding || editingId;

  return (
    <div className="dir-section">
      <div className="dir-sub__header">
        <h2 className="dir-section__title">{t("directory.accountsBlock")}</h2>
        {canEdit && !isEditing && (
          <button type="button" className="dir-add-btn" onClick={startAdd}>
            <Plus size={16} />
            <span>{t("directory.addAccount")}</span>
          </button>
        )}
      </div>

      {isEditing && (
        <div className="dir-cat-form glass-card">
          {adding && entities.length > 1 && (
            <div className="dir-cat-form__row">
              <label className="dir-cat-form__label">{t("directory.accountEntity")}</label>
              <select className="dir-cat-form__select" value={form.entityId} onChange={(e) => setForm({ ...form, entityId: e.target.value })}>
                {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          )}
          <div className="dir-cat-form__row">
            <label className="dir-cat-form__label">{t("directory.accountName")}</label>
            <input className="dir-inline-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("directory.accountNamePlaceholder")} autoFocus />
          </div>
          <div className="dir-cat-form__row dir-cat-form__row--grid">
            <div>
              <label className="dir-cat-form__label">{t("settings.accountType")}</label>
              <select className="dir-cat-form__select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, customType: "" })}>
                {stdTypes.map((st) => <option key={st} value={st}>{typeConfig[st]?.label || st}</option>)}
                <option value="other">{t("directory.accountOtherType")}</option>
              </select>
            </div>
            {form.type === "other" && (
              <div>
                <label className="dir-cat-form__label">{t("directory.accountCustomTypePlaceholder")}</label>
                <input className="dir-inline-input" value={form.customType} onChange={(e) => setForm({ ...form, customType: e.target.value })} placeholder={t("directory.accountCustomTypePlaceholder")} />
              </div>
            )}
            <div>
              <label className="dir-cat-form__label">{t("settings.bank")}</label>
              <input className="dir-inline-input" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder={t("directory.accountBankPlaceholder")} />
            </div>
            <div>
              <label className="dir-cat-form__label">{t("settings.accountNumber")}</label>
              <input className="dir-inline-input" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder={t("directory.accountNumberPlaceholder")} />
            </div>
          </div>
          <div className="dir-cat-form__actions">
            <button type="button" className="dir-add-btn" onClick={handleSave} disabled={!form.name.trim() || (form.type === "other" && !form.customType.trim())}>
              <Check size={16} /><span>{t("common.save")}</span>
            </button>
            <button type="button" className="dir-cat-form__cancel" onClick={cancelForm}>{t("common.cancel")}</button>
          </div>
        </div>
      )}

      {accounts.length === 0 && !isEditing && (
        <div className="dir-empty">{t("directory.noAccountsYet")}</div>
      )}

      {grouped.map((g) => (
        <div key={g.entity.id} className="dir-amgmt-group">
          {entities.length > 1 && (
            <div className="dir-amgmt-group__header">
              <Landmark size={16} />
              <span className="dir-amgmt-group__entity">{g.entity.name}</span>
              <span className="dir-tree__count">{g.accounts.length}</span>
            </div>
          )}
          <div className="dir-amgmt-list">
            {g.accounts.map((acc) => (
              <div key={acc.id} className={clsx("dir-amgmt-card glass-card", !acc.enabled && "dir-amgmt-card--disabled", editingId === acc.id && "dir-amgmt-card--editing")}>
                <div className="dir-amgmt-card__icon">
                  {getTypeIcon(acc.type)}
                </div>
                <div className="dir-amgmt-card__info">
                  <span className="dir-amgmt-card__name">{acc.name}</span>
                  <span className="dir-amgmt-card__meta">
                    {getTypeLabel(acc.type)}
                    {acc.bank && <> · {acc.bank}</>}
                    {acc.accountNumber && <> · {acc.accountNumber}</>}
                  </span>
                </div>
                <div className="dir-amgmt-card__right">
                  {canEdit && (
                    <button type="button" className="dir-toggle-btn" onClick={() => handleToggle(acc.id)} title={acc.enabled ? t("directory.disable") : t("directory.enable")}>
                      {acc.enabled ? <ToggleRight size={22} className="dir-toggle--on" /> : <ToggleLeft size={22} className="dir-toggle--off" />}
                    </button>
                  )}
                  {canEdit && (
                    <div className="dir-amgmt-card__actions">
                      <button type="button" className="dir-icon-btn" onClick={() => startEdit(acc)}><Pencil size={14} /></button>
                      <button type="button" className="dir-icon-btn dir-icon-btn--danger" onClick={() => handleDelete(acc.id)}><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ===== CATEGORIZATION VIEW ===== */
function CategorizationView({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const [rules, setRules] = useState<DirCategoryRule[]>([]);
  const [types, setTypes] = useState<DirExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = { pattern: "", matchField: "counterparty", direction: null as string | null, expenseTypeName: "", expenseArticleName: "", directionName: "", priority: 0 };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    Promise.all([directoryApi.listCategoryRules(), directoryApi.listExpenseTypes()]).then(([r, t]) => {
      setRules(r);
      setTypes(t);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const allArticles: DirExpenseArticle[] = types.flatMap((t) => t.articles);
  const allDirections = allArticles.flatMap((a) => a.directions);
  const selectedTypeArticles = form.expenseTypeName ? types.find((t) => t.name === form.expenseTypeName)?.articles || [] : [];
  const selectedArticleDirections = form.expenseArticleName ? selectedTypeArticles.find((a) => a.name === form.expenseArticleName)?.directions || [] : [];

  function startAdd() {
    setForm(emptyForm);
    setAdding(true);
    setEditingId(null);
  }

  function startEdit(rule: DirCategoryRule) {
    setForm({
      pattern: rule.pattern,
      matchField: rule.matchField,
      direction: rule.direction,
      expenseTypeName: rule.expenseTypeName || "",
      expenseArticleName: rule.expenseArticleName || "",
      directionName: rule.directionName || "",
      priority: rule.priority,
    });
    setEditingId(rule.id);
    setAdding(false);
  }

  function cancelForm() {
    setAdding(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.pattern.trim()) return;
    const data = {
      pattern: form.pattern.trim(),
      matchField: form.matchField,
      direction: form.direction,
      expenseTypeName: form.expenseTypeName || null,
      expenseArticleName: form.expenseArticleName || null,
      directionName: form.directionName || null,
      priority: form.priority,
    };

    if (editingId) {
      const updated = await directoryApi.updateCategoryRule(editingId, data);
      setRules((prev) => prev.map((r) => r.id === editingId ? updated : r));
    } else {
      const created = await directoryApi.createCategoryRule(data);
      setRules((prev) => [created, ...prev]);
    }
    cancelForm();
  }

  async function handleDelete(id: string) {
    if (!confirm(t("directory.deleteRuleConfirm"))) return;
    await directoryApi.deleteCategoryRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  const matchLabels: Record<string, string> = {
    counterparty: t("directory.ruleMatchCounterparty"),
    purpose: t("directory.ruleMatchPurpose"),
    any: t("directory.ruleMatchAny"),
  };

  const dirLabels: Record<string, string> = {
    income: t("directory.ruleDirectionIncome"),
    expense: t("directory.ruleDirectionExpense"),
  };

  if (loading) return <div className="dir-loading">{t("common.loading")}</div>;

  const isEditing = adding || editingId;

  return (
    <div className="dir-sub">
      <div className="dir-sub__header">
        <h3 className="dir-sub__title">{t("directory.categorization")}</h3>
        {canEdit && !isEditing && (
          <button type="button" className="dir-add-btn" onClick={startAdd}>
            <Plus size={16} />
            <span>{t("directory.addRule")}</span>
          </button>
        )}
      </div>

      <p className="dir-cat-desc">{t("directory.categorizationDesc")}</p>

      {isEditing && (
        <div className="dir-cat-form glass-card">
          <div className="dir-cat-form__row">
            <label className="dir-cat-form__label">{t("directory.rulePattern")}</label>
            <input className="dir-inline-input" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} placeholder={t("directory.rulePatternPlaceholder")} autoFocus />
          </div>
          <div className="dir-cat-form__row dir-cat-form__row--grid">
            <div>
              <label className="dir-cat-form__label">{t("directory.ruleMatchField")}</label>
              <select className="dir-cat-form__select" value={form.matchField} onChange={(e) => setForm({ ...form, matchField: e.target.value })}>
                <option value="counterparty">{t("directory.ruleMatchCounterparty")}</option>
                <option value="purpose">{t("directory.ruleMatchPurpose")}</option>
                <option value="any">{t("directory.ruleMatchAny")}</option>
              </select>
            </div>
            <div>
              <label className="dir-cat-form__label">{t("directory.ruleDirection")}</label>
              <select className="dir-cat-form__select" value={form.direction || ""} onChange={(e) => setForm({ ...form, direction: e.target.value || null })}>
                <option value="">{t("directory.ruleDirectionAll")}</option>
                <option value="income">{t("directory.ruleDirectionIncome")}</option>
                <option value="expense">{t("directory.ruleDirectionExpense")}</option>
              </select>
            </div>
          </div>
          <div className="dir-cat-form__row dir-cat-form__row--grid">
            <div>
              <label className="dir-cat-form__label">{t("directory.ruleCategory")}</label>
              <select className="dir-cat-form__select" value={form.expenseTypeName} onChange={(e) => setForm({ ...form, expenseTypeName: e.target.value, expenseArticleName: "", directionName: "" })}>
                <option value="">—</option>
                {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="dir-cat-form__label">{t("directory.ruleArticle")}</label>
              <select className="dir-cat-form__select" value={form.expenseArticleName} onChange={(e) => setForm({ ...form, expenseArticleName: e.target.value, directionName: "" })} disabled={!form.expenseTypeName}>
                <option value="">—</option>
                {selectedTypeArticles.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="dir-cat-form__label">{t("directory.ruleDirectionName")}</label>
              <select className="dir-cat-form__select" value={form.directionName} onChange={(e) => setForm({ ...form, directionName: e.target.value })} disabled={!form.expenseArticleName || selectedArticleDirections.length === 0}>
                <option value="">—</option>
                {selectedArticleDirections.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="dir-cat-form__actions">
            <button type="button" className="dir-add-btn" onClick={handleSave}><Check size={16} /><span>{t("common.save")}</span></button>
            <button type="button" className="dir-cat-form__cancel" onClick={cancelForm}>{t("common.cancel")}</button>
          </div>
        </div>
      )}

      {rules.length === 0 && !isEditing && (
        <div className="dir-empty">{t("directory.noRules")}</div>
      )}

      {rules.length > 0 && (
        <div className="dir-cat-rules">
          {rules.map((rule) => (
            <div key={rule.id} className={clsx("dir-cat-rule glass-card", editingId === rule.id && "dir-cat-rule--editing")}>
              <div className="dir-cat-rule__main">
                <span className="dir-cat-rule__pattern">«{rule.pattern}»</span>
                <span className="dir-cat-rule__match">{matchLabels[rule.matchField] || rule.matchField}</span>
                {rule.direction && <span className="dir-cat-rule__dir-badge">{dirLabels[rule.direction]}</span>}
              </div>
              <div className="dir-cat-rule__category">
                {[rule.expenseTypeName, rule.expenseArticleName, rule.directionName].filter(Boolean).join(" → ") || "—"}
              </div>
              {canEdit && (
                <div className="dir-cat-rule__actions">
                  <button type="button" className="dir-icon-btn" onClick={() => startEdit(rule)}><Pencil size={14} /></button>
                  <button type="button" className="dir-icon-btn dir-icon-btn--danger" onClick={() => handleDelete(rule.id)}><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
