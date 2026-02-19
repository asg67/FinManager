import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import { notificationsApi } from "../../api/notifications.js";

export default function NotificationsTab() {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    setSending(true);
    setSuccess(false);
    try {
      await notificationsApi.broadcast(title.trim(), body.trim());
      setSuccess(true);
      setTitle("");
      setBody("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Broadcast failed:", err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="settings-section">
      <h3 className="settings-section__title">{t("notifications.broadcast")}</h3>
      <p className="settings-section__desc">{t("notifications.broadcastDesc")}</p>

      <form onSubmit={handleBroadcast} className="form-stack">
        <div className="form-group">
          <label className="form-label">{t("notifications.broadcastTitle")}</label>
          <input
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("notifications.broadcastTitlePlaceholder")}
            maxLength={100}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t("notifications.broadcastBody")}</label>
          <textarea
            className="form-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("notifications.broadcastBodyPlaceholder")}
            rows={3}
            maxLength={500}
            required
          />
        </div>

        <button type="submit" className="btn btn--primary" disabled={sending || !title.trim() || !body.trim()}>
          <Send size={16} />
          {sending ? t("common.sending") : t("notifications.broadcastSend")}
        </button>

        {success && <div className="form-success">{t("notifications.broadcastSuccess")}</div>}
      </form>
    </div>
  );
}
