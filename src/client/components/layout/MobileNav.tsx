import { useState, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Home,
  ArrowLeftRight,
  FileText,
  Settings,
  Plus,
} from "lucide-react";
import clsx from "clsx";
import { entitiesApi } from "../../api/entities.js";
import OperationWizard from "../dds/OperationWizard.js";
import type { Entity } from "@shared/types.js";

export default function MobileNav() {
  const { t } = useTranslation();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);

  const leftItems = [
    { to: "/", icon: Home, label: t("nav.dashboard") },
    { to: "/dds", icon: ArrowLeftRight, label: t("nav.dds") },
  ];

  const rightItems = [
    { to: "/pdf", icon: FileText, label: t("nav.statements") },
    { to: "/settings", icon: Settings, label: t("nav.settings") },
  ];

  const openWizard = useCallback(() => {
    entitiesApi.list().then(setEntities);
    setWizardOpen(true);
  }, []);

  const handleDone = useCallback(() => {
    setWizardOpen(false);
    window.dispatchEvent(new CustomEvent("dds-refresh"));
  }, []);

  return (
    <>
      <nav className="mobile-nav">
        {leftItems.map((item) => (
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

        <button
          type="button"
          className="mobile-nav__fab"
          onClick={openWizard}
          aria-label={t("dds.addOperation")}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>

        {rightItems.map((item) => (
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

      <OperationWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onDone={handleDone}
        editOperation={null}
        entities={entities}
      />
    </>
  );
}
