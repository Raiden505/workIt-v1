import { NextResponse } from "next/server";
import type { TablesInsert } from "@/types/database";
import { supabaseServer } from "@/lib/supabase/server";
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

async function ensureFreelancer(userId: number): Promise<{ ok: boolean; error?: string }> {
  const { data: freelancer, error } = await supabaseServer
    .from("freelancer")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!freelancer) {
    return { ok: false, error: "Only freelancers can manage skills." };
  }

  return { ok: true };
}

async function fetchFreelancerSkills(userId: number) {
  const { data: mappings, error: mappingsError } = await supabaseServer
    .from("freelancer_skill")
    .select("skill_id")
    .eq("freelancer_id", userId);

  if (mappingsError) {
    return { error: mappingsError.message, skills: [], skillIds: [] as number[] };
  }

  const skillIds = [...new Set(mappings.map((item) => item.skill_id))];
  if (skillIds.length === 0) {
    return { error: null, skills: [] as Array<{ id: number; name: string }>, skillIds };
  }

  const { data: skills, error: skillsError } = await supabaseServer
    .from("skill")
    .select("id, name")
    .in("id", skillIds)
    .order("name", { ascending: true });

  if (skillsError) {
    return { error: skillsError.message, skills: [], skillIds };
  }

  return { error: null, skills, skillIds };
}

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const freelancerCheck = await ensureFreelancer(userId);
    if (!freelancerCheck.ok) {
      const status = freelancerCheck.error === "Only freelancers can manage skills." ? 403 : 500;
      return NextResponse.json({ error: freelancerCheck.error }, { status });
    }

    const result = await fetchFreelancerSkills(userId);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ skills: result.skills, skillIds: result.skillIds }, { status: 200 });
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
      const status = freelancerCheck.error === "Only freelancers can manage skills." ? 403 : 500;
      return NextResponse.json({ error: freelancerCheck.error }, { status });
    }

    const body: unknown = await request.json();
    const parsedBody = skillIdsSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 });
    }

    const dedupedSkillIds = [...new Set(parsedBody.data.skillIds)];

    if (dedupedSkillIds.length > 0) {
      const { data: existingSkills, error: skillsError } = await supabaseServer
        .from("skill")
        .select("id")
        .in("id", dedupedSkillIds);

      if (skillsError) {
        return NextResponse.json({ error: skillsError.message }, { status: 500 });
      }

      if (existingSkills.length !== dedupedSkillIds.length) {
        return NextResponse.json({ error: "One or more skills are invalid." }, { status: 400 });
      }
    }

    const { error: deleteError } = await supabaseServer
      .from("freelancer_skill")
      .delete()
      .eq("freelancer_id", userId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (dedupedSkillIds.length > 0) {
      const payload: TablesInsert<"freelancer_skill">[] = dedupedSkillIds.map((skillId) => ({
        freelancer_id: userId,
        skill_id: skillId,
      }));

      const { error: insertError } = await supabaseServer.from("freelancer_skill").insert(payload);
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    const result = await fetchFreelancerSkills(userId);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ skills: result.skills, skillIds: result.skillIds }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
