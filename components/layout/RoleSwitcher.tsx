"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/hooks/useSession";

export function RoleSwitcher() {
  const router = useRouter();
  const { clientId, freelancerId, activeRole, setActiveRole } = useSession();

  const hasClientRole = Boolean(clientId);
  const hasFreelancerRole = Boolean(freelancerId);

  if (!hasClientRole && !hasFreelancerRole) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        No active roles yet. Use the setup banner below.
      </div>
    );
  }

  const switchRole = (role: "client" | "freelancer") => {
    setActiveRole(role);
    router.replace(`/${role}`);
  };

  return (
    <div className="space-y-3 rounded-lg border bg-background p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Role Switcher</p>
        {activeRole ? <Badge variant="outline">Active: {activeRole}</Badge> : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={activeRole === "client" ? "default" : "outline"}
          onClick={() => switchRole("client")}
          disabled={!hasClientRole}
        >
          Client
        </Button>
        <Button
          type="button"
          variant={activeRole === "freelancer" ? "default" : "outline"}
          onClick={() => switchRole("freelancer")}
          disabled={!hasFreelancerRole}
        >
          Freelancer
        </Button>
      </div>
    </div>
  );
}
