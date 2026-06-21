import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  handleReload = () => {
    if ("caches" in window) {
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) =>
        regs.forEach((r) => r.unregister()),
      );
    }
    setTimeout(() => window.location.reload(), 300);
  };

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "2rem", fontFamily: "sans-serif", fontSize: 14, wordBreak: "break-all" }}>
          <h3 style={{ color: "#dc2626" }}>Произошла ошибка</h3>
          <p><b>{this.state.error.message}</b></p>
          <p style={{ color: "#666", fontSize: 12, whiteSpace: "pre-wrap" }}>
            {this.state.error.stack}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              marginTop: "1rem",
              padding: "8px 16px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Очистить кеш и перезагрузить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
