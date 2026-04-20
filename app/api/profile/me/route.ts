import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveApiErrorMessage } from "@/lib/api/error";
import { profileUpdateSchema } from "@/lib/validations/profile";

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

async function fetchMyProfilePayload(userId: number) {
  const [userResult, profileResult, clientResult, freelancerResult] = await Promise.all([
    supabaseServer.from("users").select("id, email").eq("id", userId).maybeSingle(),
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

  if (userResult.error) return { error: userResult.error.message, payload: null };
  if (profileResult.error) return { error: profileResult.error.message, payload: null };
  if (clientResult.error) return { error: clientResult.error.message, payload: null };
  if (freelancerResult.error) return { error: freelancerResult.error.message, payload: null };

  if (!userResult.data || !profileResult.data) {
    return { error: "Profile not found.", payload: null };
  }

  const payload = {
    user: {
      id: userResult.data.id,
      email: userResult.data.email,
    },
    profile: profileResult.data,
    client: clientResult.data,
    freelancer: freelancerResult.data,
  };

  return { error: null, payload };
}

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await fetchMyProfilePayload(userId);
    if (result.error || !result.payload) {
      const status = result.error === "Profile not found." ? 404 : 500;
      return NextResponse.json({ error: result.error ?? "Failed to fetch profile." }, { status });
    }

    return NextResponse.json(result.payload, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    const parsedBody = profileUpdateSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 });
    }

    const { bio, avatarUrl, companyName, hourlyRate, portfolioUrl } = parsedBody.data;

    if (bio !== undefined || avatarUrl !== undefined) {
      const updateProfilePayload: {
        bio?: string | null;
        avatar_url?: string | null;
      } = {};

      if (bio !== undefined) {
        updateProfilePayload.bio = bio;
      }

      if (avatarUrl !== undefined) {
        updateProfilePayload.avatar_url = avatarUrl;
      }

      const { error: profileUpdateError } = await supabaseServer
        .from("profile")
        .update(updateProfilePayload)
        .eq("user_id", userId);

      if (profileUpdateError) {
        return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
      }
    }

    if (companyName !== undefined) {
      const { data: clientRow, error: clientCheckError } = await supabaseServer
        .from("client")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (clientCheckError) {
        return NextResponse.json({ error: clientCheckError.message }, { status: 500 });
      }

      if (!clientRow) {
        return NextResponse.json({ error: "Only clients can update company details." }, { status: 403 });
      }

      const { error: clientUpdateError } = await supabaseServer
        .from("client")
        .update({ company_name: companyName })
        .eq("user_id", userId);

      if (clientUpdateError) {
        return NextResponse.json({ error: clientUpdateError.message }, { status: 500 });
      }
    }

    if (hourlyRate !== undefined || portfolioUrl !== undefined) {
      const { data: freelancerRow, error: freelancerCheckError } = await supabaseServer
        .from("freelancer")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (freelancerCheckError) {
        return NextResponse.json({ error: freelancerCheckError.message }, { status: 500 });
      }

      if (!freelancerRow) {
        return NextResponse.json({ error: "Only freelancers can update freelancer details." }, { status: 403 });
      }

      const updateFreelancerPayload: {
        hourly_rate?: number;
        portfolio_url?: string | null;
      } = {};

      if (hourlyRate !== undefined) {
        updateFreelancerPayload.hourly_rate = hourlyRate;
      }

      if (portfolioUrl !== undefined) {
        updateFreelancerPayload.portfolio_url = portfolioUrl;
      }

      const { error: freelancerUpdateError } = await supabaseServer
        .from("freelancer")
        .update(updateFreelancerPayload)
        .eq("user_id", userId);

      if (freelancerUpdateError) {
        return NextResponse.json({ error: freelancerUpdateError.message }, { status: 500 });
      }
    }

    const result = await fetchMyProfilePayload(userId);
    if (result.error || !result.payload) {
      const status = result.error === "Profile not found." ? 404 : 500;
      return NextResponse.json({ error: result.error ?? "Failed to fetch profile." }, { status });
    }

    return NextResponse.json(result.payload, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
