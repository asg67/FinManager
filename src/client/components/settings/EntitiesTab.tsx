import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { entitiesApi } from "../../api/entities.js";
import { Button, Input, Modal, Table } from "../ui/index.js";
import type { Entity } from "@shared/types.js";

export default function EntitiesTab() {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntity, setEditEntity] = useState<Entity | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await entitiesApi.list();
      setEntities(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditEntity(null);
    setName("");
    setModalOpen(true);
  }

  function openEdit(entity: Entity) {
    setEditEntity(entity);
    setName(entity.name);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editEntity) {
        await entitiesApi.update(editEntity.id, { name });
      } else {
        await entitiesApi.create({ name });
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await entitiesApi.delete(deleteId);
    setDeleteId(null);
    await load();
  }

  const columns = [
    { key: "name", header: t("settings.entityName") },
    {
      key: "accounts",
      header: t("settings.accountsCount"),
      render: (row: Entity) => row._count?.accounts ?? 0,
    },
    {
      key: "actions",
      header: "",
      className: "table-actions",
      render: (row: Entity) => (
        <div className="table-actions-cell">
          <button type="button" className="icon-btn" onClick={() => openEdit(row)} title={t("common.edit")}>
            <Pencil size={16} />
          </button>
          <button type="button" className="icon-btn icon-btn--danger" onClick={() => setDeleteId(row.id)} title={t("common.delete")}>
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="tab-loading">{t("common.loading")}</div>;

  return (
    <div>
      <div className="tab-header">
        <Button size="sm" onClick={openCreate}>
          <Plus size={16} />
          {t("settings.addEntity")}
        </Button>
      </div>

      <Table
        columns={columns}
        data={entities}
        rowKey={(r) => r.id}
        emptyMessage={t("settings.noEntities")}
      />

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editEntity ? t("settings.editEntity") : t("settings.addEntity")}>
        <form onSubmit={handleSubmit}>
          <Input
            label={t("settings.entityName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("settings.entityPlaceholder")}
            required
            autoFocus
          />
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={saving}>
              {t("common.save")}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title={t("common.confirmDelete")} size="sm">
        <p>{t("settings.deleteEntityConfirm")}</p>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteId(null)}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            {t("common.delete")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
