import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function FreelancerPage() {
  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Freelancer Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Browse open jobs, submit bids, and track your active contracts.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Browse jobs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Explore open opportunities posted by clients and pick projects that match your skills.
              </p>
              <Link href="/freelancer/jobs" className={cn(buttonVariants({ variant: "outline" }))}>
                Open Job Feed
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active contracts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Review accepted proposals and current contract timelines.
              </p>
              <Link href="/freelancer/contracts" className={cn(buttonVariants({ variant: "outline" }))}>
                View Contracts
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
