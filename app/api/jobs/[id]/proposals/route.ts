import { NextResponse } from "next/server";
import { callServerRpc } from "@/lib/supabase/rpc";
import { resolveApiErrorMessage } from "@/lib/api/error";
import { jobIdParamsSchema } from "@/lib/validations/job";

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

interface ProposalResponseItem {
  id: number;
  job_id: number | null;
  freelancer_id: number | null;
  bid_amount: number | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn" | null;
  created_at: string;
  freelancer_name: string | null;
  freelancer_avatar_url: string | null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const parsedParams = jobIdParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: parsedParams.error.issues }, { status: 400 });
    }

    const { data, error } = await callServerRpc("rpc_proposals_get_job_owner_view", {
      p_user_id: userId,
      p_job_id: parsedParams.data.id,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const rows = (data as Array<{ job: unknown; proposals: unknown }> | null) ?? [];
    const payload = rows[0];
    if (!payload) {
      return NextResponse.json({ error: "Failed to fetch job proposals." }, { status: 500 });
    }

    const job = payload.job ?? null;
    const proposals = (Array.isArray(payload.proposals) ? payload.proposals : []) as ProposalResponseItem[];

    return NextResponse.json(
      {
        job,
        proposals,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
