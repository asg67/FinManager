import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { t } = useTranslation();

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: "/dds", icon: ArrowLeftRight, label: t("nav.dds") },
    { to: "/pdf", icon: FileText, label: t("nav.statements") },
    { to: "/analytics", icon: BarChart3, label: t("nav.analytics") },
    { to: "/employees", icon: Users, label: t("nav.employees") },
    { to: "/settings", icon: Settings, label: t("nav.settings") },
  ];

  return (
    <aside className={clsx("sidebar", collapsed && "sidebar--collapsed")}>
      <div className="sidebar__logo">
        {!collapsed && <span className="sidebar__logo-text">FinManager</span>}
        <button
          type="button"
          className="sidebar__toggle"
          onClick={onToggle}
          aria-label={collapsed ? t("header.expandSidebar") : t("header.collapseSidebar")}
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
