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

interface ProposalResponseItem {
  id: number;
  job_id: number | null;
  freelancer_id: number | null;
  bid_amount: number | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn" | null;
  created_at: string;
  freelancer_name: string | null;
  freelancer_avatar_url: string | null;
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

    const jobId = parsedParams.data.id;

    const { data: job, error: jobError } = await supabaseServer
      .from("job")
      .select("id, client_id, category_id, title, description, budget, status, created_at")
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

    const { data: clientProfile, error: clientProfileError } = await supabaseServer
      .from("profile")
      .select("first_name, last_name, avatar_url")
      .eq("user_id", job.client_id)
      .maybeSingle();

    if (clientProfileError) {
      return NextResponse.json({ error: clientProfileError.message }, { status: 500 });
    }

    const { data: proposals, error: proposalsError } = await supabaseServer
      .from("proposal")
      .select("id, job_id, freelancer_id, bid_amount, status, created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    if (proposalsError) {
      return NextResponse.json({ error: proposalsError.message }, { status: 500 });
    }

    const freelancerIds = [
      ...new Set(proposals.map((item) => item.freelancer_id).filter((item): item is number => item !== null)),
    ];
    let profileMap = new Map<number, { name: string; avatar_url: string | null }>();

    if (freelancerIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseServer
        .from("profile")
        .select("user_id, first_name, last_name, avatar_url")
        .in("user_id", freelancerIds);

      if (profilesError) {
        return NextResponse.json({ error: profilesError.message }, { status: 500 });
      }

      profileMap = new Map(
        profiles.map((profile) => [
          profile.user_id,
          {
            name: `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`,
            avatar_url: profile.avatar_url,
          },
        ]),
      );
    }

    const responseProposals: ProposalResponseItem[] = proposals.map((proposal) => ({
      ...proposal,
      freelancer_name:
        proposal.freelancer_id === null ? null : profileMap.get(proposal.freelancer_id)?.name ?? null,
      freelancer_avatar_url:
        proposal.freelancer_id === null ? null : profileMap.get(proposal.freelancer_id)?.avatar_url ?? null,
    }));

    return NextResponse.json(
      {
        job: {
          ...job,
          client_name: clientProfile
            ? `${clientProfile.first_name}${clientProfile.last_name ? ` ${clientProfile.last_name}` : ""}`
            : null,
          client_avatar_url: clientProfile?.avatar_url ?? null,
        },
        proposals: responseProposals,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
