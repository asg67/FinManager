import { useAuthStore } from "../stores/auth.js";

export default function Dashboard() {
  const { user, logout } = useAuthStore();

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Dashboard</h1>
      <p>Добро пожаловать, {user?.name}!</p>
      <p>Email: {user?.email}</p>
      <p>Роль: {user?.role}</p>
      <button type="button" onClick={logout}>
        Выйти
      </button>
    </div>
  );
}
