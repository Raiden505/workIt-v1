import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { formatCurrency } from "@/lib/utils";

interface ContractCardProps {
  contract: {
    id: number;
    job_title: string | null;
    client_id?: number | null;
    freelancer_id?: number | null;
    client_name?: string | null;
    freelancer_name?: string | null;
    client_avatar_url?: string | null;
    freelancer_avatar_url?: string | null;
    total_price: number;
    status: "active" | "completed" | "terminated" | null;
    transaction_status?: "pending" | "completed" | "failed" | "refunded" | null;
    start_date: string;
    end_date: string;
    my_reviewed?: boolean;
    review_count?: number;
  };
  perspective: "client" | "freelancer";
}

export function ContractCard({ contract, perspective }: ContractCardProps) {
  const counterpartLabel = perspective === "freelancer" ? "Client" : "Freelancer";
  const counterpartName =
    perspective === "freelancer"
      ? contract.client_name ?? "Unknown client"
      : contract.freelancer_name ?? "Unknown freelancer";
  const counterpartAvatarUrl =
    perspective === "freelancer" ? contract.client_avatar_url ?? null : contract.freelancer_avatar_url ?? null;

  const counterpartHref =
    perspective === "freelancer"
      ? contract.client_id
        ? `/clients/${contract.client_id}`
        : null
      : contract.freelancer_id
      ? `/freelancers/${contract.freelancer_id}`
      : null;

  return (
    <Card className="border-emerald-200 bg-white text-black shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg">{contract.job_title ?? `Job #${contract.id}`}</CardTitle>
          <Badge
            variant={contract.status === "active" ? "default" : "secondary"}
            className={contract.status === "active" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800"}
          >
            {contract.status ?? "unknown"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <UserAvatar src={counterpartAvatarUrl} name={counterpartName} size="sm" />
          <p>
            {counterpartLabel}:{" "}
            {counterpartHref ? (
              <Link href={counterpartHref} className="text-emerald-700 hover:underline">
                {counterpartName}
              </Link>
            ) : (
              counterpartName
            )}
          </p>
        </div>
        <p>Payment: {contract.transaction_status ?? "not simulated"}</p>
        <p>Total price: {formatCurrency(contract.total_price)}</p>
        <p>
          Timeline: {contract.start_date} - {contract.end_date}
        </p>
        <p>Reviews: {contract.review_count ?? 0}</p>
        <p>{contract.my_reviewed ? "You submitted a review." : "You have not reviewed this contract yet."}</p>
      </CardContent>
    </Card>
  );
}
