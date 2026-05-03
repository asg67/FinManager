import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";

export default function Directory() {
  const { t } = useTranslation();

  return (
    <div className="page-enter" style={{ padding: "2rem" }}>
      <div className="glass-card" style={{ padding: "3rem", textAlign: "center" }}>
        <BookOpen size={48} style={{ color: "#aaa", marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8 }}>{t("nav.directory")}</h2>
        <p style={{ color: "#888" }}>Раздел в разработке</p>
      </div>
    </div>
  );
}
