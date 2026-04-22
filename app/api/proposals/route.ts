import { NextResponse } from "next/server";
import { callServerRpc } from "@/lib/supabase/rpc";
import { resolveApiErrorMessage } from "@/lib/api/error";
import { createProposalSchema } from "@/lib/validations/proposal";

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

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    const parsedBody = createProposalSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 });
    }

    const { data, error } = await callServerRpc("rpc_proposals_create", {
      p_user_id: userId,
      p_job_id: parsedBody.data.jobId,
      p_bid_amount: parsedBody.data.bidAmount,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const rows = (data as Array<{
      ok: boolean;
      status_code: number;
      message: string;
      id: number | null;
      job_id: number | null;
      freelancer_id: number | null;
      bid_amount: number | null;
      status: "pending" | "accepted" | "rejected" | "withdrawn" | null;
      created_at: string | null;
    }> | null) ?? [];
    const result = rows[0];
    if (!result) {
      return NextResponse.json({ error: "Failed to create proposal." }, { status: 500 });
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status_code });
    }

    return NextResponse.json(
      {
        proposal: {
          id: result.id,
          job_id: result.job_id,
          freelancer_id: result.freelancer_id,
          bid_amount: result.bid_amount,
          status: result.status,
          created_at: result.created_at,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
