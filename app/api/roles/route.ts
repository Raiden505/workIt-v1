import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveApiErrorMessage } from "@/lib/api/error";
import type { TablesInsert } from "@/types/database";

const createRoleSchema = z.object({
  role: z.enum(["client", "freelancer"]),
});

interface RolesPayload {
  client_id: number | null;
  freelancer_id: number | null;
}

function getUserIdFromAuthHeader(request: Request): number | null {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "").trim();

  if (!token) {
    return null;
  }

  const parsed = Number(token);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

async function fetchRolesForUser(userId: number): Promise<{
  data: RolesPayload | null;
  error: string | null;
}> {
  const [clientResult, freelancerResult] = await Promise.all([
    supabaseServer.from("client").select("user_id").eq("user_id", userId).maybeSingle(),
    supabaseServer.from("freelancer").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);

  if (clientResult.error) {
    return { data: null, error: clientResult.error.message };
  }

  if (freelancerResult.error) {
    return { data: null, error: freelancerResult.error.message };
  }

  return {
    data: {
      client_id: clientResult.data?.user_id ?? null,
      freelancer_id: freelancerResult.data?.user_id ?? null,
    },
    error: null,
  };
}

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rolesResult = await fetchRolesForUser(userId);
    if (rolesResult.error || !rolesResult.data) {
      return NextResponse.json({ error: rolesResult.error ?? "Failed to fetch roles." }, { status: 500 });
    }

    return NextResponse.json(rolesResult.data, { status: 200 });
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
    const parsed = createRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    if (parsed.data.role === "client") {
      const { data: existingClient, error: existingClientError } = await supabaseServer
        .from("client")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingClientError) {
        return NextResponse.json({ error: existingClientError.message }, { status: 500 });
      }

      if (!existingClient) {
        const payload: TablesInsert<"client"> = { user_id: userId };
        const { error: createClientError } = await supabaseServer.from("client").insert(payload);

        if (createClientError) {
          return NextResponse.json({ error: createClientError.message }, { status: 500 });
        }
      }
    }

    if (parsed.data.role === "freelancer") {
      const { data: existingFreelancer, error: existingFreelancerError } = await supabaseServer
        .from("freelancer")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingFreelancerError) {
        return NextResponse.json({ error: existingFreelancerError.message }, { status: 500 });
      }

      if (!existingFreelancer) {
        const payload: TablesInsert<"freelancer"> = { user_id: userId };
        const { error: createFreelancerError } = await supabaseServer.from("freelancer").insert(payload);

        if (createFreelancerError) {
          return NextResponse.json({ error: createFreelancerError.message }, { status: 500 });
        }
      }
    }

    const rolesResult = await fetchRolesForUser(userId);
    if (rolesResult.error || !rolesResult.data) {
      return NextResponse.json({ error: rolesResult.error ?? "Failed to fetch roles." }, { status: 500 });
    }

    return NextResponse.json(rolesResult.data, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
