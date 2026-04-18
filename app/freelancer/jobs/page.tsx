import { JobFeed } from "@/components/jobs/JobFeed";

export default function FreelancerJobsPage() {
  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Open Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Browse jobs posted by clients and submit a bid on the ones you want.
          </p>
        </div>
        <JobFeed />
      </div>
    </main>
  );
}
