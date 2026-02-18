import { X } from "lucide-react";
import { useToastStore } from "../../stores/toast.js";

export default function ToastContainer() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          <span>{toast.message}</span>
          <button type="button" className="toast__close" onClick={() => remove(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
