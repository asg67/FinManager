import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import StatementWizard from "../components/pdf/StatementWizard.js";

function openShareDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("finmanager-share", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getSharedFile(db: IDBDatabase): Promise<File | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    const getReq = store.get("shared-pdf");
    getReq.onsuccess = () => {
      const file = getReq.result ?? null;
      store.delete("shared-pdf");
      resolve(file);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export default function ShareTarget() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    openShareDB()
      .then((db) => getSharedFile(db).finally(() => db.close()))
      .then((f) => {
        if (f) {
          setFile(f);
        } else {
          navigate("/pdf", { replace: true });
        }
        setLoading(false);
      })
      .catch(() => {
        navigate("/pdf", { replace: true });
      });
  }, [navigate]);

  if (loading) {
    return (
      <div className="page-enter" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 1rem", gap: "1rem" }}>
        <FileText size={48} style={{ color: "var(--text-muted)" }} />
        <p style={{ color: "var(--text-muted)" }}>{t("pdf.parsing")}...</p>
      </div>
    );
  }

  if (!file) return null;

  return (
    <div className="page-enter">
      <StatementWizard
        open={true}
        initialFile={file}
        onClose={() => navigate("/pdf", { replace: true })}
        onDone={() => navigate("/pdf", { replace: true })}
      />
    </div>
  );
}
