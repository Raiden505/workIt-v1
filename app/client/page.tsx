"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { JobCard } from "@/components/jobs/JobCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/hooks/useSession";
import { cn } from "@/lib/utils";

interface JobListItem {
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

export default function ClientPage() {
  const { userId, isHydrated } = useSession();
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<number | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!userId) {
      setJobs([]);
      setErrorMessage("Missing user session.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userId}`,
        },
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        setErrorMessage(getErrorMessage(payload, "Failed to load jobs."));
        setJobs([]);
        return;
      }

      if (
        typeof payload !== "object" ||
        payload === null ||
        !("jobs" in payload) ||
        !Array.isArray(payload.jobs)
      ) {
        setErrorMessage("Invalid response while loading jobs.");
        setJobs([]);
        return;
      }

      setJobs(payload.jobs as JobListItem[]);
    } catch {
      setErrorMessage("Network error while loading jobs.");
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchJobs();
  }, [fetchJobs, isHydrated]);

  const handleDeleteJob = async (jobId: number) => {
    if (!userId) {
      toast.error("You are not logged in.");
      return;
    }

    setDeletingJobId(jobId);
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${userId}`,
        },
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        toast.error(getErrorMessage(payload, "Failed to delete job."));
        return;
      }

      setJobs((previousJobs) => previousJobs.filter((job) => job.id !== jobId));
      toast.success("Job deleted successfully.");
    } catch {
      toast.error("Network error while deleting job.");
    } finally {
      setDeletingJobId(null);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">My Jobs</h1>
            <p className="text-sm text-muted-foreground">Manage posted jobs and incoming proposals.</p>
          </div>
          <Link href="/client/jobs/new" className={cn(buttonVariants())}>
            Post New Job
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`client-jobs-skeleton-${index}`} className="rounded-lg border bg-background p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-8 w-28" />
              </div>
            ))}
          </div>
        ) : null}

        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

        {!isLoading && !errorMessage && jobs.length === 0 ? (
          <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
            No jobs yet. Post your first job to start receiving proposals.
          </div>
        ) : null}

        <div className="grid gap-4">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              proposalsHref={`/client/jobs/${job.id}/proposals`}
              onDelete={handleDeleteJob}
              isDeleting={deletingJobId === job.id}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
