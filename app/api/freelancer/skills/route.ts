import { NextResponse } from "next/server";
import { callServerRpc } from "@/lib/supabase/rpc";
import { resolveApiErrorMessage } from "@/lib/api/error";
import { skillIdsSchema } from "@/lib/validations/skill";

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

async function ensureFreelancer(userId: number): Promise<{ ok: boolean; error?: string; status?: number }> {
  const { data, error } = await callServerRpc("rpc_roles_get", { p_user_id: userId });
  if (error) {
    return { ok: false, error: error.message, status: error.status };
  }

  const rows = (data as Array<{ freelancer_id: number | null }> | null) ?? [];
  const roles = rows[0];
  if (!roles?.freelancer_id) {
    return { ok: false, error: "Only freelancers can manage skills.", status: 403 };
  }

  return { ok: true };
}

async function fetchFreelancerSkills(userId: number) {
  const { data, error } = await callServerRpc("rpc_skills_list_for_freelancer", { p_freelancer_id: userId });
  if (error) {
    return { error: error.message, status: error.status, skills: [] as Array<{ id: number; name: string }> };
  }

  const skills = (data as Array<{ id: number; name: string }> | null) ?? [];
  return { error: null, status: 200, skills };
}

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const freelancerCheck = await ensureFreelancer(userId);
    if (!freelancerCheck.ok) {
      return NextResponse.json({ error: freelancerCheck.error }, { status: freelancerCheck.status ?? 500 });
    }

    const result = await fetchFreelancerSkills(userId);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      {
        skills: result.skills,
        skillIds: result.skills.map((skill) => skill.id),
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const freelancerCheck = await ensureFreelancer(userId);
    if (!freelancerCheck.ok) {
      return NextResponse.json({ error: freelancerCheck.error }, { status: freelancerCheck.status ?? 500 });
    }

    const body: unknown = await request.json();
    const parsedBody = skillIdsSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 });
    }

    const { data, error } = await callServerRpc("rpc_skills_replace_for_freelancer", {
      p_user_id: userId,
      p_skill_ids: parsedBody.data.skillIds,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const rows = (data as Array<{
      ok: boolean;
      status_code: number;
      message: string;
      skills: unknown;
      skill_ids: unknown;
    }> | null) ?? [];
    const result = rows[0];
    if (!result) {
      return NextResponse.json({ error: "Failed to update skills." }, { status: 500 });
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status_code });
    }

    const skills = Array.isArray(result.skills) ? result.skills : [];
    const skillIds = Array.isArray(result.skill_ids) ? result.skill_ids : [];

    return NextResponse.json({ skills, skillIds }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
