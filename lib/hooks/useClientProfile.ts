"use client";

import { useCallback, useMemo, useState } from "react";
import { useSession } from "@/lib/hooks/useSession";

interface RolesResponse {
  client_id: number | null;
  freelancer_id: number | null;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const errorValue = payload.error;

    if (typeof errorValue === "string") {
      return errorValue;
    }

    if (Array.isArray(errorValue) && errorValue.length > 0) {
      const firstIssue = errorValue[0];
      if (typeof firstIssue === "object" && firstIssue !== null && "message" in firstIssue) {
        const issueMessage = firstIssue.message;
        if (typeof issueMessage === "string") {
          return issueMessage;
        }
      }
    }
  }

  return fallback;
}

function parseRolesPayload(payload: unknown): RolesResponse {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("client_id" in payload) ||
    !("freelancer_id" in payload)
  ) {
    throw new Error("Invalid roles response.");
  }

  const clientId = payload.client_id;
  const freelancerId = payload.freelancer_id;

  const hasValidClientId = clientId === null || typeof clientId === "number";
  const hasValidFreelancerId = freelancerId === null || typeof freelancerId === "number";

  if (!hasValidClientId || !hasValidFreelancerId) {
    throw new Error("Invalid roles response.");
  }

  return {
    client_id: clientId,
    freelancer_id: freelancerId,
  };
}

export function useClientProfile() {
  const {
    userId,
    clientId,
    freelancerId,
    activeRole,
    isHydrated,
    setClientId,
    setFreelancerId,
    setActiveRole,
  } = useSession();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  const applyRoles = useCallback(
    (roles: RolesResponse) => {
      const nextClientId = roles.client_id === null ? null : String(roles.client_id);
      const nextFreelancerId = roles.freelancer_id === null ? null : String(roles.freelancer_id);

      setClientId(nextClientId);
      setFreelancerId(nextFreelancerId);

      if (activeRole === "client" && !nextClientId) {
        setActiveRole(null);
        return;
      }

      if (activeRole === "freelancer" && !nextFreelancerId) {
        setActiveRole(null);
        return;
      }

      if (!activeRole) {
        if (nextClientId) {
          setActiveRole("client");
          return;
        }

        if (nextFreelancerId) {
          setActiveRole("freelancer");
        }
      }
    },
    [activeRole, setActiveRole, setClientId, setFreelancerId],
  );

  const syncRoles = useCallback(async () => {
    if (!isHydrated || !userId) {
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch("/api/roles", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userId}`,
        },
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to fetch role profiles."));
      }

      applyRoles(parseRolesPayload(payload));
    } finally {
      setIsSyncing(false);
    }
  }, [applyRoles, isHydrated, userId]);

  const becomeClient = useCallback(async () => {
    if (!userId) {
      throw new Error("You must be logged in to create a client role.");
    }

    setIsCreatingClient(true);
    try {
      const response = await fetch("/api/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({ role: "client" }),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to create client role."));
      }

      applyRoles(parseRolesPayload(payload));
      if (!activeRole) {
        setActiveRole("client");
      }
    } finally {
      setIsCreatingClient(false);
    }
  }, [activeRole, applyRoles, setActiveRole, userId]);

  const hasClientProfile = useMemo(() => Boolean(clientId), [clientId]);
  const hasFreelancerProfile = useMemo(() => Boolean(freelancerId), [freelancerId]);

  return {
    clientId,
    hasClientProfile,
    hasFreelancerProfile,
    isSyncing,
    isCreatingClient,
    syncRoles,
    becomeClient,
  };
}
