"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useClientProfile } from "@/lib/hooks/useClientProfile";
import { useFreelancerProfile } from "@/lib/hooks/useFreelancerProfile";
import { useSession } from "@/lib/hooks/useSession";

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

export function RoleSetupBanner() {
  const { isHydrated, isAuthenticated } = useSession();
  const {
    hasClientProfile,
    hasFreelancerProfile,
    isSyncing,
    isCreatingClient,
    syncRoles,
    becomeClient,
  } = useClientProfile();
  const { isCreatingFreelancer, becomeFreelancer } = useFreelancerProfile();
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) {
      return;
    }

    syncRoles().catch((error: unknown) => {
      setSyncError(resolveErrorMessage(error, "Failed to load role information."));
    });
  }, [isAuthenticated, isHydrated, syncRoles]);

  if (!isHydrated || !isAuthenticated) {
    return null;
  }

  if (hasClientProfile && hasFreelancerProfile) {
    return null;
  }

  const handleBecomeClient = async () => {
    try {
      await becomeClient();
      setSyncError(null);
      toast.success("Client role activated.");
    } catch (error: unknown) {
      toast.error(resolveErrorMessage(error, "Unable to activate client role."));
    }
  };

  const handleBecomeFreelancer = async () => {
    try {
      await becomeFreelancer();
      setSyncError(null);
      toast.success("Freelancer role activated.");
    } catch (error: unknown) {
      toast.error(resolveErrorMessage(error, "Unable to activate freelancer role."));
    }
  };

  return (
    <div className="rounded-lg border bg-amber-50/50 p-3">
      <p className="text-sm font-medium text-amber-900">Complete your role setup</p>
      <p className="mt-1 text-sm text-amber-800">
        Activate both roles to switch between client and freelancer views.
      </p>

      {syncError ? <p className="mt-2 text-sm text-destructive">{syncError}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {!hasClientProfile ? (
          <Button type="button" onClick={handleBecomeClient} disabled={isCreatingClient || isSyncing}>
            {isCreatingClient ? "Activating..." : "Become a Client"}
          </Button>
        ) : null}

        {!hasFreelancerProfile ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleBecomeFreelancer}
            disabled={isCreatingFreelancer || isSyncing}
          >
            {isCreatingFreelancer ? "Activating..." : "Become a Freelancer"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
