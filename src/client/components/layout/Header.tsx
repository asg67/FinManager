import { useTranslation } from "react-i18next";
import { Bell, LogOut, Menu, Moon, Sun, Globe } from "lucide-react";
import { useAuthStore } from "../../stores/auth.js";
import { useThemeStore } from "../../stores/theme.js";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  function toggleLanguage() {
    const next = i18n.language === "ru" ? "en" : "ru";
    i18n.changeLanguage(next);
    localStorage.setItem("language", next);
  }

  return (
    <header className="header">
      <button
        type="button"
        className="header__menu-btn"
        onClick={onMenuClick}
        aria-label={t("header.toggleMenu")}
      >
        <Menu size={20} />
      </button>

      <div className="header__spacer" />

      <div className="header__actions">
        <button
          type="button"
          className="header__icon-btn"
          onClick={toggleLanguage}
          aria-label={i18n.language === "ru" ? "English" : "Русский"}
          title={i18n.language === "ru" ? "EN" : "RU"}
        >
          <Globe size={20} />
        </button>

        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t("header.lightTheme") : t("header.darkTheme")}
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button type="button" className="header__icon-btn" aria-label={t("header.notifications")}>
          <Bell size={20} />
        </button>

        <div className="header__user">
          <div className="header__avatar">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <span className="header__user-name">{user?.name}</span>
        </div>

        <button
          type="button"
          className="header__icon-btn"
          onClick={logout}
          aria-label={t("header.logout")}
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
