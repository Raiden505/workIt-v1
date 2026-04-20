import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { formatCurrency } from "@/lib/utils";

interface ProposalCardProps {
  proposal: {
    id: number;
    freelancer_id: number | null;
    freelancer_name: string | null;
    freelancer_avatar_url?: string | null;
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
    <Card className="border-emerald-200 bg-white text-black shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <UserAvatar src={proposal.freelancer_avatar_url} name={proposal.freelancer_name} size="sm" />
            <CardTitle className="text-base">
              {proposal.freelancer_id ? (
                <Link href={`/freelancers/${proposal.freelancer_id}`} className="text-emerald-700 hover:underline">
                  {proposal.freelancer_name ?? "Freelancer"}
                </Link>
              ) : (
                proposal.freelancer_name ?? "Freelancer"
              )}
            </CardTitle>
          </div>
          <Badge
            variant={proposal.status === "accepted" ? "default" : "secondary"}
            className={proposal.status === "accepted" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800"}
          >
            {proposal.status ?? "unknown"}
          </Badge>
        </div>
        <p className="text-sm text-emerald-700/80">Submitted on {createdDate}</p>
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
              className="bg-emerald-600 text-white hover:bg-emerald-700"
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
