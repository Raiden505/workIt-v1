"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/hooks/useSession";

export default function HomePage() {
  const router = useRouter();
  const { isHydrated, isAuthenticated, userId } = useSession();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!isAuthenticated || !userId) {
      router.replace("/auth/login");
      return;
    }

    let isCancelled = false;

    const routeByRole = async () => {
      try {
        const response = await fetch("/api/roles", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${userId}`,
          },
        });

        const payload: unknown = await response.json();
        if (!response.ok) {
          router.replace("/client");
          return;
        }

        if (
          typeof payload === "object" &&
          payload !== null &&
          "client_id" in payload &&
          "freelancer_id" in payload
        ) {
          const hasClientRole = typeof payload.client_id === "number";
          const hasFreelancerRole = typeof payload.freelancer_id === "number";

          if (!isCancelled && !hasClientRole && hasFreelancerRole) {
            router.replace("/freelancer");
            return;
          }
        }

        if (!isCancelled) {
          router.replace("/client");
        }
      } catch {
        if (!isCancelled) {
          router.replace("/client");
        }
      }
    };

    void routeByRole();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, isHydrated, router, userId]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Redirecting...
    </div>
  );
}
