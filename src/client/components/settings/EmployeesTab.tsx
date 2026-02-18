import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { employeesApi } from "../../api/employees.js";
import { entitiesApi } from "../../api/entities.js";
import { Button, Input, Modal, Table } from "../ui/index.js";
import type { Employee, Entity, EmployeePermissions } from "@shared/types.js";

const DEFAULT_PERMS: EmployeePermissions = {
  dds: false,
  pdfUpload: false,
  analytics: false,
  export: false,
};

export default function EmployeesTab() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [perms, setPerms] = useState<EmployeePermissions>(DEFAULT_PERMS);

  async function load() {
    try {
      const [emps, ents] = await Promise.all([employeesApi.list(), entitiesApi.list()]);
      setEmployees(emps);
      setEntities(ents);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditEmp(null);
    setEmail("");
    setPassword("");
    setName("");
    setSelectedEntities([]);
    setPerms(DEFAULT_PERMS);
    setModalOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditEmp(emp);
    setEmail(emp.email);
    setPassword("");
    setName(emp.name);
    setSelectedEntities(emp.entities.map((e) => e.id));
    setPerms(emp.permissions ?? DEFAULT_PERMS);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editEmp) {
        await employeesApi.update(editEmp.id, {
          name,
          entityIds: selectedEntities,
          permissions: perms,
        });
      } else {
        await employeesApi.invite({
          email,
          password,
          name,
          entityIds: selectedEntities,
          permissions: perms,
        });
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await employeesApi.delete(deleteId);
    setDeleteId(null);
    await load();
  }

  function toggleEntity(id: string) {
    setSelectedEntities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function togglePerm(key: keyof EmployeePermissions) {
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const columns = [
    { key: "name", header: t("employees.name") },
    { key: "email", header: t("common.email") },
    {
      key: "entities",
      header: t("employees.entities"),
      render: (row: Employee) => row.entities.map((e) => e.name).join(", ") || "—",
    },
    {
      key: "permissions",
      header: t("employees.permissions"),
      render: (row: Employee) => {
        if (!row.permissions) return "—";
        const active: string[] = [];
        if (row.permissions.dds) active.push(t("nav.dds"));
        if (row.permissions.pdfUpload) active.push(t("nav.statements"));
        if (row.permissions.analytics) active.push(t("nav.analytics"));
        if (row.permissions.export) active.push(t("employees.export"));
        return active.join(", ") || "—";
      },
    },
    {
      key: "actions",
      header: "",
      className: "table-actions",
      render: (row: Employee) => (
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
          {t("employees.invite")}
        </Button>
      </div>

      <Table
        columns={columns}
        data={employees}
        rowKey={(r) => r.id}
        emptyMessage={t("employees.noEmployees")}
      />

      {/* Invite/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editEmp ? t("employees.editEmployee") : t("employees.inviteEmployee")}
      >
        <form onSubmit={handleSubmit}>
          <Input
            label={t("employees.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("auth.namePlaceholder")}
            required
            autoFocus
          />
          {!editEmp && (
            <>
              <Input
                label={t("common.email")}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label={t("auth.password")}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
                required
              />
            </>
          )}

          {/* Entity checkboxes */}
          <div className="form-group">
            <label className="form-label">{t("employees.entities")}</label>
            <div className="checkbox-group">
              {entities.map((ent) => (
                <label key={ent.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedEntities.includes(ent.id)}
                    onChange={() => toggleEntity(ent.id)}
                  />
                  <span>{ent.name}</span>
                </label>
              ))}
              {entities.length === 0 && (
                <span className="text-secondary">{t("settings.noEntities")}</span>
              )}
            </div>
          </div>

          {/* Permission checkboxes */}
          <div className="form-group">
            <label className="form-label">{t("employees.permissions")}</label>
            <div className="checkbox-group">
              <label className="checkbox-item">
                <input type="checkbox" checked={perms.dds} onChange={() => togglePerm("dds")} />
                <span>{t("nav.dds")}</span>
              </label>
              <label className="checkbox-item">
                <input type="checkbox" checked={perms.pdfUpload} onChange={() => togglePerm("pdfUpload")} />
                <span>{t("nav.statements")}</span>
              </label>
              <label className="checkbox-item">
                <input type="checkbox" checked={perms.analytics} onChange={() => togglePerm("analytics")} />
                <span>{t("nav.analytics")}</span>
              </label>
              <label className="checkbox-item">
                <input type="checkbox" checked={perms.export} onChange={() => togglePerm("export")} />
                <span>{t("employees.export")}</span>
              </label>
            </div>
          </div>

          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={saving} disabled={selectedEntities.length === 0}>
              {editEmp ? t("common.save") : t("employees.invite")}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title={t("common.confirmDelete")} size="sm">
        <p>{t("employees.deleteConfirm")}</p>
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
