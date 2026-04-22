import { NextResponse } from "next/server";
import { callServerRpc } from "@/lib/supabase/rpc";
import { resolveApiErrorMessage } from "@/lib/api/error";
import { acceptProposalParamsSchema } from "@/lib/validations/job";

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

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const parsedParams = acceptProposalParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: parsedParams.error.issues }, { status: 400 });
    }

    const { data, error } = await callServerRpc("rpc_contracts_accept_proposal", {
      p_user_id: userId,
      p_proposal_id: parsedParams.data.id,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const rows = (data as Array<{
      ok: boolean;
      status_code: number;
      message: string;
      id: number | null;
      proposal_id: number | null;
      job_id: number | null;
      freelancer_id: number | null;
      total_price: number | null;
      status: "active" | "completed" | "terminated" | null;
      start_date: string | null;
      end_date: string | null;
    }> | null) ?? [];
    const result = rows[0];
    if (!result) {
      return NextResponse.json({ error: "Failed to accept proposal." }, { status: 500 });
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status_code });
    }

    return NextResponse.json(
      {
        contract: {
          id: result.id,
          proposal_id: result.proposal_id,
          job_id: result.job_id,
          freelancer_id: result.freelancer_id,
          total_price: result.total_price,
          status: result.status,
          start_date: result.start_date,
          end_date: result.end_date,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
