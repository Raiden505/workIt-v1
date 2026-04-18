import { NextResponse } from "next/server";
import type { TablesInsert } from "@/types/database";
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
      .select("id, job_id, freelancer_id, bid_amount, status")
      .eq("id", proposalId)
      .maybeSingle();

    if (proposalError) {
      return NextResponse.json({ error: proposalError.message }, { status: 500 });
    }

    if (!proposal || proposal.job_id === null || proposal.freelancer_id === null || proposal.bid_amount === null) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }

    const { data: job, error: jobError } = await supabaseServer
      .from("job")
      .select("id, client_id, status")
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
      return NextResponse.json({ error: "Proposal is no longer pending." }, { status: 409 });
    }

    if (job.status !== "open") {
      return NextResponse.json({ error: "Job is not open for accepting proposals." }, { status: 409 });
    }

    const { data: existingContract, error: existingContractError } = await supabaseServer
      .from("contract")
      .select("id")
      .eq("job_id", job.id)
      .maybeSingle();

    if (existingContractError) {
      return NextResponse.json({ error: existingContractError.message }, { status: 500 });
    }

    if (existingContract) {
      return NextResponse.json({ error: "A contract already exists for this job." }, { status: 409 });
    }

    const { data: acceptedProposal, error: acceptError } = await supabaseServer
      .from("proposal")
      .update({ status: "accepted" })
      .eq("id", proposal.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (acceptError) {
      return NextResponse.json({ error: acceptError.message }, { status: 500 });
    }

    if (!acceptedProposal) {
      return NextResponse.json({ error: "Proposal is no longer pending." }, { status: 409 });
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);

    const contractPayload: TablesInsert<"contract"> = {
      proposal_id: proposal.id,
      job_id: job.id,
      freelancer_id: proposal.freelancer_id,
      total_price: proposal.bid_amount,
      status: "active",
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
    };

    const { data: contract, error: createContractError } = await supabaseServer
      .from("contract")
      .insert(contractPayload)
      .select("id, proposal_id, job_id, freelancer_id, total_price, status, start_date, end_date")
      .single();

    if (createContractError) {
      await supabaseServer.from("proposal").update({ status: "pending" }).eq("id", proposal.id);
      return NextResponse.json({ error: createContractError.message }, { status: 500 });
    }

    const { error: rejectOthersError } = await supabaseServer
      .from("proposal")
      .update({ status: "rejected" })
      .eq("job_id", job.id)
      .neq("id", proposal.id)
      .eq("status", "pending");

    if (rejectOthersError) {
      return NextResponse.json({ error: rejectOthersError.message }, { status: 500 });
    }

    const { error: updateJobError } = await supabaseServer
      .from("job")
      .update({ status: "in_progress" })
      .eq("id", job.id);

    if (updateJobError) {
      return NextResponse.json({ error: updateJobError.message }, { status: 500 });
    }

    return NextResponse.json({ contract }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
