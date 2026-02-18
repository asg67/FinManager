import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, Trash2, LinkIcon, Plus } from "lucide-react";
import { companyApi } from "../../api/company.js";
import { authApi } from "../../api/auth.js";
import { useAuthStore } from "../../stores/auth.js";
import { Button, Input, Table } from "../ui/index.js";
import type { InviteInfo } from "@shared/types.js";

export default function CompanyTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [companyName, setCompanyName] = useState(user?.company?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<
    { id: string; name: string; email: string; role: string; createdAt: string }[]
  >([]);
  const [invites, setInvites] = useState<InviteInfo[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [m, inv] = await Promise.all([
        companyApi.listMembers(),
        companyApi.listInvites(),
      ]);
      setMembers(m);
      setInvites(inv);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function handleUpdateName(e: FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return;
    setSaving(true);
    try {
      await companyApi.update({ name: companyName.trim() });
      const me = await authApi.getMe();
      useAuthStore.setState({ user: me });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateInvite() {
    await companyApi.createInvite();
    const inv = await companyApi.listInvites();
    setInvites(inv);
  }

  async function handleDeleteInvite(id: string) {
    await companyApi.deleteInvite(id);
    const inv = await companyApi.listInvites();
    setInvites(inv);
  }

  function copyInviteLink(token: string, id: string) {
    const link = `${window.location.origin}/register?invite=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const roleLabel = (role: string) => {
    if (role === "owner") return t("company.owner");
    if (role === "member") return t("company.member");
    return t("company.employee");
  };

  const memberColumns = [
    { key: "name", header: t("employees.name") },
    { key: "email", header: t("common.email") },
    {
      key: "role",
      header: t("company.role"),
      render: (r: (typeof members)[0]) => roleLabel(r.role),
    },
  ];

  const inviteColumns = [
    {
      key: "link",
      header: "Link",
      render: (r: InviteInfo) => (
        <code style={{ fontSize: "0.75rem" }}>
          ...?invite={r.token.slice(0, 8)}...
        </code>
      ),
    },
    {
      key: "status",
      header: t("pdf.status"),
      render: (r: InviteInfo) =>
        r.used ? (
          <span style={{ color: "var(--text-secondary)" }}>
            {t("company.inviteUsed")}
            {r.usedByName ? ` (${r.usedByName})` : ""}
          </span>
        ) : new Date(r.expiresAt) < new Date() ? (
          <span style={{ color: "var(--text-secondary)" }}>{t("auth.inviteExpired")}</span>
        ) : (
          <span style={{ color: "var(--accent)" }}>{t("company.inviteActive")}</span>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "table-actions",
      render: (r: InviteInfo) => (
        <div className="table-actions-cell">
          {!r.used && new Date(r.expiresAt) >= new Date() && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => copyInviteLink(r.token, r.id)}
              title={t("common.copy")}
            >
              {copiedId === r.id ? <Check size={16} /> : <Copy size={16} />}
            </button>
          )}
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={() => handleDeleteInvite(r.id)}
            title={t("common.delete")}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Company name */}
      <form onSubmit={handleUpdateName} className="tab-header" style={{ gap: "0.5rem" }}>
        <Input
          label={t("company.name")}
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
        />
        <Button type="submit" size="sm" loading={saving}>
          {t("common.save")}
        </Button>
      </form>

      {/* Members */}
      <h3 style={{ margin: "1.5rem 0 0.75rem", fontSize: "1rem", fontWeight: 600 }}>
        {t("company.members")}
      </h3>
      {loadingMembers ? (
        <div className="tab-loading">{t("common.loading")}</div>
      ) : (
        <Table
          columns={memberColumns}
          data={members}
          rowKey={(r) => r.id}
          emptyMessage={t("company.noMembers")}
        />
      )}

      {/* Invites */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "1.5rem 0 0.75rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
          {t("company.invites")}
        </h3>
        <Button size="sm" variant="secondary" onClick={handleCreateInvite}>
          <Plus size={16} />
          {t("company.createInvite")}
        </Button>
      </div>
      <Table
        columns={inviteColumns}
        data={invites}
        rowKey={(r) => r.id}
        emptyMessage={t("company.noInvites")}
      />
    </div>
  );
}
