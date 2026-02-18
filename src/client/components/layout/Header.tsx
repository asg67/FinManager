import { Bell, LogOut, Menu } from "lucide-react";
import { useAuthStore } from "../../stores/auth.js";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuthStore();

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
