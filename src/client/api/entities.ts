import { api } from "./client.js";
import type { Entity } from "@shared/types.js";

export const entitiesApi = {
  list: () => api.get<Entity[]>("/entities"),

  get: (id: string) => api.get<Entity>(`/entities/${id}`),

  create: (data: { name: string }) => api.post<Entity>("/entities", data),

  update: (id: string, data: { name: string }) => api.put<Entity>(`/entities/${id}`, data),

  delete: (id: string) => api.delete<void>(`/entities/${id}`),
};
