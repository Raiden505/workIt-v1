"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { createJobSchema, type CreateJobInput } from "@/lib/validations/job";

interface JobFormProps {
  onCreated?: (jobId: number) => void;
}

interface CategoryOption {
  id: number;
  name: string;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const errorValue = payload.error;

    if (typeof errorValue === "string") {
      return errorValue;
    }

    if (Array.isArray(errorValue) && errorValue.length > 0) {
      const firstIssue = errorValue[0];
      if (typeof firstIssue === "object" && firstIssue !== null && "message" in firstIssue) {
        const issueMessage = firstIssue.message;
        if (typeof issueMessage === "string") {
          return issueMessage;
        }
      }
    }
  }

  return fallback;
}

export function JobForm({ onCreated }: JobFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const form = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      title: "",
      description: "",
      budget: 0,
      categoryId: null,
    },
  });

  useEffect(() => {
    const loadCategories = async () => {
      const userId = localStorage.getItem("user_id");
      if (!userId) {
        setCategoriesError("You are not logged in.");
        setIsLoadingCategories(false);
        return;
      }

      setIsLoadingCategories(true);
      setCategoriesError(null);

      try {
        const response = await fetch("/api/categories", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${userId}`,
          },
        });

        const payload: unknown = await response.json();
        if (!response.ok) {
          setCategoriesError(getErrorMessage(payload, "Failed to load categories."));
          setCategories([]);
          return;
        }

        if (
          typeof payload !== "object" ||
          payload === null ||
          !("categories" in payload) ||
          !Array.isArray(payload.categories)
        ) {
          setCategoriesError("Invalid categories response.");
          setCategories([]);
          return;
        }

        const nextCategories = payload.categories.filter(
          (category): category is CategoryOption =>
            typeof category === "object" &&
            category !== null &&
            "id" in category &&
            "name" in category &&
            typeof category.id === "number" &&
            typeof category.name === "string",
        );

        setCategories(nextCategories);
      } catch {
        setCategoriesError("Network error while loading categories.");
        setCategories([]);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    void loadCategories();
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    const userId = localStorage.getItem("user_id");
    if (!userId) {
      toast.error("You are not logged in.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(values),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        toast.error(getErrorMessage(payload, "Failed to create job."));
        return;
      }

      if (typeof payload !== "object" || payload === null || !("job" in payload)) {
        toast.error("Invalid response received from the server.");
        return;
      }

      const createdJob = payload.job;
      if (
        typeof createdJob !== "object" ||
        createdJob === null ||
        !("id" in createdJob) ||
        typeof createdJob.id !== "number"
      ) {
        toast.error("Invalid response received from the server.");
        return;
      }

      toast.success("Job posted successfully.");
      form.reset({
        title: "",
        description: "",
        budget: 0,
        categoryId: null,
      });

      if (onCreated) {
        onCreated(createdJob.id);
        return;
      }

      router.push("/client");
    } catch {
      toast.error("Network error while creating the job.");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post a new job</CardTitle>
        <CardDescription>Create a job listing to receive freelancer proposals.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="Build a responsive landing page" {...form.register("title")} />
            {form.formState.errors.title?.message ? (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={6}
              placeholder="Describe project scope, deliverables, and timeline."
              {...form.register("description")}
            />
            {form.formState.errors.description?.message ? (
              <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Budget (USD)</Label>
            <Input
              id="budget"
              type="number"
              min={1}
              step="0.01"
              {...form.register("budget", { valueAsNumber: true })}
            />
            {form.formState.errors.budget?.message ? (
              <p className="text-sm text-destructive">{form.formState.errors.budget.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryId">Category (optional)</Label>
            {isLoadingCategories ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <select
                id="categoryId"
                className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                {...form.register("categoryId", {
                  setValueAs: (value: unknown) => {
                    if (value === null || value === undefined) {
                      return null;
                    }

                    const normalized = String(value).trim();
                    if (normalized.length === 0) {
                      return null;
                    }

                    return Number(normalized);
                  },
                })}
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
            {categoriesError ? <p className="text-sm text-destructive">{categoriesError}</p> : null}
            {form.formState.errors.categoryId?.message ? (
              <p className="text-sm text-destructive">{form.formState.errors.categoryId.message}</p>
            ) : null}
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Posting..." : "Post Job"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
