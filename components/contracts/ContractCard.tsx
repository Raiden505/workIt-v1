import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface ContractCardProps {
  contract: {
    id: number;
    job_title: string | null;
    client_name?: string | null;
    freelancer_name?: string | null;
    total_price: number;
    status: "active" | "completed" | "terminated" | null;
    transaction_status?: "pending" | "completed" | "failed" | "refunded" | null;
    start_date: string;
    end_date: string;
  };
  perspective: "client" | "freelancer";
}

export function ContractCard({ contract, perspective }: ContractCardProps) {
  const counterpartLabel = perspective === "freelancer" ? "Client" : "Freelancer";
  const counterpartName =
    perspective === "freelancer"
      ? contract.client_name ?? "Unknown client"
      : contract.freelancer_name ?? "Unknown freelancer";

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg">{contract.job_title ?? `Job #${contract.id}`}</CardTitle>
          <Badge variant={contract.status === "active" ? "default" : "secondary"}>
            {contract.status ?? "unknown"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          {counterpartLabel}: {counterpartName}
        </p>
        <p>Payment: {contract.transaction_status ?? "not simulated"}</p>
        <p>Total price: {formatCurrency(contract.total_price)}</p>
        <p>
          Timeline: {contract.start_date} - {contract.end_date}
        </p>
      </CardContent>
    </Card>
  );
}
