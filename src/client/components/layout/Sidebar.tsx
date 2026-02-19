import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Home,
  ArrowLeftRight,
  FileText,
  Landmark,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  Wallet,
  LogOut,
} from "lucide-react";
import clsx from "clsx";
import { analyticsApi, type AccountBalance } from "../../api/analytics.js";
import { useAuthStore } from "../../stores/auth.js";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isOwner = user?.role === "owner";
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);

  useEffect(() => {
    analyticsApi.accountBalances().then((data) => {
      setBalances(data.slice(0, 3));
      setTotalBalance(data.reduce((sum, a) => sum + a.balance, 0));
    }).catch(() => {});
  }, []);

  function formatMoney(n: number) {
    return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
  }

  const navItems = [
    { to: "/", icon: Home, label: t("nav.dashboard") },
    { to: "/dds", icon: ArrowLeftRight, label: t("nav.dds") },
    { to: "/pdf", icon: FileText, label: t("nav.statements") },
    { to: "/bank-accounts", icon: Landmark, label: t("nav.bankAccounts") },
  ];

  const toolItems = [
    { to: "/settings", icon: Settings, label: t("nav.settings") },
    ...(isOwner ? [{ to: "/admin", icon: Shield, label: t("nav.admin") }] : []),
  ];

  return (
    <aside className={clsx("sidebar", collapsed && "sidebar--collapsed")}>
      {/* Nav Card */}
      <div className="sidebar__card sidebar__card--nav">
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

          {!collapsed && (
            <div className="sidebar__section-label">{t("nav.tools")}</div>
          )}

          {toolItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
      </div>

      {/* Balance Card + Logout */}
      {!collapsed && (
        <>
          <div className="sidebar__card sidebar__balance-card">
            <div className="sidebar__balance-header">
              <div className="sidebar__balance-header-left">
                <Wallet size={16} />
                <span>{t("dashboard.myBalance")}</span>
              </div>
            </div>
            <div className="sidebar__balance-total">
              {formatMoney(totalBalance)} <span className="sidebar__balance-currency">&#8381;</span>
            </div>
            <div className="sidebar__balance-accounts">
              {balances.map((acc) => (
                <div key={acc.id} className="sidebar__balance-row">
                  <span className="sidebar__balance-name">{acc.name}</span>
                  <span className="sidebar__balance-amount">{formatMoney(acc.balance)}</span>
                </div>
              ))}
            </div>
            <div className="sidebar__balance-decor">
              <div className="sidebar__balance-oval sidebar__balance-oval--solid" />
              <div className="sidebar__balance-oval sidebar__balance-oval--stroke" />
            </div>
          </div>

          <button
            type="button"
            className="sidebar__signout"
            onClick={logout}
          >
            <LogOut size={16} />
            <span>{t("header.logout")}</span>
          </button>
        </>
      )}
    </aside>
  );
}
