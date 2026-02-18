import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ddsApi } from "../../api/dds.js";
import { Button, Modal } from "../ui/index.js";
import type { DdsOperation } from "@shared/types.js";

interface Props {
  operation: DdsOperation | null;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteConfirm({ operation, onClose, onDeleted }: Props) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!operation) return;
    setDeleting(true);
    try {
      await ddsApi.deleteOperation(operation.id);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open={!!operation} onClose={onClose} title={t("dds.deleteOperation")} size="sm">
      <p>{t("dds.deleteConfirm")}</p>
      {operation && (
        <div className="delete-preview">
          <span className={`op-badge op-badge--${operation.operationType}`}>
            {t(`dds.${operation.operationType}`)}
          </span>
          <span className="delete-preview__amount">
            {parseFloat(operation.amount).toLocaleString("ru-RU")}
          </span>
        </div>
      )}
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button variant="danger" onClick={handleDelete} loading={deleting}>
          {t("common.delete")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
