import { NextResponse } from "next/server";
import type { TablesInsert } from "@/types/database";
import { supabaseServer } from "@/lib/supabase/server";
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

    const { client_id: clientId, status } = parsedQuery.data;

    let query = supabaseServer
      .from("job")
      .select("id, client_id, category_id, title, description, budget, status, created_at")
      .order("created_at", { ascending: false });

    if (clientId) {
      query = query.eq("client_id", clientId);
    } else if (!status) {
      query = query.eq("client_id", userId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: jobs, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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

    const { data: clientRow, error: clientError } = await supabaseServer
      .from("client")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (clientError) {
      return NextResponse.json({ error: clientError.message }, { status: 500 });
    }

    if (!clientRow) {
      return NextResponse.json({ error: "Only clients can post jobs." }, { status: 403 });
    }

    const payload: TablesInsert<"job"> = {
      client_id: userId,
      category_id: parsedBody.data.categoryId ?? null,
      title: parsedBody.data.title,
      description: parsedBody.data.description,
      budget: parsedBody.data.budget,
      status: "open",
    };

    const { data: job, error: insertError } = await supabaseServer
      .from("job")
      .insert(payload)
      .select("id, client_id, category_id, title, description, budget, status, created_at")
      .single();

    if (insertError) {
      if (
        insertError.code === "23503" &&
        parsedBody.data.categoryId !== null &&
        parsedBody.data.categoryId !== undefined
      ) {
        return NextResponse.json({ error: "Invalid category id." }, { status: 400 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
