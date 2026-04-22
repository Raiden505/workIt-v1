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

    const { data, error } = await callServerRpc("rpc_proposals_set_status", {
      p_user_id: userId,
      p_proposal_id: parsedParams.data.id,
      p_next_status: "rejected",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const rows = (data as Array<{
      ok: boolean;
      status_code: number;
      message: string;
      id: number | null;
      status: "pending" | "accepted" | "rejected" | "withdrawn" | null;
    }> | null) ?? [];
    const result = rows[0];
    if (!result) {
      return NextResponse.json({ error: "Failed to update proposal status." }, { status: 500 });
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status_code });
    }

    return NextResponse.json({ proposal_id: result.id, status: result.status }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
