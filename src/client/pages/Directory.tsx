import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen, Tags, Landmark, Compass, ArrowLeft,
  ChevronRight, ChevronDown, Plus, Pencil, Trash2, Check, X,
  ToggleLeft, ToggleRight,
  Wallet, CreditCard, Banknote, PiggyBank,
} from "lucide-react";
import { directoryApi, type DirExpenseType, type DirAccount, type DirDirectionItem } from "../api/directory.js";
import { useAuthStore } from "../stores/auth.js";

type Section = "main" | "articles" | "accounts" | "directions";

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
      {section === "articles" && <ArticlesView canEdit={canEdit} />}
      {section === "accounts" && <AccountsView canEdit={canEdit} />}
      {section === "directions" && <DirectionsView />}
    </div>
  );
}

/* ===== MAIN VIEW ===== */
function MainView({ onSelect }: { onSelect: (s: Section) => void }) {
  const { t } = useTranslation();
  const cards = [
    { key: "articles" as Section, icon: Tags, title: t("directory.articles"), desc: t("directory.articlesDesc"), color: "#6366f1" },
    { key: "accounts" as Section, icon: Landmark, title: t("directory.accounts"), desc: t("directory.accountsDesc"), color: "#f59e0b" },
    { key: "directions" as Section, icon: Compass, title: t("directory.directions"), desc: t("directory.directionsDesc"), color: "#22c55e" },
  ];

  return (
    <>
      <h1 className="page-title">{t("nav.directory")}</h1>
      <div className="dir-cards-grid">
        {cards.map((c) => (
          <button key={c.key} type="button" className="glass-card dir-nav-card" onClick={() => onSelect(c.key)}>
            <div className="dir-nav-card__icon" style={{ background: `${c.color}14`, color: c.color }}>
              <c.icon size={24} />
            </div>
            <div className="dir-nav-card__text">
              <h3 className="dir-nav-card__title">{c.title}</h3>
              <p className="dir-nav-card__desc">{c.desc}</p>
            </div>
            <ChevronRight size={20} className="dir-nav-card__arrow" />
          </button>
        ))}
      </div>
    </>
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
    setTypes((prev) => prev.map((t) => t.id === id ? updated : t));
    setEditingType(null);
  }

  async function handleDeleteType(id: string) {
    if (!confirm(t("settings.deleteTypeConfirm"))) return;
    await directoryApi.deleteExpenseType(id);
    setTypes((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleAddArticle(typeId: string) {
    if (!newArticleName.trim()) return;
    const created = await directoryApi.createArticle(typeId, newArticleName.trim());
    setTypes((prev) => prev.map((t) => t.id === typeId ? { ...t, articles: [...t.articles, { ...created, directions: created.directions || [] }] } : t));
    setNewArticleName("");
    setAddingArticle(null);
  }

  async function handleUpdateArticle(id: string) {
    if (!editArticleName.trim()) return;
    const updated = await directoryApi.updateArticle(id, editArticleName.trim());
    setTypes((prev) => prev.map((t) => ({
      ...t,
      articles: t.articles.map((a) => a.id === id ? { ...a, name: updated.name, directions: updated.directions || a.directions } : a),
    })));
    setEditingArticle(null);
  }

  async function handleDeleteArticle(id: string, typeId: string) {
    if (!confirm(t("settings.deleteArticleConfirm"))) return;
    await directoryApi.deleteArticle(id);
    setTypes((prev) => prev.map((t) => t.id === typeId ? { ...t, articles: t.articles.filter((a) => a.id !== id) } : t));
  }

  async function handleAddDirection(articleId: string) {
    if (!newDirName.trim()) return;
    const created = await directoryApi.createDirection(articleId, newDirName.trim());
    setTypes((prev) => prev.map((t) => ({
      ...t,
      articles: t.articles.map((a) => a.id === articleId ? { ...a, directions: [...a.directions, created] } : a),
    })));
    setNewDirName("");
    setAddingDirection(null);
  }

  async function handleUpdateDirection(id: string) {
    if (!editDirName.trim()) return;
    const updated = await directoryApi.updateDirection(id, editDirName.trim());
    setTypes((prev) => prev.map((t) => ({
      ...t,
      articles: t.articles.map((a) => ({
        ...a,
        directions: a.directions.map((d) => d.id === id ? { ...d, name: updated.name } : d),
      })),
    })));
    setEditingDirection(null);
  }

  async function handleDeleteDirection(id: string) {
    await directoryApi.deleteDirection(id);
    setTypes((prev) => prev.map((t) => ({
      ...t,
      articles: t.articles.map((a) => ({ ...a, directions: a.directions.filter((d) => d.id !== id) })),
    })));
  }

  if (loading) return <div className="dir-loading">{t("common.loading")}</div>;

  return (
    <div className="dir-section">
      <div className="dir-section__header">
        <h2 className="dir-section__title">{t("directory.articles")}</h2>
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

  const grouped: Record<string, DirAccount[]> = {};
  for (const acc of accounts) {
    if (!grouped[acc.type]) grouped[acc.type] = [];
    grouped[acc.type].push(acc);
  }

  const typeConfig: Record<string, { label: string; icon: typeof Wallet }> = {
    checking: { label: t("settings.typeChecking"), icon: Wallet },
    card: { label: t("settings.typeCard"), icon: CreditCard },
    cash: { label: t("settings.typeCash"), icon: Banknote },
    deposit: { label: t("settings.typeDeposit"), icon: PiggyBank },
  };

  const typeOrder = ["checking", "card", "cash", "deposit"];
  const sortedTypes = Object.keys(grouped).sort((a, b) => {
    const ia = typeOrder.indexOf(a);
    const ib = typeOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  if (loading) return <div className="dir-loading">{t("common.loading")}</div>;

  return (
    <div className="dir-section">
      <div className="dir-section__header">
        <h2 className="dir-section__title">{t("directory.accounts")}</h2>
      </div>

      {accounts.length === 0 && <div className="dir-empty">{t("settings.noAccounts")}</div>}

      {sortedTypes.map((type) => {
        const config = typeConfig[type] || { label: type, icon: Wallet };
        const Icon = config.icon;
        const list = grouped[type];
        const enabledCount = list.filter((a) => a.enabled).length;

        return (
          <div key={type} className="dir-acc-group">
            <div className="dir-acc-group__header">
              <Icon size={18} />
              <span className="dir-acc-group__title">{config.label}</span>
              <span className="dir-acc-group__count">{enabledCount}/{list.length}</span>
            </div>
            <div className="dir-acc-table">
              <div className="dir-acc-table__head">
                <span>{t("settings.accountName")}</span>
                <span>{t("settings.entity")}</span>
                <span>{t("settings.bank")}</span>
                <span>{t("settings.accountNumber")}</span>
                <span>{t("directory.active")}</span>
              </div>
              {list.map((acc) => (
                <div key={acc.id} className={`dir-acc-table__row${!acc.enabled ? " dir-acc-table__row--disabled" : ""}`}>
                  <span className="dir-acc-table__name">{acc.name}</span>
                  <span className="dir-acc-table__entity">{acc.entityName}</span>
                  <span className="dir-acc-table__bank">{acc.bank || "—"}</span>
                  <span className="dir-acc-table__number">{acc.accountNumber || "—"}</span>
                  <span className="dir-acc-table__toggle">
                    {canEdit ? (
                      <button type="button" className="dir-toggle-btn" onClick={() => handleToggle(acc.id)} title={acc.enabled ? t("directory.disable") : t("directory.enable")}>
                        {acc.enabled ? <ToggleRight size={22} className="dir-toggle--on" /> : <ToggleLeft size={22} className="dir-toggle--off" />}
                      </button>
                    ) : (
                      acc.enabled ? <ToggleRight size={22} className="dir-toggle--on" /> : <ToggleLeft size={22} className="dir-toggle--off" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
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
    <div className="dir-section">
      <div className="dir-section__header">
        <h2 className="dir-section__title">{t("directory.directions")}</h2>
      </div>

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
