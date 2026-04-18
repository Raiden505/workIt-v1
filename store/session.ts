import { create } from "zustand";

export type ActiveRole = "client" | "freelancer" | null;

export interface SessionState {
  userId: string | null;
  clientId: string | null;
  freelancerId: string | null;
  activeRole: ActiveRole;
  isHydrated: boolean;
  setUserId: (userId: string | null) => void;
  setClientId: (clientId: string | null) => void;
  setFreelancerId: (freelancerId: string | null) => void;
  setActiveRole: (role: ActiveRole) => void;
  setHydrated: (value: boolean) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  userId: null,
  clientId: null,
  freelancerId: null,
  activeRole: null,
  isHydrated: false,
  setUserId: (userId) => set({ userId }),
  setClientId: (clientId) => set({ clientId }),
  setFreelancerId: (freelancerId) => set({ freelancerId }),
  setActiveRole: (activeRole) => set({ activeRole }),
  setHydrated: (isHydrated) => set({ isHydrated }),
  clearSession: () =>
    set({
      userId: null,
      clientId: null,
      freelancerId: null,
      activeRole: null,
      isHydrated: true,
    }),
}));
