import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Menu, Moon, Sun, Globe } from "lucide-react";
import { useAuthStore } from "../../stores/auth.js";
import { useThemeStore } from "../../stores/theme.js";
import NotificationsDropdown from "./NotificationsDropdown.js";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, updateProfile } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  function toggleLanguage() {
    const next = i18n.language === "ru" ? "en" : "ru";
    i18n.changeLanguage(next);
    localStorage.setItem("language", next);
    updateProfile({ language: next }).catch(() => {});
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
          onClick={() => {
            const next = theme === "dark" ? "light" : "dark";
            toggleTheme();
            updateProfile({ theme: next }).catch(() => {});
          }}
          aria-label={theme === "dark" ? t("header.lightTheme") : t("header.darkTheme")}
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <NotificationsDropdown />

        <button
          type="button"
          className="header__user"
          onClick={() => navigate("/settings")}
        >
          <div className="header__avatar">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="header__avatar-img" />
            ) : (
              user?.name?.charAt(0).toUpperCase()
            )}
          </div>
          <span className="header__user-name">{user?.name}</span>
        </button>
      </div>
    </header>
  );
}
