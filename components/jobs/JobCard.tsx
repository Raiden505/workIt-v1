import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { cn, formatCurrency } from "@/lib/utils";

interface JobCardProps {
  job: {
    id: number;
    client_id?: number | null;
    client_name?: string | null;
    client_avatar_url?: string | null;
    category_name?: string | null;
    skills?: Array<{ id: number; name: string }>;
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
  const hasSkills = Array.isArray(job.skills) && job.skills.length > 0;

  return (
    <Card className="border-emerald-200 bg-white text-black shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg">{job.title}</CardTitle>
          <Badge
            variant={job.status === "open" ? "default" : "secondary"}
            className={job.status === "open" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800"}
          >
            {job.status}
          </Badge>
        </div>
        <p className="text-sm text-emerald-700/80">Posted on {createdDate}</p>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{job.description}</p>
        <p className="text-sm font-medium">Budget: {formatCurrency(job.budget)}</p>
        {job.category_name ? <p className="text-sm">Category: {job.category_name}</p> : null}
        {job.client_id ? (
          <div className="flex items-center gap-2 text-sm">
            <UserAvatar src={job.client_avatar_url} name={job.client_name} size="sm" />
            <p>
              Client:{" "}
              <Link href={`/clients/${job.client_id}`} className="text-emerald-700 hover:underline">
                {job.client_name ?? "Client"}
              </Link>
            </p>
          </div>
        ) : null}
        {hasSkills ? (
          <div className="flex flex-wrap gap-2">
            {job.skills?.map((skill) => (
              <Badge key={skill.id} variant="outline">
                {skill.name}
              </Badge>
            ))}
          </div>
        ) : null}
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
