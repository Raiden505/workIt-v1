"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BidForm } from "@/components/proposals/BidForm";
import { useSession } from "@/lib/hooks/useSession";
import { cn, formatCurrency } from "@/lib/utils";

interface JobDetail {
  id: number;
  title: string;
  description: string;
  budget: number;
  status: "open" | "in_progress" | "completed" | "cancelled";
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

export default function FreelancerJobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = useMemo(() => Number(params.id), [params.id]);
  const { userId, isHydrated } = useSession();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSubmittedBid, setHasSubmittedBid] = useState(false);

  const fetchJob = useCallback(async () => {
    if (!userId || !Number.isInteger(jobId) || jobId <= 0) {
      setErrorMessage("Invalid session or job id.");
      setJob(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userId}`,
        },
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        setErrorMessage(getErrorMessage(payload, "Failed to load job details."));
        setJob(null);
        return;
      }

      if (typeof payload !== "object" || payload === null || !("job" in payload) || payload.job === null) {
        setErrorMessage("Invalid response while loading job details.");
        setJob(null);
        return;
      }

      setJob(payload.job as JobDetail);
    } catch {
      setErrorMessage("Network error while loading job details.");
      setJob(null);
    } finally {
      setIsLoading(false);
    }
  }, [jobId, userId]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchJob();
  }, [fetchJob, isHydrated]);

  const bidDisabled = hasSubmittedBid || (job !== null && job.status !== "open");
  const bidDisabledMessage =
    hasSubmittedBid
      ? "You have submitted a bid for this job."
      : bidDisabled && job
      ? `This job is currently ${job.status.replace("_", " ")}. Bidding is only available for open jobs.`
      : undefined;

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Job Details</h1>
            <p className="text-sm text-muted-foreground">Review the job and submit your bid.</p>
          </div>
          <Link href="/freelancer/jobs" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to Jobs
          </Link>
        </div>

        {isLoading ? (
          <div className="rounded-lg border bg-background p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : null}
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

        {!isLoading && !errorMessage && job ? (
          <>
            <Card>
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg">{job.title}</CardTitle>
                  <Badge variant={job.status === "open" ? "default" : "secondary"}>{job.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Posted on {new Date(job.created_at).toLocaleDateString()}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{job.description}</p>
                <p className="text-sm font-medium">Budget: {formatCurrency(job.budget)}</p>
              </CardContent>
            </Card>

            <BidForm
              jobId={job.id}
              disabled={bidDisabled}
              disabledMessage={bidDisabledMessage}
              onSubmitted={() => setHasSubmittedBid(true)}
            />
          </>
        ) : null}

        {!isLoading && !errorMessage && !job ? (
          <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
            Job details are unavailable.
          </div>
        ) : null}
      </div>
    </main>
  );
}
