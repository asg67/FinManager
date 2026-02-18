import { api } from "./client.js";
import type {
  Company,
  OnboardingStatus,
  InviteInfo,
  AuthResponse,
  RegisterInvitePayload,
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
    api.get<{ companyName: string }>(`/company/invite/${token}`),

  registerInvite: (data: RegisterInvitePayload) =>
    api.post<AuthResponse>("/company/register-invite", data),

  listMembers: () =>
    api.get<{ id: string; name: string; email: string; role: string; createdAt: string }[]>(
      "/company/members",
    ),
};
