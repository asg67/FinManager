import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { entitiesApi } from "../../api/entities.js";
import { expensesApi } from "../../api/expenses.js";
import { Button, Input, Select, Modal } from "../ui/index.js";
import type { Entity, ExpenseType, ExpenseArticle } from "@shared/types.js";

export default function ExpensesTab() {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [types, setTypes] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Type modal
  const [typeModal, setTypeModal] = useState(false);
  const [editType, setEditType] = useState<ExpenseType | null>(null);
  const [typeName, setTypeName] = useState("");

  // Article modal
  const [articleModal, setArticleModal] = useState(false);
  const [editArticle, setEditArticle] = useState<ExpenseArticle | null>(null);
  const [articleName, setArticleName] = useState("");
  const [articleTypeId, setArticleTypeId] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "type" | "article"; id: string; typeId?: string } | null>(null);

  useEffect(() => {
    entitiesApi.list().then((data) => {
      setEntities(data);
      if (data.length > 0) setSelectedEntity(data[0].id);
      setLoading(false);
    });
  }, []);

  async function loadTypes() {
    if (!selectedEntity) return;
    setLoading(true);
    const data = await expensesApi.listTypes(selectedEntity);
    setTypes(data);
    setLoading(false);
  }

  useEffect(() => {
    if (selectedEntity) loadTypes();
  }, [selectedEntity]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Type CRUD
  function openCreateType() {
    setEditType(null);
    setTypeName("");
    setTypeModal(true);
  }

  function openEditType(type: ExpenseType) {
    setEditType(type);
    setTypeName(type.name);
    setTypeModal(true);
  }

  async function handleTypeSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editType) {
        await expensesApi.updateType(selectedEntity, editType.id, { name: typeName });
      } else {
        await expensesApi.createType(selectedEntity, { name: typeName });
      }
      setTypeModal(false);
      await loadTypes();
    } finally {
      setSaving(false);
    }
  }

  // Article CRUD
  function openCreateArticle(typeId: string) {
    setEditArticle(null);
    setArticleName("");
    setArticleTypeId(typeId);
    setArticleModal(true);
  }

  function openEditArticle(article: ExpenseArticle) {
    setEditArticle(article);
    setArticleName(article.name);
    setArticleTypeId(article.expenseTypeId);
    setArticleModal(true);
  }

  async function handleArticleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editArticle) {
        await expensesApi.updateArticle(selectedEntity, articleTypeId, editArticle.id, { name: articleName });
      } else {
        await expensesApi.createArticle(selectedEntity, articleTypeId, { name: articleName });
      }
      setArticleModal(false);
      await loadTypes();
    } finally {
      setSaving(false);
    }
  }

  // Delete
  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "type") {
      await expensesApi.deleteType(selectedEntity, deleteTarget.id);
    } else {
      await expensesApi.deleteArticle(selectedEntity, deleteTarget.typeId!, deleteTarget.id);
    }
    setDeleteTarget(null);
    await loadTypes();
  }

  return (
    <div>
      <div className="tab-header">
        <Select
          options={entities.map((e) => ({ value: e.id, label: e.name }))}
          value={selectedEntity}
          onChange={(e) => setSelectedEntity(e.target.value)}
          label={t("settings.selectEntity")}
        />
        <Button size="sm" onClick={openCreateType} disabled={!selectedEntity}>
          <Plus size={16} />
          {t("settings.addExpenseType")}
        </Button>
      </div>

      {loading ? (
        <div className="tab-loading">{t("common.loading")}</div>
      ) : types.length === 0 ? (
        <div className="tab-empty">{t("settings.noExpenseTypes")}</div>
      ) : (
        <div className="expense-tree">
          {types.map((type) => (
            <div key={type.id} className="expense-type">
              <div className="expense-type__header">
                <button type="button" className="expense-type__toggle" onClick={() => toggleExpand(type.id)}>
                  {expanded.has(type.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="expense-type__name">{type.name}</span>
                  <span className="expense-type__count">({type.articles.length})</span>
                </button>
                <div className="table-actions-cell">
                  <button type="button" className="icon-btn" onClick={() => openCreateArticle(type.id)} title={t("settings.addArticle")}>
                    <Plus size={14} />
                  </button>
                  <button type="button" className="icon-btn" onClick={() => openEditType(type)} title={t("common.edit")}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="icon-btn icon-btn--danger" onClick={() => setDeleteTarget({ kind: "type", id: type.id })} title={t("common.delete")}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {expanded.has(type.id) && (
                <div className="expense-articles">
                  {type.articles.length === 0 ? (
                    <div className="expense-articles__empty">{t("settings.noArticles")}</div>
                  ) : (
                    type.articles.map((article) => (
                      <div key={article.id} className="expense-article">
                        <span className="expense-article__name">{article.name}</span>
                        <div className="table-actions-cell">
                          <button type="button" className="icon-btn" onClick={() => openEditArticle(article)} title={t("common.edit")}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" className="icon-btn icon-btn--danger" onClick={() => setDeleteTarget({ kind: "article", id: article.id, typeId: type.id })} title={t("common.delete")}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Type Modal */}
      <Modal open={typeModal} onClose={() => setTypeModal(false)} title={editType ? t("settings.editExpenseType") : t("settings.addExpenseType")}>
        <form onSubmit={handleTypeSubmit}>
          <Input label={t("settings.typeName")} value={typeName} onChange={(e) => setTypeName(e.target.value)} required autoFocus />
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={() => setTypeModal(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={saving}>{t("common.save")}</Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Article Modal */}
      <Modal open={articleModal} onClose={() => setArticleModal(false)} title={editArticle ? t("settings.editArticle") : t("settings.addArticle")}>
        <form onSubmit={handleArticleSubmit}>
          <Input label={t("settings.articleName")} value={articleName} onChange={(e) => setArticleName(e.target.value)} required autoFocus />
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={() => setArticleModal(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={saving}>{t("common.save")}</Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t("common.confirmDelete")} size="sm">
        <p>{deleteTarget?.kind === "type" ? t("settings.deleteTypeConfirm") : t("settings.deleteArticleConfirm")}</p>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{t("common.cancel")}</Button>
          <Button variant="danger" onClick={handleDelete}>{t("common.delete")}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
