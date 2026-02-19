import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import { notificationsApi } from "../../api/notifications.js";
import type { Notification } from "@shared/types.js";
import { isPushSupported, subscribeToPush } from "../../utils/pushSubscription.js";

export default function NotificationsDropdown() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function loadCount() {
    try {
      const { unread: count } = await notificationsApi.unreadCount();
      setUnread(count);
    } catch {
      // ignore
    }
  }

  async function loadNotifications() {
    try {
      const res = await notificationsApi.list(1, 10);
      setNotifications(res.data);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 30000);

    // Auto-subscribe to push if supported and permission not denied
    if (isPushSupported() && Notification.permission !== "denied") {
      subscribeToPush().catch(() => {});
    }

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleMarkRead(id: string) {
    await notificationsApi.markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
  }

  async function handleMarkAllRead() {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  }

  async function handleDelete(id: string) {
    const notif = notifications.find((n) => n.id === id);
    await notificationsApi.delete(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (notif && !notif.read) setUnread((prev) => Math.max(0, prev - 1));
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("notifications.justNow");
    if (mins < 60) return t("notifications.minutesAgo", { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("notifications.hoursAgo", { count: hours });
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  }

  return (
    <div className="notif-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className="header__icon-btn notif-trigger"
        onClick={() => setOpen(!open)}
        aria-label={t("header.notifications")}
      >
        <Bell size={20} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel__header">
            <h4>{t("header.notifications")}</h4>
            {unread > 0 && (
              <button type="button" className="notif-panel__mark-all" onClick={handleMarkAllRead}>
                <CheckCheck size={14} />
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>

          <div className="notif-panel__list">
            {notifications.length === 0 ? (
              <div className="notif-panel__empty">{t("notifications.empty")}</div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className={`notif-item ${!notif.read ? "notif-item--unread" : ""}`}>
                  <div className="notif-item__content">
                    <div className="notif-item__title">{notif.title}</div>
                    <div className="notif-item__body">{notif.body}</div>
                    <div className="notif-item__time">{formatTime(notif.createdAt)}</div>
                  </div>
                  <div className="notif-item__actions">
                    {!notif.read && (
                      <button type="button" className="icon-btn" onClick={() => handleMarkRead(notif.id)} title={t("notifications.markRead")}>
                        <Check size={14} />
                      </button>
                    )}
                    <button type="button" className="icon-btn" onClick={() => handleDelete(notif.id)} title={t("common.delete")}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
