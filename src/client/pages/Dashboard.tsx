import { useAuthStore } from "../stores/auth.js";

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <h1 className="page-title">Дашборд</h1>
      <div className="card-grid">
        <div className="card">
          <div className="card__label">Добро пожаловать</div>
          <div className="card__value">{user?.name}</div>
        </div>
        <div className="card">
          <div className="card__label">Email</div>
          <div className="card__value">{user?.email}</div>
        </div>
        <div className="card">
          <div className="card__label">Роль</div>
          <div className="card__value">{user?.role === "owner" ? "Владелец" : "Сотрудник"}</div>
        </div>
      </div>
    </div>
  );
}
