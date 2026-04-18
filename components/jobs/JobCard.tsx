import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";

interface JobCardProps {
  job: {
    id: number;
    title: string;
    description: string;
    budget: number;
    status: "open" | "in_progress" | "completed" | "cancelled";
    created_at: string;
  };
  proposalsHref?: string;
  onDelete?: (jobId: number) => void;
  isDeleting?: boolean;
}

export function JobCard({ job, proposalsHref, onDelete, isDeleting = false }: JobCardProps) {
  const createdDate = new Date(job.created_at).toLocaleDateString();

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg">{job.title}</CardTitle>
          <Badge variant={job.status === "open" ? "default" : "secondary"}>{job.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Posted on {createdDate}</p>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{job.description}</p>
        <p className="text-sm font-medium">Budget: {formatCurrency(job.budget)}</p>
      </CardContent>

      {proposalsHref || onDelete ? (
        <CardFooter className="gap-2">
          {proposalsHref ? (
            <Link href={proposalsHref} className={cn(buttonVariants())}>
              View Proposals
            </Link>
          ) : null}
          {onDelete ? (
            <Button type="button" variant="destructive" disabled={isDeleting} onClick={() => onDelete(job.id)}>
              {isDeleting ? "Deleting..." : "Delete Job"}
            </Button>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
}
