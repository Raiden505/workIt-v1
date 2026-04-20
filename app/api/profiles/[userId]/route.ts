import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveApiErrorMessage } from "@/lib/api/error";
import { userIdParamsSchema } from "@/lib/validations/profile";

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

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const authUserId = getUserIdFromAuthHeader(request);
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const parsedParams = userIdParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: parsedParams.error.issues }, { status: 400 });
    }

    const userId = parsedParams.data.userId;

    const [profileResult, clientResult, freelancerResult] = await Promise.all([
      supabaseServer
        .from("profile")
        .select("user_id, first_name, last_name, avatar_url, bio")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseServer.from("client").select("user_id, company_name").eq("user_id", userId).maybeSingle(),
      supabaseServer
        .from("freelancer")
        .select("user_id, hourly_rate, portfolio_url")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
    }
    if (clientResult.error) {
      return NextResponse.json({ error: clientResult.error.message }, { status: 500 });
    }
    if (freelancerResult.error) {
      return NextResponse.json({ error: freelancerResult.error.message }, { status: 500 });
    }

    if (!profileResult.data) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    let freelancerSkills: Array<{ id: number; name: string }> = [];
    if (freelancerResult.data) {
      const { data: mappings, error: mappingsError } = await supabaseServer
        .from("freelancer_skill")
        .select("skill_id")
        .eq("freelancer_id", userId);

      if (mappingsError) {
        return NextResponse.json({ error: mappingsError.message }, { status: 500 });
      }

      const skillIds = [...new Set(mappings.map((item) => item.skill_id))];
      if (skillIds.length > 0) {
        const { data: skills, error: skillsError } = await supabaseServer
          .from("skill")
          .select("id, name")
          .in("id", skillIds)
          .order("name", { ascending: true });

        if (skillsError) {
          return NextResponse.json({ error: skillsError.message }, { status: 500 });
        }

        freelancerSkills = skills;
      }
    }

    const { data: reviews, error: reviewsError } = await supabaseServer
      .from("review")
      .select("id, contract_id, reviewer_id, reviewee_id, rating, comment, created_at")
      .eq("reviewee_id", userId)
      .order("created_at", { ascending: false });

    if (reviewsError) {
      return NextResponse.json({ error: reviewsError.message }, { status: 500 });
    }

    const reviewerIds = [
      ...new Set(reviews.map((item) => item.reviewer_id).filter((item): item is number => item !== null)),
    ];
    let reviewerNameMap = new Map<number, string>();

    if (reviewerIds.length > 0) {
      const { data: reviewerProfiles, error: reviewerProfilesError } = await supabaseServer
        .from("profile")
        .select("user_id, first_name, last_name")
        .in("user_id", reviewerIds);

      if (reviewerProfilesError) {
        return NextResponse.json({ error: reviewerProfilesError.message }, { status: 500 });
      }

      reviewerNameMap = new Map(
        reviewerProfiles.map((item) => [
          item.user_id,
          `${item.first_name}${item.last_name ? ` ${item.last_name}` : ""}`,
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
        user_id: profileResult.data.user_id,
        first_name: profileResult.data.first_name,
        last_name: profileResult.data.last_name,
        avatar_url: profileResult.data.avatar_url,
        bio: profileResult.data.bio,
        client: clientResult.data,
        freelancer: freelancerResult.data,
        skills: freelancerSkills,
        reviews: {
          count: reviews.length,
          average_rating: averageRating,
          items: reviews.map((review) => ({
            ...review,
            reviewer_name:
              review.reviewer_id === null ? null : reviewerNameMap.get(review.reviewer_id) ?? null,
          })),
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
