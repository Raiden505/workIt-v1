"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProposalSchema, type CreateProposalInput } from "@/lib/validations/proposal";

interface BidFormProps {
  jobId: number;
  disabled?: boolean;
  disabledMessage?: string;
  onSubmitted?: () => void;
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

export function BidForm({ jobId, disabled = false, disabledMessage, onSubmitted }: BidFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateProposalInput>({
    resolver: zodResolver(createProposalSchema),
    defaultValues: {
      jobId,
      bidAmount: 0,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const userId = localStorage.getItem("user_id");
    if (!userId) {
      toast.error("You are not logged in.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(values),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        toast.error(getErrorMessage(payload, "Failed to submit bid."));
        return;
      }

      toast.success("Bid submitted successfully.");
      if (onSubmitted) {
        onSubmitted();
      }
    } catch {
      toast.error("Network error while submitting bid.");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit your bid</CardTitle>
        <CardDescription>Send your offer for this project.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <input type="hidden" {...form.register("jobId", { valueAsNumber: true })} />

          <div className="space-y-2">
            <Label htmlFor="bidAmount">Bid Amount (USD)</Label>
            <Input
              id="bidAmount"
              type="number"
              min={1}
              step="0.01"
              {...form.register("bidAmount", { valueAsNumber: true })}
            />
            {form.formState.errors.bidAmount?.message ? (
              <p className="text-sm text-destructive">{form.formState.errors.bidAmount.message}</p>
            ) : null}
          </div>

          {disabledMessage ? <p className="text-sm text-muted-foreground">{disabledMessage}</p> : null}

          <Button type="submit" disabled={disabled || isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Bid"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
