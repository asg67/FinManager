import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  BarChart3,
  Settings,
} from "lucide-react";
import clsx from "clsx";

const mobileItems = [
  { to: "/", icon: LayoutDashboard, label: "Главная" },
  { to: "/dds", icon: ArrowLeftRight, label: "ДДС" },
  { to: "/pdf", icon: FileText, label: "Выписки" },
  { to: "/analytics", icon: BarChart3, label: "Аналитика" },
  { to: "/settings", icon: Settings, label: "Ещё" },
];

export default function MobileNav() {
  return (
    <nav className="mobile-nav">
      {mobileItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            clsx("mobile-nav__link", isActive && "mobile-nav__link--active")
          }
        >
          <item.icon size={20} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
