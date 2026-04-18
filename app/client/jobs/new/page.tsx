"use client";

import { useRouter } from "next/navigation";
import { JobForm } from "@/components/jobs/JobForm";

export default function NewJobPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-3xl">
        <JobForm onCreated={() => router.push("/client")} />
      </div>
    </main>
  );
}
