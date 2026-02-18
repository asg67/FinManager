import { api } from "./client.js";
import type {
  Company,
  OnboardingStatus,
  InviteInfo,
  AuthResponse,
  RegisterInvitePayload,
  User,
  ExpenseType,
} from "@shared/types.js";

export const companyApi = {
  create: (data: { name: string }) =>
    api.post<Company>("/company", data),

  get: () =>
    api.get<Company>("/company"),

  update: (data: { name: string }) =>
    api.put<Company>("/company", data),

  getOnboardingStatus: () =>
    api.get<OnboardingStatus>("/company/onboarding-status"),

  completeOnboarding: () =>
    api.post<{ success: boolean }>("/company/complete-onboarding"),

  createInvite: () =>
    api.post<InviteInfo>("/company/invites"),

  listInvites: () =>
    api.get<InviteInfo[]>("/company/invites"),

  deleteInvite: (id: string) =>
    api.delete<void>(`/company/invites/${id}`),

  checkInvite: (token: string) =>
    api.get<{ companyName: string; companyId: string }>(`/company/invite/${token}`),

  join: (token: string) =>
    api.post<User>("/company/join", { token }),

  registerInvite: (data: RegisterInvitePayload) =>
    api.post<AuthResponse>("/company/register-invite", data),

  listMembers: () =>
    api.get<{ id: string; name: string; email: string; role: string; createdAt: string }[]>(
      "/company/members",
    ),

  listExpenseTypes: () =>
    api.get<ExpenseType[]>("/company/expense-types"),

  listMyCompanies: () =>
    api.get<CompanyListItem[]>("/company/my-companies"),

  switchCompany: (id: string) =>
    api.post<User>(`/company/switch/${id}`),
};

export interface CompanyListItem {
  id: string;
  name: string;
  onboardingDone: boolean;
  isActive: boolean;
  usersCount: number;
  entitiesCount: number;
  createdAt: string;
}
