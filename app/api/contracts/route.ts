import { NextResponse } from "next/server";
import { z } from "zod";
import { callServerRpc } from "@/lib/supabase/rpc";
import { resolveApiErrorMessage } from "@/lib/api/error";

const contractsQuerySchema = z.object({
  status: z.enum(["active", "completed", "terminated"]).optional(),
  view: z.enum(["client", "freelancer"]).optional(),
});

function getUserIdFromAuthHeader(request: Request): number | null {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "").trim();
  if (!token) {
    return null;
  }

  const userId = Number(token);
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return userId;
}

interface ContractResponseItem {
  id: number;
  proposal_id: number | null;
  job_id: number | null;
  freelancer_id: number | null;
  client_id: number | null;
  total_price: number;
  status: "active" | "completed" | "terminated" | null;
  start_date: string;
  end_date: string;
  job_title: string | null;
  freelancer_name: string | null;
  client_name: string | null;
  freelancer_avatar_url: string | null;
  client_avatar_url: string | null;
  transaction_status: "pending" | "completed" | "failed" | "refunded" | null;
  counterparty_user_id: number | null;
  my_reviewed: boolean;
  review_count: number;
}

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    const parsedQuery = contractsQuerySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      view: searchParams.get("view") ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 });
    }

    const { data, error } = await callServerRpc("rpc_contracts_list_for_user", {
      p_user_id: userId,
      p_view: parsedQuery.data.view ?? "client",
      p_status: parsedQuery.data.status ?? null,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ contracts: (data ?? []) as ContractResponseItem[] }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
