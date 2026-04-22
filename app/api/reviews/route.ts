import { NextResponse } from "next/server";
import { callServerRpc } from "@/lib/supabase/rpc";
import { resolveApiErrorMessage } from "@/lib/api/error";
import { createReviewSchema, reviewsQuerySchema } from "@/lib/validations/review";

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
    const parsedQuery = reviewsQuerySchema.safeParse({
      reviewee_id: searchParams.get("reviewee_id") ?? undefined,
      contract_id: searchParams.get("contract_id") ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 });
    }

    const revieweeId = parsedQuery.data.reviewee_id ?? null;
    const contractId = parsedQuery.data.contract_id ?? null;

    const summaryResult = await callServerRpc("rpc_reviews_get_summary", {
      p_user_id: userId,
      p_reviewee_id: revieweeId,
      p_contract_id: contractId,
    });
    if (summaryResult.error) {
      return NextResponse.json({ error: summaryResult.error.message }, { status: summaryResult.error.status });
    }

    const listResult = await callServerRpc("rpc_reviews_list", {
      p_user_id: userId,
      p_reviewee_id: revieweeId,
      p_contract_id: contractId,
    });
    if (listResult.error) {
      return NextResponse.json({ error: listResult.error.message }, { status: listResult.error.status });
    }

    const summaryRows = (summaryResult.data as Array<{ count: number | string; average_rating: number | string | null }> | null) ?? [];
    const summary = summaryRows[0] ?? { count: 0, average_rating: null };
    return NextResponse.json(
      {
        summary: {
          count: Number(summary.count ?? 0),
          average_rating: summary.average_rating === null ? null : Number(summary.average_rating),
        },
        reviews: listResult.data ?? [],
      },
      { status: 200 },
    );
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
    const parsedBody = createReviewSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 });
    }

    const { data, error } = await callServerRpc("rpc_reviews_create", {
      p_user_id: userId,
      p_contract_id: parsedBody.data.contractId,
      p_reviewee_id: parsedBody.data.revieweeId,
      p_rating: parsedBody.data.rating,
      p_comment: parsedBody.data.comment ?? null,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const rows = (data as Array<Record<string, unknown>> | null) ?? [];
    const createdReview = rows[0];
    if (!createdReview) {
      return NextResponse.json({ error: "Failed to create review." }, { status: 500 });
    }

    return NextResponse.json({ review: createdReview }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
