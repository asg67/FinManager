import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { Button, Modal, DatePicker } from "./ui/index.js";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (from: string, to: string) => Promise<void>;
}

export default function ExportModal({ open, onClose, onExport }: ExportModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);

  async function handleExport() {
    setLoading(true);
    try {
      await onExport(from, to);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("export.downloadExcel")} size="sm">
      <DatePicker value={from} onChange={setFrom} label={t("export.dateFrom")} />
      <div style={{ height: "0.75rem" }} />
      <DatePicker value={to} onChange={setTo} label={t("export.dateTo")} />
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" loading={loading} onClick={handleExport} disabled={!from || !to}>
          <Download size={14} />
          {t("export.download")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
