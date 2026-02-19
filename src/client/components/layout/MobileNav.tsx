import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Home,
  ArrowLeftRight,
  FileText,
  Landmark,
  Settings,
} from "lucide-react";
import clsx from "clsx";

export default function MobileNav() {
  const { t } = useTranslation();

  const mobileItems = [
    { to: "/", icon: Home, label: t("nav.dashboard") },
    { to: "/dds", icon: ArrowLeftRight, label: t("nav.dds") },
    { to: "/pdf", icon: FileText, label: t("nav.statements") },
    { to: "/bank-accounts", icon: Landmark, label: t("nav.bankAccounts") },
    { to: "/settings", icon: Settings, label: t("nav.settings") },
  ];

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
