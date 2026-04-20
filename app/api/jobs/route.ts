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

    const categoryIds = [
      ...new Set(jobs.map((item) => item.category_id).filter((item): item is number => item !== null)),
    ];
    const clientIds = [...new Set(jobs.map((item) => item.client_id).filter((item): item is number => item !== null))];
    const jobIds = jobs.map((job) => job.id);

    let categoryMap = new Map<number, string>();
    let clientNameMap = new Map<number, { name: string; avatar_url: string | null }>();
    const skillsByJobId = new Map<number, Array<{ id: number; name: string }>>();

    if (categoryIds.length > 0) {
      const { data: categories, error: categoriesError } = await supabaseServer
        .from("category")
        .select("id, name")
        .in("id", categoryIds);

      if (categoriesError) {
        return NextResponse.json({ error: categoriesError.message }, { status: 500 });
      }

      categoryMap = new Map(categories.map((category) => [category.id, category.name]));
    }

    if (clientIds.length > 0) {
      const { data: clientProfiles, error: clientProfilesError } = await supabaseServer
        .from("profile")
        .select("user_id, first_name, last_name, avatar_url")
        .in("user_id", clientIds);

      if (clientProfilesError) {
        return NextResponse.json({ error: clientProfilesError.message }, { status: 500 });
      }

      clientNameMap = new Map(
        clientProfiles.map((profile) => [
          profile.user_id,
          {
            name: `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`,
            avatar_url: profile.avatar_url,
          },
        ]),
      );
    }

    if (jobIds.length > 0) {
      const { data: mappings, error: mappingsError } = await supabaseServer
        .from("job_skill")
        .select("job_id, skill_id")
        .in("job_id", jobIds);

      if (mappingsError) {
        return NextResponse.json({ error: mappingsError.message }, { status: 500 });
      }

      const skillIds = [...new Set(mappings.map((item) => item.skill_id))];
      let skillMap = new Map<number, { id: number; name: string }>();

      if (skillIds.length > 0) {
        const { data: skills, error: skillsError } = await supabaseServer
          .from("skill")
          .select("id, name")
          .in("id", skillIds);

        if (skillsError) {
          return NextResponse.json({ error: skillsError.message }, { status: 500 });
        }

        skillMap = new Map(skills.map((skill) => [skill.id, skill]));
      }

      for (const mapping of mappings) {
        const current = skillsByJobId.get(mapping.job_id) ?? [];
        const mappedSkill = skillMap.get(mapping.skill_id);

        if (mappedSkill && !current.some((item) => item.id === mappedSkill.id)) {
          current.push(mappedSkill);
          skillsByJobId.set(mapping.job_id, current);
        }
      }
    }

    const responseJobs = jobs.map((job) => ({
      ...job,
      category_name: job.category_id === null ? null : categoryMap.get(job.category_id) ?? null,
      client_name: job.client_id === null ? null : clientNameMap.get(job.client_id)?.name ?? null,
      client_avatar_url: job.client_id === null ? null : clientNameMap.get(job.client_id)?.avatar_url ?? null,
      skills: skillsByJobId.get(job.id) ?? [],
    }));

    return NextResponse.json({ jobs: responseJobs }, { status: 200 });
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

    const dedupedSkillIds = [...new Set(parsedBody.data.skillIds)];
    const { data: existingSkills, error: existingSkillsError } = await supabaseServer
      .from("skill")
      .select("id")
      .in("id", dedupedSkillIds);

    if (existingSkillsError) {
      return NextResponse.json({ error: existingSkillsError.message }, { status: 500 });
    }

    if (existingSkills.length !== dedupedSkillIds.length) {
      return NextResponse.json({ error: "One or more selected skills are invalid." }, { status: 400 });
    }

    const payload: TablesInsert<"job"> = {
      client_id: userId,
      category_id: parsedBody.data.categoryId,
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
      if (insertError.code === "23503") {
        return NextResponse.json({ error: "Invalid category id." }, { status: 400 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const skillPayload: TablesInsert<"job_skill">[] = dedupedSkillIds.map((skillId) => ({
      job_id: job.id,
      skill_id: skillId,
    }));

    const { error: insertSkillsError } = await supabaseServer.from("job_skill").insert(skillPayload);
    if (insertSkillsError) {
      await supabaseServer.from("job").delete().eq("id", job.id);
      return NextResponse.json({ error: insertSkillsError.message }, { status: 500 });
    }

    const { data: category, error: categoryError } = await supabaseServer
      .from("category")
      .select("id, name")
      .eq("id", job.category_id as number)
      .maybeSingle();

    if (categoryError) {
      return NextResponse.json({ error: categoryError.message }, { status: 500 });
    }

    const { data: skills, error: skillsError } = await supabaseServer
      .from("skill")
      .select("id, name")
      .in("id", dedupedSkillIds)
      .order("name", { ascending: true });

    if (skillsError) {
      return NextResponse.json({ error: skillsError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        job: {
          ...job,
          category_name: category?.name ?? null,
          skills,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
