import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ReviewListProps {
  summary: {
    count: number;
    average_rating: number | null;
  };
  reviews: Array<{
    id: number;
    reviewer_name: string | null;
    rating: number | null;
    comment: string | null;
    created_at: string;
  }>;
}

export function ReviewList({ summary, reviews }: ReviewListProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-background p-4 text-sm">
        <p>
          Average rating:{" "}
          <span className="font-medium">
            {summary.average_rating === null ? "No ratings yet" : `${summary.average_rating} / 5`}
          </span>
        </p>
        <p className="text-muted-foreground">Total reviews: {summary.count}</p>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
          No reviews yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">{review.reviewer_name ?? "Anonymous reviewer"}</CardTitle>
                  <Badge variant="outline">{review.rating ?? "N/A"} / 5</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString()}
                </p>
                {review.comment ? <p>{review.comment}</p> : <p className="text-muted-foreground">No comment.</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
