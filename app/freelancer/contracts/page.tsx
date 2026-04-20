"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ContractCard } from "@/components/contracts/ContractCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { useSession } from "@/lib/hooks/useSession";

interface FreelancerContractItem {
  id: number;
  job_title: string | null;
  client_id: number | null;
  client_name: string | null;
  client_avatar_url: string | null;
  total_price: number;
  status: "active" | "completed" | "terminated" | null;
  transaction_status: "pending" | "completed" | "failed" | "refunded" | null;
  start_date: string;
  end_date: string;
  counterparty_user_id: number | null;
  my_reviewed: boolean;
  review_count: number;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const errorValue = payload.error;
    if (typeof errorValue === "string") {
      return errorValue;
    }
  }
  return fallback;
}

export default function FreelancerContractsPage() {
  const { userId, isHydrated } = useSession();
  const [contracts, setContracts] = useState<FreelancerContractItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [terminatingContractId, setTerminatingContractId] = useState<number | null>(null);

  const fetchContracts = useCallback(async () => {
    if (!userId) {
      setContracts([]);
      setErrorMessage("Missing user session.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/contracts?view=freelancer", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userId}`,
        },
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        setErrorMessage(getErrorMessage(payload, "Failed to load contracts."));
        setContracts([]);
        return;
      }

      if (
        typeof payload !== "object" ||
        payload === null ||
        !("contracts" in payload) ||
        !Array.isArray(payload.contracts)
      ) {
        setErrorMessage("Invalid response while loading contracts.");
        setContracts([]);
        return;
      }

      setContracts(payload.contracts as FreelancerContractItem[]);
    } catch {
      setErrorMessage("Network error while loading contracts.");
      setContracts([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchContracts();
  }, [fetchContracts, isHydrated]);

  const handleTerminateContract = async (contractId: number) => {
    if (!userId) {
      toast.error("You are not logged in.");
      return;
    }

    setTerminatingContractId(contractId);
    try {
      const response = await fetch(`/api/contracts/${contractId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({ status: "terminated" }),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        toast.error(getErrorMessage(payload, "Failed to terminate contract."));
        return;
      }

      toast.success("Contract terminated.");
      await fetchContracts();
    } catch {
      toast.error("Network error while terminating contract.");
    } finally {
      setTerminatingContractId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-emerald-50 to-white p-4 md:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-black">My Contracts</h1>
          <p className="text-sm text-emerald-800">
            Track contracts, update statuses, and leave reviews.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`freelancer-contracts-skeleton-${index}`}
                className="rounded-lg border bg-background p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : null}
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

        {!isLoading && !errorMessage && contracts.length === 0 ? (
          <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
            No contracts yet.
          </div>
        ) : null}

        <div className="grid gap-4">
          {contracts.map((contract) => (
            <div key={contract.id} className="space-y-2">
              <ContractCard contract={contract} perspective="freelancer" />
              {contract.status === "active" ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleTerminateContract(contract.id)}
                  disabled={terminatingContractId === contract.id}
                >
                  {terminatingContractId === contract.id ? "Terminating..." : "Terminate Contract"}
                </Button>
              ) : null}
              {contract.status === "completed" &&
              !contract.my_reviewed &&
              contract.counterparty_user_id !== null ? (
                <ReviewForm
                  contractId={contract.id}
                  revieweeId={contract.counterparty_user_id}
                  onSubmitted={fetchContracts}
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
