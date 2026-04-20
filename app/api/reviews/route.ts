import { NextResponse } from "next/server";
import type { TablesInsert } from "@/types/database";
import { supabaseServer } from "@/lib/supabase/server";
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

    const { reviewee_id: revieweeId, contract_id: contractId } = parsedQuery.data;

    let reviewsQuery = supabaseServer
      .from("review")
      .select("id, contract_id, reviewer_id, reviewee_id, rating, comment, created_at")
      .order("created_at", { ascending: false });

    if (revieweeId !== undefined) {
      reviewsQuery = reviewsQuery.eq("reviewee_id", revieweeId);
    }

    if (contractId !== undefined) {
      reviewsQuery = reviewsQuery.eq("contract_id", contractId);
    }

    const { data: reviews, error: reviewsError } = await reviewsQuery;
    if (reviewsError) {
      return NextResponse.json({ error: reviewsError.message }, { status: 500 });
    }

    const reviewerIds = [
      ...new Set(reviews.map((item) => item.reviewer_id).filter((item): item is number => item !== null)),
    ];
    let reviewerNameMap = new Map<number, string>();

    if (reviewerIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseServer
        .from("profile")
        .select("user_id, first_name, last_name")
        .in("user_id", reviewerIds);

      if (profilesError) {
        return NextResponse.json({ error: profilesError.message }, { status: 500 });
      }

      reviewerNameMap = new Map(
        profiles.map((profile) => [
          profile.user_id,
          `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`,
        ]),
      );
    }

    const ratings = reviews.map((review) => review.rating).filter((rating): rating is number => rating !== null);
    const averageRating =
      ratings.length > 0
        ? Number((ratings.reduce((total, value) => total + value, 0) / ratings.length).toFixed(2))
        : null;

    return NextResponse.json(
      {
        summary: {
          count: reviews.length,
          average_rating: averageRating,
        },
        reviews: reviews.map((review) => ({
          ...review,
          reviewer_name:
            review.reviewer_id === null ? null : reviewerNameMap.get(review.reviewer_id) ?? null,
        })),
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

    const { contractId, revieweeId, rating, comment } = parsedBody.data;

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

    if (contract.status !== "completed") {
      return NextResponse.json({ error: "Reviews can only be submitted for completed contracts." }, { status: 409 });
    }

    const { data: job, error: jobError } = await supabaseServer
      .from("job")
      .select("id, client_id")
      .eq("id", contract.job_id)
      .maybeSingle();

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    if (!job || job.client_id === null) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    let expectedRevieweeId: number | null = null;
    if (userId === job.client_id) {
      expectedRevieweeId = contract.freelancer_id;
    } else if (userId === contract.freelancer_id) {
      expectedRevieweeId = job.client_id;
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (revieweeId !== expectedRevieweeId) {
      return NextResponse.json({ error: "Invalid reviewee for this contract." }, { status: 400 });
    }

    const { data: existingReview, error: existingReviewError } = await supabaseServer
      .from("review")
      .select("id")
      .eq("contract_id", contractId)
      .eq("reviewer_id", userId)
      .eq("reviewee_id", revieweeId)
      .maybeSingle();

    if (existingReviewError) {
      return NextResponse.json({ error: existingReviewError.message }, { status: 500 });
    }

    if (existingReview) {
      return NextResponse.json({ error: "You have already reviewed this user for this contract." }, { status: 409 });
    }

    const payload: TablesInsert<"review"> = {
      contract_id: contractId,
      reviewer_id: userId,
      reviewee_id: revieweeId,
      rating,
      comment: comment ?? null,
    };

    const { data: createdReview, error: createReviewError } = await supabaseServer
      .from("review")
      .insert(payload)
      .select("id, contract_id, reviewer_id, reviewee_id, rating, comment, created_at")
      .single();

    if (createReviewError) {
      return NextResponse.json({ error: createReviewError.message }, { status: 500 });
    }

    return NextResponse.json({ review: createdReview }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
