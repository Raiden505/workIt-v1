import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
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

    const { data: job, error } = await supabaseServer
      .from("job")
      .select("id, client_id, category_id, title, description, budget, status, created_at")
      .eq("id", parsedParams.data.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    if (job.client_id !== userId) {
      const { data: freelancerRow, error: freelancerError } = await supabaseServer
        .from("freelancer")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (freelancerError) {
        return NextResponse.json({ error: freelancerError.message }, { status: 500 });
      }

      if (!freelancerRow) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({ job }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
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

    const jobId = parsedParams.data.id;

    const { data: job, error: jobError } = await supabaseServer
      .from("job")
      .select("id, client_id, status")
      .eq("id", jobId)
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

    if (job.status !== "open") {
      return NextResponse.json({ error: "Only open jobs can be deleted." }, { status: 409 });
    }

    const { data: existingContract, error: contractError } = await supabaseServer
      .from("contract")
      .select("id")
      .eq("job_id", jobId)
      .maybeSingle();

    if (contractError) {
      return NextResponse.json({ error: contractError.message }, { status: 500 });
    }

    if (existingContract) {
      return NextResponse.json({ error: "Cannot delete a job that already has a contract." }, { status: 409 });
    }

    const { error: deleteProposalsError } = await supabaseServer.from("proposal").delete().eq("job_id", jobId);
    if (deleteProposalsError) {
      return NextResponse.json({ error: deleteProposalsError.message }, { status: 500 });
    }

    const { error: deleteJobError } = await supabaseServer.from("job").delete().eq("id", jobId);
    if (deleteJobError) {
      return NextResponse.json({ error: deleteJobError.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Job deleted successfully." }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
