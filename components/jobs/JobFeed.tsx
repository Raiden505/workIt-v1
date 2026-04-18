"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { useSession } from "@/lib/hooks/useSession";

interface JobFeedItem {
  id: number;
  client_id: number | null;
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

export function JobFeed() {
  const { userId, isHydrated } = useSession();
  const [jobs, setJobs] = useState<JobFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!userId) {
      setErrorMessage("Missing user session.");
      setJobs([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/jobs?status=open", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userId}`,
        },
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        setErrorMessage(getErrorMessage(payload, "Failed to load open jobs."));
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

      const allJobs = payload.jobs as JobFeedItem[];
      const currentUserId = Number(userId);
      setJobs(allJobs.filter((job) => job.client_id !== currentUserId));
    } catch {
      setErrorMessage("Network error while loading open jobs.");
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

  if (isLoading) {
    return (
      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={`job-feed-skeleton-${index}`}>
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-8 w-24" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (errorMessage) {
    return <p className="text-sm text-destructive">{errorMessage}</p>;
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
        No open jobs available right now.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {jobs.map((job) => (
        <Card key={job.id}>
          <CardHeader className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-lg">{job.title}</CardTitle>
              <Badge>{job.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Posted on {new Date(job.created_at).toLocaleDateString()}
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{job.description}</p>
            <p className="text-sm font-medium">Budget: {formatCurrency(job.budget)}</p>
          </CardContent>
          <CardFooter>
            <Link
              href={`/freelancer/jobs/${job.id}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              View Job
            </Link>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
