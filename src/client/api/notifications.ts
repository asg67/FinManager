import { api } from "./client.js";
import type { Notification, PaginatedResponse } from "@shared/types.js";

export const notificationsApi = {
  list: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Notification>>(`/notifications?page=${page}&limit=${limit}`),

  unreadCount: () => api.get<{ unread: number }>("/notifications/count"),

  markRead: (id: string) => api.put<Notification>(`/notifications/${id}/read`),

  markAllRead: () => api.put<{ success: boolean }>("/notifications/read-all"),

  delete: (id: string) => api.delete<void>(`/notifications/${id}`),

  getVapidKey: () => api.get<{ publicKey: string | null }>("/notifications/vapid-key"),

  subscribe: (subscription: PushSubscriptionJSON) =>
    api.post<{ success: boolean }>("/notifications/subscribe", subscription),

  unsubscribe: (endpoint: string) =>
    api.post<{ success: boolean }>("/notifications/unsubscribe", { endpoint }),

  broadcast: (title: string, body: string) =>
    api.post<{ success: boolean }>("/notifications/broadcast", { title, body }),
};
