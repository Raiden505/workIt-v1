"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ReviewFormProps {
  contractId: number;
  revieweeId: number;
  onSubmitted?: () => void;
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

export function ReviewForm({ contractId, revieweeId, onSubmitted }: ReviewFormProps) {
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitReview = async () => {
    const userId = localStorage.getItem("user_id");
    if (!userId) {
      toast.error("You are not logged in.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
          contractId,
          revieweeId,
          rating,
          comment: comment.trim().length === 0 ? null : comment.trim(),
        }),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        toast.error(getErrorMessage(payload, "Failed to submit review."));
        return;
      }

      toast.success("Review submitted successfully.");
      setComment("");
      setRating(5);
      onSubmitted?.();
    } catch {
      toast.error("Network error while submitting review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave a Review</CardTitle>
        <CardDescription>Share your feedback for this completed contract.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor={`rating-${contractId}`}>Rating</Label>
          <select
            id={`rating-${contractId}`}
            value={String(rating)}
            onChange={(event) => setRating(Number(event.target.value))}
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="5">5 - Excellent</option>
            <option value="4">4 - Good</option>
            <option value="3">3 - Average</option>
            <option value="2">2 - Poor</option>
            <option value="1">1 - Very poor</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`comment-${contractId}`}>Comment (optional)</Label>
          <Textarea
            id={`comment-${contractId}`}
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Describe your experience..."
          />
        </div>
        <Button type="button" disabled={isSubmitting} onClick={submitReview}>
          {isSubmitting ? "Submitting..." : "Submit Review"}
        </Button>
      </CardContent>
    </Card>
  );
}
