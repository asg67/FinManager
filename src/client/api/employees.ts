import { api } from "./client.js";
import type { Employee, InviteEmployeePayload, UpdateEmployeePayload } from "@shared/types.js";

export const employeesApi = {
  list: () => api.get<Employee[]>("/employees"),

  invite: (data: InviteEmployeePayload) => api.post<Employee>("/employees/invite", data),

  update: (id: string, data: UpdateEmployeePayload) => api.put<Employee>(`/employees/${id}`, data),

  delete: (id: string) => api.delete<void>(`/employees/${id}`),
};
