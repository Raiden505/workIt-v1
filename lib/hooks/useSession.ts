"use client";

import { useMemo } from "react";
import { useSessionStore } from "@/store/session";

const USER_ID_STORAGE_KEY = "user_id";

export function useSession() {
  const userId = useSessionStore((state) => state.userId);
  const clientId = useSessionStore((state) => state.clientId);
  const freelancerId = useSessionStore((state) => state.freelancerId);
  const activeRole = useSessionStore((state) => state.activeRole);
  const isHydrated = useSessionStore((state) => state.isHydrated);
  const setUserId = useSessionStore((state) => state.setUserId);
  const setClientId = useSessionStore((state) => state.setClientId);
  const setFreelancerId = useSessionStore((state) => state.setFreelancerId);
  const setActiveRole = useSessionStore((state) => state.setActiveRole);
  const clearSession = useSessionStore((state) => state.clearSession);

  const login = (id: number | string) => {
    const nextUserId = String(id);
    localStorage.setItem(USER_ID_STORAGE_KEY, nextUserId);
    setUserId(nextUserId);
  };

  const logout = () => {
    localStorage.removeItem(USER_ID_STORAGE_KEY);
    clearSession();
  };

  const isAuthenticated = useMemo(() => Boolean(userId), [userId]);

  return {
    userId,
    clientId,
    freelancerId,
    activeRole,
    isHydrated,
    isAuthenticated,
    setUserId,
    setClientId,
    setFreelancerId,
    setActiveRole,
    login,
    logout,
  };
}
