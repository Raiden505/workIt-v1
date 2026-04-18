"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/store/session";

const USER_ID_STORAGE_KEY = "user_id";

interface SessionProviderProps {
  children: React.ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const setUserId = useSessionStore((state) => state.setUserId);
  const setHydrated = useSessionStore((state) => state.setHydrated);

  useEffect(() => {
    const storedUserId = localStorage.getItem(USER_ID_STORAGE_KEY);
    setUserId(storedUserId);
    setHydrated(true);
  }, [setHydrated, setUserId]);

  return <>{children}</>;
}
