import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Upload, CreditCard, PiggyBank, Wallet } from "lucide-react";
import { Button } from "../components/ui/index.js";
import StatementWizard from "../components/pdf/StatementWizard.js";

const STATEMENT_BANKS = [
  { code: "sber", labelKey: "pdf.cardSber", icon: CreditCard, color: "#22c55e" },
  { code: "tbank", labelKey: "pdf.cardTbank", icon: CreditCard, color: "#ffdd2d" },
  { code: "tbank_deposit", labelKey: "pdf.depositTbank", icon: PiggyBank, color: "#ffdd2d" },
  { code: "ozon", labelKey: "pdf.cardOzon", icon: Wallet, color: "#005bff" },
];

export default function Statements() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="statements-page page-enter">
      <div className="page-header">
        <h1 className="page-title">{t("nav.statements")}</h1>
        <div className="page-header__actions page-header__actions--desktop">
          <Button onClick={() => setWizardOpen(true)}>
            <Upload size={18} />
            {t("pdf.uploadStatement")}
          </Button>
        </div>
      </div>

      {/* Mobile: prominent upload button */}
      <div className="dds-mobile-add">
        <Button className="dds-mobile-add__btn" onClick={() => setWizardOpen(true)}>
          <Upload size={20} />
          {t("pdf.uploadStatement")}
        </Button>
      </div>

      {/* Bank cards */}
      <div className="stmt-bank-cards">
        {STATEMENT_BANKS.map(({ code, labelKey, icon: Icon, color }) => (
          <button
            key={code}
            type="button"
            className="stmt-bank-card"
            onClick={() => navigate(`/pdf/${code}`)}
          >
            <div className="stmt-bank-card__icon" style={{ background: `${color}20`, color }}>
              <Icon size={28} />
            </div>
            <span className="stmt-bank-card__label">{t(labelKey)}</span>
          </button>
        ))}
      </div>

      <StatementWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onDone={() => setWizardOpen(false)}
      />
    </div>
  );
}
