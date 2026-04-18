"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { JobCard } from "@/components/jobs/JobCard";
import { ProposalCard } from "@/components/proposals/ProposalCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/hooks/useSession";
import { cn } from "@/lib/utils";

interface JobDetails {
  id: number;
  title: string;
  description: string;
  budget: number;
  status: "open" | "in_progress" | "completed" | "cancelled";
  created_at: string;
}

interface ProposalListItem {
  id: number;
  freelancer_name: string | null;
  bid_amount: number | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn" | null;
  created_at: string;
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

export default function ClientJobProposalsPage() {
  const params = useParams<{ id: string }>();
  const jobId = useMemo(() => Number(params.id), [params.id]);
  const { userId, isHydrated } = useSession();
  const [job, setJob] = useState<JobDetails | null>(null);
  const [proposals, setProposals] = useState<ProposalListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [acceptingProposalId, setAcceptingProposalId] = useState<number | null>(null);
  const [decliningProposalId, setDecliningProposalId] = useState<number | null>(null);

  const loadProposals = useCallback(async () => {
    if (!userId || !Number.isInteger(jobId) || jobId <= 0) {
      setErrorMessage("Invalid session or job id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/proposals`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userId}`,
        },
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        setErrorMessage(getErrorMessage(payload, "Failed to load proposals."));
        setJob(null);
        setProposals([]);
        return;
      }

      if (
        typeof payload !== "object" ||
        payload === null ||
        !("job" in payload) ||
        !("proposals" in payload) ||
        !Array.isArray(payload.proposals)
      ) {
        setErrorMessage("Invalid response while loading proposals.");
        setJob(null);
        setProposals([]);
        return;
      }

      setJob(payload.job as JobDetails);
      setProposals(payload.proposals as ProposalListItem[]);
    } catch {
      setErrorMessage("Network error while loading proposals.");
      setJob(null);
      setProposals([]);
    } finally {
      setIsLoading(false);
    }
  }, [jobId, userId]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProposals();
  }, [isHydrated, loadProposals]);

  const handleAcceptProposal = async (proposalId: number) => {
    if (!userId) {
      toast.error("You are not logged in.");
      return;
    }

    setAcceptingProposalId(proposalId);
    try {
      const response = await fetch(`/api/proposals/${proposalId}/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userId}`,
        },
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        toast.error(getErrorMessage(payload, "Failed to accept proposal."));
        return;
      }

      toast.success("Proposal accepted and contract created.");
      await loadProposals();
    } catch {
      toast.error("Network error while accepting proposal.");
    } finally {
      setAcceptingProposalId(null);
    }
  };

  const handleDeclineProposal = async (proposalId: number) => {
    if (!userId) {
      toast.error("You are not logged in.");
      return;
    }

    setDecliningProposalId(proposalId);
    try {
      const response = await fetch(`/api/proposals/${proposalId}/decline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userId}`,
        },
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        toast.error(getErrorMessage(payload, "Failed to decline proposal."));
        return;
      }

      toast.success("Proposal declined.");
      await loadProposals();
    } catch {
      toast.error("Network error while declining proposal.");
    } finally {
      setDecliningProposalId(null);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Job Proposals</h1>
            <p className="text-sm text-muted-foreground">Review and accept freelancer bids.</p>
          </div>
          <Link href="/client" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to My Jobs
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-background p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={`proposal-skeleton-${index}`} className="rounded-lg border bg-background p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-32" />
              </div>
            ))}
          </div>
        ) : null}

        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

        {!isLoading && !errorMessage && job ? <JobCard job={job} /> : null}

        {!isLoading && !errorMessage && !job ? (
          <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
            Job details are unavailable.
          </div>
        ) : null}

        {!isLoading && !errorMessage && proposals.length === 0 ? (
          <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
            No proposals have been submitted for this job yet.
          </div>
        ) : null}

        <div className="grid gap-4">
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              isAccepting={acceptingProposalId === proposal.id}
              isDeclining={decliningProposalId === proposal.id}
              onAccept={handleAcceptProposal}
              onDecline={handleDeclineProposal}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
