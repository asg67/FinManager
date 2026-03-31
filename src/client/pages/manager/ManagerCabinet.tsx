import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Users, FileText, LogOut, Moon, Sun, ChevronRight } from "lucide-react";
import { useAuthStore } from "../../stores/auth.js";
import { useThemeStore } from "../../stores/theme.js";
import { managerApi, type ManagerCompany } from "../../api/manager.js";

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  if (diffDays < 7) return `${diffDays} дн. назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function ManagerCabinet() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<ManagerCompany[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    managerApi.getCompanies().then(setCompanies).finally(() => setLoading(false));
  }, []);

  return (
    <div className="manager-layout">
      <header className="manager-header">
        <div className="manager-header__left">
          <span className="manager-header__logo">FinManager</span>
          <span style={{ color: "var(--glass-border)" }}>|</span>
          <span className="manager-header__company">Кабинет менеджера</span>
        </div>
        <div className="manager-header__right">
          <span className="manager-header__name">{user?.name}</span>
          <button className="manager-header__btn" onClick={toggleTheme} title="Сменить тему">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="manager-header__btn" onClick={logout}>
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      </header>

      <main className="manager-content">
        <h1 className="manager-cabinet__title">Мои компании</h1>
        <p className="manager-cabinet__subtitle">
          {companies.length > 0
            ? `Доступно компаний: ${companies.length}`
            : ""}
        </p>

        {loading ? (
          <div className="manager-loading">Загрузка...</div>
        ) : companies.length === 0 ? (
          <div className="manager-empty">
            <div className="manager-empty__title">Компании не назначены</div>
            <div>Обратитесь к администратору для получения доступа</div>
          </div>
        ) : (
          <div className="manager-company-grid">
            {companies.map((c) => (
              <div
                key={c.id}
                className="manager-company-card"
                onClick={() => navigate(`/manager/${c.id}`)}
              >
                <div className="manager-company-card__name">{c.name}</div>
                <div className="manager-company-card__meta">
                  <div className="manager-company-card__row">
                    <Building2 size={14} />
                    {c.entitiesCount} юр. {c.entitiesCount === 1 ? "лицо" : c.entitiesCount < 5 ? "лица" : "лиц"}
                  </div>
                  <div className="manager-company-card__row">
                    <Users size={14} />
                    {c.usersCount} {c.usersCount === 1 ? "участник" : c.usersCount < 5 ? "участника" : "участников"}
                  </div>
                  <div className="manager-company-card__row">
                    <FileText size={14} />
                    Последняя операция: {formatRelativeDate(c.lastDdsAt)}
                  </div>
                </div>
                <div className="manager-company-card__footer">
                  <span className="manager-company-card__last-dds" />
                  <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
