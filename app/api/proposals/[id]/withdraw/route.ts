import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
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

    const proposalId = parsedParams.data.id;

    const { data: proposal, error: proposalError } = await supabaseServer
      .from("proposal")
      .select("id, freelancer_id, status")
      .eq("id", proposalId)
      .maybeSingle();

    if (proposalError) {
      return NextResponse.json({ error: proposalError.message }, { status: 500 });
    }

    if (!proposal || proposal.freelancer_id === null) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }

    if (proposal.freelancer_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (proposal.status !== "pending") {
      return NextResponse.json({ error: "Only pending proposals can be withdrawn." }, { status: 409 });
    }

    const { data: updatedProposal, error: updateError } = await supabaseServer
      .from("proposal")
      .update({ status: "withdrawn" })
      .eq("id", proposal.id)
      .eq("status", "pending")
      .select("id, status")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updatedProposal) {
      return NextResponse.json({ error: "Proposal is no longer pending." }, { status: 409 });
    }

    return NextResponse.json({ proposal_id: proposal.id, status: "withdrawn" }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
