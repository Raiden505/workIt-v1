import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface ProposalCardProps {
  proposal: {
    id: number;
    freelancer_name: string | null;
    bid_amount: number | null;
    status: "pending" | "accepted" | "rejected" | "withdrawn" | null;
    created_at: string;
  };
  isAccepting?: boolean;
  isDeclining?: boolean;
  onAccept?: (proposalId: number) => void;
  onDecline?: (proposalId: number) => void;
}

export function ProposalCard({
  proposal,
  isAccepting = false,
  isDeclining = false,
  onAccept,
  onDecline,
}: ProposalCardProps) {
  const createdDate = new Date(proposal.created_at).toLocaleDateString();
  const canAccept = proposal.status === "pending" && Boolean(onAccept);
  const canDecline = proposal.status === "pending" && Boolean(onDecline);

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">
            {proposal.freelancer_name ?? "Freelancer #Unknown"}
          </CardTitle>
          <Badge variant={proposal.status === "accepted" ? "default" : "secondary"}>
            {proposal.status ?? "unknown"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">Submitted on {createdDate}</p>
      </CardHeader>

      <CardContent>
        <p className="text-sm font-medium">
          Bid: {proposal.bid_amount === null ? "Not provided" : formatCurrency(proposal.bid_amount)}
        </p>
      </CardContent>

      {onAccept || onDecline ? (
        <CardFooter className="gap-2">
          {onAccept ? (
            <Button
              type="button"
              disabled={!canAccept || isAccepting || isDeclining}
              onClick={() => onAccept(proposal.id)}
            >
              {isAccepting ? "Accepting..." : "Accept Proposal"}
            </Button>
          ) : null}
          {onDecline ? (
            <Button
              type="button"
              variant="destructive"
              disabled={!canDecline || isDeclining || isAccepting}
              onClick={() => onDecline(proposal.id)}
            >
              {isDeclining ? "Declining..." : "Decline Proposal"}
            </Button>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
}
