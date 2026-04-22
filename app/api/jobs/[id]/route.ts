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

    const { data, error } = await callServerRpc("rpc_jobs_get_detail", {
      p_user_id: userId,
      p_job_id: parsedParams.data.id,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const rows = (data as Array<Record<string, unknown> & { skills: unknown }> | null) ?? [];
    const job = rows[0];
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    return NextResponse.json(
      {
        job: {
          ...job,
          skills: Array.isArray(job.skills) ? job.skills : [],
        },
      },
      { status: 200 },
    );
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

    const { data, error } = await callServerRpc("rpc_jobs_delete_open", {
      p_user_id: userId,
      p_job_id: parsedParams.data.id,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const rows = (data as Array<{ ok: boolean; status_code: number; message: string }> | null) ?? [];
    const result = rows[0];
    if (!result) {
      return NextResponse.json({ error: "Failed to delete job." }, { status: 500 });
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status_code });
    }

    return NextResponse.json({ message: result.message }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
