import { NextResponse } from "next/server";
import { callServerRpc } from "@/lib/supabase/rpc";
import { resolveApiErrorMessage } from "@/lib/api/error";
import { createJobSchema, jobsQuerySchema } from "@/lib/validations/job";

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

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    const parsedQuery = jobsQuerySchema.safeParse({
      client_id: searchParams.get("client_id") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 });
    }

    const { data, error } = await callServerRpc("rpc_jobs_list", {
      p_user_id: userId,
      p_client_id: parsedQuery.data.client_id ?? null,
      p_status: parsedQuery.data.status ?? null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const rows = (data as Array<Record<string, unknown> & { skills: unknown }> | null) ?? [];
    const jobs = rows.map((job) => ({
      ...job,
      skills: Array.isArray(job.skills) ? job.skills : [],
    }));

    return NextResponse.json({ jobs }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    const parsedBody = createJobSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 });
    }

    const createResult = await callServerRpc("rpc_jobs_create", {
      p_user_id: userId,
      p_category_id: parsedBody.data.categoryId,
      p_title: parsedBody.data.title,
      p_description: parsedBody.data.description,
      p_budget: parsedBody.data.budget,
      p_skill_ids: parsedBody.data.skillIds,
    });

    if (createResult.error) {
      if (createResult.error.code === "23503") {
        return NextResponse.json({ error: "Invalid category id." }, { status: 400 });
      }
      return NextResponse.json({ error: createResult.error.message }, { status: createResult.error.status });
    }

    const createRows = (createResult.data as Array<{ id: number }> | null) ?? [];
    const createdJob = createRows[0];
    if (!createdJob?.id) {
      return NextResponse.json({ error: "Failed to create job." }, { status: 500 });
    }

    const detailResult = await callServerRpc("rpc_jobs_get_detail", {
      p_user_id: userId,
      p_job_id: createdJob.id,
    });
    if (detailResult.error) {
      return NextResponse.json({ error: detailResult.error.message }, { status: detailResult.error.status });
    }

    const detailRows = (detailResult.data as Array<Record<string, unknown> & { skills: unknown }> | null) ?? [];
    const detailJob = detailRows[0];
    if (!detailJob) {
      return NextResponse.json({ error: "Failed to fetch created job." }, { status: 500 });
    }

    return NextResponse.json(
      {
        job: {
          ...detailJob,
          skills: Array.isArray(detailJob.skills) ? detailJob.skills : [],
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
