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
      .select("id, job_id, status")
      .eq("id", proposalId)
      .maybeSingle();

    if (proposalError) {
      return NextResponse.json({ error: proposalError.message }, { status: 500 });
    }

    if (!proposal || proposal.job_id === null) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }

    const { data: job, error: jobError } = await supabaseServer
      .from("job")
      .select("id, client_id")
      .eq("id", proposal.job_id)
      .maybeSingle();

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    if (job.client_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (proposal.status !== "pending") {
      return NextResponse.json({ error: "Only pending proposals can be declined." }, { status: 409 });
    }

    const { data: declinedProposal, error: declineError } = await supabaseServer
      .from("proposal")
      .update({ status: "rejected" })
      .eq("id", proposal.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (declineError) {
      return NextResponse.json({ error: declineError.message }, { status: 500 });
    }

    if (!declinedProposal) {
      return NextResponse.json({ error: "Proposal is no longer pending." }, { status: 409 });
    }

    return NextResponse.json({ proposal_id: proposal.id, status: "rejected" }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
