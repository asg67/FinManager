import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Дашборд" },
  { to: "/dds", icon: ArrowLeftRight, label: "ДДС" },
  { to: "/pdf", icon: FileText, label: "Выписки" },
  { to: "/analytics", icon: BarChart3, label: "Аналитика" },
  { to: "/employees", icon: Users, label: "Сотрудники" },
  { to: "/settings", icon: Settings, label: "Настройки" },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside className={clsx("sidebar", collapsed && "sidebar--collapsed")}>
      <div className="sidebar__logo">
        {!collapsed && <span className="sidebar__logo-text">FinManager</span>}
        <button
          type="button"
          className="sidebar__toggle"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar__nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              clsx("sidebar__link", isActive && "sidebar__link--active")
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={20} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
