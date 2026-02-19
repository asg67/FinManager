import { getAccessToken } from "./client.js";

async function downloadBlob(url: string, filename: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

function buildQuery(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export const exportApi = {
  downloadDdsCsv: async (params?: { entityId?: string; from?: string; to?: string }) => {
    const q = buildQuery({ entityId: params?.entityId, from: params?.from, to: params?.to });
    await downloadBlob(`/api/export/dds${q}`, `dds-export-${new Date().toISOString().slice(0, 10)}.csv`);
  },

  downloadDdsExcel: async (params: { from: string; to: string; entityId?: string }) => {
    const q = buildQuery(params);
    await downloadBlob(`/api/export/dds-excel${q}`, `dds-${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  downloadStatementsExcel: async (params: { from: string; to: string; bankCode?: string }) => {
    const q = buildQuery(params);
    const label = params.bankCode ?? "all";
    await downloadBlob(`/api/export/statements-excel${q}`, `statements-${label}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  downloadBankTxExcel: async (params: { from: string; to: string; connectionId: string; accountId?: string }) => {
    const q = buildQuery(params);
    await downloadBlob(`/api/export/bank-tx-excel${q}`, `bank-tx-${new Date().toISOString().slice(0, 10)}.xlsx`);
  },
};
