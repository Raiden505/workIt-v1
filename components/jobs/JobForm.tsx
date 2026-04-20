"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
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

interface SkillOption {
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
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const form = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      title: "",
      description: "",
      budget: 0,
      categoryId: 0,
      skillIds: [],
    },
  });

  const selectedSkillIds = useWatch({
    control: form.control,
    name: "skillIds",
  });

  useEffect(() => {
    const loadLookups = async () => {
      const userId = localStorage.getItem("user_id");
      if (!userId) {
        setLookupError("You are not logged in.");
        setIsLoadingLookups(false);
        return;
      }

      setIsLoadingLookups(true);
      setLookupError(null);

      try {
        const [categoriesResponse, skillsResponse] = await Promise.all([
          fetch("/api/categories", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${userId}`,
            },
          }),
          fetch("/api/skills", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${userId}`,
            },
          }),
        ]);

        const [categoriesPayload, skillsPayload]: [unknown, unknown] = await Promise.all([
          categoriesResponse.json(),
          skillsResponse.json(),
        ]);

        if (!categoriesResponse.ok) {
          setLookupError(getErrorMessage(categoriesPayload, "Failed to load categories."));
          setCategories([]);
          setSkills([]);
          return;
        }

        if (!skillsResponse.ok) {
          setLookupError(getErrorMessage(skillsPayload, "Failed to load skills."));
          setCategories([]);
          setSkills([]);
          return;
        }

        if (
          typeof categoriesPayload !== "object" ||
          categoriesPayload === null ||
          !("categories" in categoriesPayload) ||
          !Array.isArray(categoriesPayload.categories)
        ) {
          setLookupError("Invalid categories response.");
          setCategories([]);
          setSkills([]);
          return;
        }

        if (
          typeof skillsPayload !== "object" ||
          skillsPayload === null ||
          !("skills" in skillsPayload) ||
          !Array.isArray(skillsPayload.skills)
        ) {
          setLookupError("Invalid skills response.");
          setCategories([]);
          setSkills([]);
          return;
        }

        const nextCategories = categoriesPayload.categories.filter(
          (category): category is CategoryOption =>
            typeof category === "object" &&
            category !== null &&
            "id" in category &&
            "name" in category &&
            typeof category.id === "number" &&
            typeof category.name === "string",
        );

        const nextSkills = skillsPayload.skills.filter(
          (skill): skill is SkillOption =>
            typeof skill === "object" &&
            skill !== null &&
            "id" in skill &&
            "name" in skill &&
            typeof skill.id === "number" &&
            typeof skill.name === "string",
        );

        setCategories(nextCategories);
        setSkills(nextSkills);
      } catch {
        setLookupError("Network error while loading categories and skills.");
        setCategories([]);
        setSkills([]);
      } finally {
        setIsLoadingLookups(false);
      }
    };

    void loadLookups();
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
        categoryId: 0,
        skillIds: [],
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

  const toggleSkill = (skillId: number, checked: boolean) => {
    const nextSet = new Set(selectedSkillIds ?? []);
    if (checked) {
      nextSet.add(skillId);
    } else {
      nextSet.delete(skillId);
    }
    form.setValue("skillIds", [...nextSet], { shouldValidate: true });
  };

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
            <Label htmlFor="categoryId">Category</Label>
            {isLoadingLookups ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <select
                id="categoryId"
                className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                {...form.register("categoryId", {
                  setValueAs: (value: unknown) => Number(String(value)),
                })}
              >
                <option value="0">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
            {form.formState.errors.categoryId?.message ? (
              <p className="text-sm text-destructive">{form.formState.errors.categoryId.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Skills</Label>
            {isLoadingLookups ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : (
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border p-3">
                {skills.map((skill) => {
                  const checked = (selectedSkillIds ?? []).includes(skill.id);
                  return (
                    <label key={skill.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => toggleSkill(skill.id, event.target.checked)}
                      />
                      {skill.name}
                    </label>
                  );
                })}
              </div>
            )}
            {form.formState.errors.skillIds?.message ? (
              <p className="text-sm text-destructive">{form.formState.errors.skillIds.message}</p>
            ) : null}
          </div>

          {lookupError ? <p className="text-sm text-destructive">{lookupError}</p> : null}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Posting..." : "Post Job"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
