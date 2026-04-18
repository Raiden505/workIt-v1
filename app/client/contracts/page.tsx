"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ContractCard } from "@/components/contracts/ContractCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/hooks/useSession";

interface ContractListItem {
  id: number;
  job_title: string | null;
  freelancer_name: string | null;
  total_price: number;
  status: "active" | "completed" | "terminated" | null;
  transaction_status: "pending" | "completed" | "failed" | "refunded" | null;
  start_date: string;
  end_date: string;
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

export default function ClientContractsPage() {
  const { userId, isHydrated } = useSession();
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payingContractId, setPayingContractId] = useState<number | null>(null);

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
      const response = await fetch("/api/contracts", {
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

      setContracts(payload.contracts as ContractListItem[]);
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

  const handleSimulatePayment = async (contractId: number) => {
    if (!userId) {
      toast.error("You are not logged in.");
      return;
    }

    setPayingContractId(contractId);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({ contractId }),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        toast.error(getErrorMessage(payload, "Failed to simulate payment."));
        return;
      }

      toast.success("Payment simulated successfully.");
      await fetchContracts();
    } catch {
      toast.error("Network error while simulating payment.");
    } finally {
      setPayingContractId(null);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Contracts</h1>
          <p className="text-sm text-muted-foreground">
            Track accepted proposals and simulate payments for active contracts.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`client-contracts-skeleton-${index}`}
                className="rounded-lg border bg-background p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-32" />
              </div>
            ))}
          </div>
        ) : null}
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

        {!isLoading && !errorMessage && contracts.length === 0 ? (
          <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
            No contracts found.
          </div>
        ) : null}

        <div className="grid gap-4">
          {contracts.map((contract) => (
            <div key={contract.id} className="space-y-2">
              <ContractCard contract={contract} perspective="client" />
              {contract.status === "active" ? (
                <Button
                  type="button"
                  onClick={() => handleSimulatePayment(contract.id)}
                  disabled={payingContractId === contract.id}
                >
                  {payingContractId === contract.id ? "Processing..." : "Simulate Payment"}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
