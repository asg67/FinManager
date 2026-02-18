import { getAccessToken } from "./client.js";

export const exportApi = {
  downloadDdsCsv: async (params?: { entityId?: string; from?: string; to?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.entityId) searchParams.set("entityId", params.entityId);
    if (params?.from) searchParams.set("from", params.from);
    if (params?.to) searchParams.set("to", params.to);

    const query = searchParams.toString();
    const url = `/api/export/dds${query ? `?${query}` : ""}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) throw new Error("Export failed");

    const blob = await res.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `dds-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  },
};
