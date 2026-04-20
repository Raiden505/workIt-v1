import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveApiErrorMessage } from "@/lib/api/error";
import { contractIdParamsSchema, updateContractStatusSchema } from "@/lib/validations/contract";

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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const parsedParams = contractIdParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: parsedParams.error.issues }, { status: 400 });
    }

    const body: unknown = await request.json();
    const parsedBody = updateContractStatusSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 });
    }

    const contractId = parsedParams.data.id;

    const { data: contract, error: contractError } = await supabaseServer
      .from("contract")
      .select("id, job_id, freelancer_id, status")
      .eq("id", contractId)
      .maybeSingle();

    if (contractError) {
      return NextResponse.json({ error: contractError.message }, { status: 500 });
    }

    if (!contract || contract.job_id === null || contract.freelancer_id === null) {
      return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    }

    const { data: job, error: jobError } = await supabaseServer
      .from("job")
      .select("id, client_id, status")
      .eq("id", contract.job_id)
      .maybeSingle();

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    if (!job || job.client_id === null) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const canEditStatus = userId === contract.freelancer_id || userId === job.client_id;
    if (!canEditStatus) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (contract.status !== "active") {
      return NextResponse.json({ error: "Only active contracts can be terminated." }, { status: 409 });
    }

    const { data: updatedContract, error: updateContractError } = await supabaseServer
      .from("contract")
      .update({ status: "terminated" })
      .eq("id", contract.id)
      .eq("status", "active")
      .select("id, status")
      .maybeSingle();

    if (updateContractError) {
      return NextResponse.json({ error: updateContractError.message }, { status: 500 });
    }

    if (!updatedContract) {
      return NextResponse.json({ error: "Contract is no longer active." }, { status: 409 });
    }

    const { error: updateJobError } = await supabaseServer
      .from("job")
      .update({ status: "cancelled" })
      .eq("id", job.id)
      .eq("status", "in_progress");

    if (updateJobError) {
      return NextResponse.json({ error: updateJobError.message }, { status: 500 });
    }

    return NextResponse.json({ contract: updatedContract }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
