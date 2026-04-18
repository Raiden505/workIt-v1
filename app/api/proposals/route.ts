import { NextResponse } from "next/server";
import type { TablesInsert } from "@/types/database";
import { supabaseServer } from "@/lib/supabase/server";
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

    const { data: freelancerRow, error: freelancerError } = await supabaseServer
      .from("freelancer")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (freelancerError) {
      return NextResponse.json({ error: freelancerError.message }, { status: 500 });
    }

    if (!freelancerRow) {
      return NextResponse.json({ error: "Only freelancers can submit proposals." }, { status: 403 });
    }

    const { data: job, error: jobError } = await supabaseServer
      .from("job")
      .select("id, client_id, status")
      .eq("id", parsedBody.data.jobId)
      .maybeSingle();

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    if (job.client_id === userId) {
      return NextResponse.json({ error: "You cannot bid on your own job." }, { status: 403 });
    }

    if (job.status !== "open") {
      return NextResponse.json({ error: "This job is not open for bidding." }, { status: 409 });
    }

    const { data: existingProposal, error: existingProposalError } = await supabaseServer
      .from("proposal")
      .select("id")
      .eq("job_id", parsedBody.data.jobId)
      .eq("freelancer_id", userId)
      .maybeSingle();

    if (existingProposalError) {
      return NextResponse.json({ error: existingProposalError.message }, { status: 500 });
    }

    if (existingProposal) {
      return NextResponse.json({ error: "You have already submitted a proposal for this job." }, { status: 409 });
    }

    const payload: TablesInsert<"proposal"> = {
      job_id: parsedBody.data.jobId,
      freelancer_id: userId,
      bid_amount: parsedBody.data.bidAmount,
      status: "pending",
    };

    const { data: proposal, error: createProposalError } = await supabaseServer
      .from("proposal")
      .insert(payload)
      .select("id, job_id, freelancer_id, bid_amount, status, created_at")
      .single();

    if (createProposalError) {
      if (createProposalError.code === "23505") {
        return NextResponse.json({ error: "You have already submitted a proposal for this job." }, { status: 409 });
      }
      return NextResponse.json({ error: createProposalError.message }, { status: 500 });
    }

    return NextResponse.json({ proposal }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
