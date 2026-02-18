import { Bell, LogOut, Menu, Moon, Sun } from "lucide-react";
import { useAuthStore } from "../../stores/auth.js";
import { useThemeStore } from "../../stores/theme.js";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  return (
    <header className="header">
      <button
        type="button"
        className="header__menu-btn"
        onClick={onMenuClick}
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      <div className="header__spacer" />

      <div className="header__actions">
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button type="button" className="header__icon-btn" aria-label="Notifications">
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
          aria-label="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
