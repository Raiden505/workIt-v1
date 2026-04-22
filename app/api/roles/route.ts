import { NextResponse } from "next/server";
import { z } from "zod";
import { callServerRpc } from "@/lib/supabase/rpc";
import { resolveApiErrorMessage } from "@/lib/api/error";

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
  status: number;
}> {
  const { data, error } = await callServerRpc("rpc_roles_get", { p_user_id: userId });
  if (error) {
    return { data: null, error: error.message, status: error.status };
  }

  const rows = (data as Array<{ client_id: number | null; freelancer_id: number | null }> | null) ?? [];
  const row = rows[0];
  return {
    data: {
      client_id: row?.client_id ?? null,
      freelancer_id: row?.freelancer_id ?? null,
    },
    error: null,
    status: 200,
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
      return NextResponse.json({ error: rolesResult.error ?? "Failed to fetch roles." }, { status: rolesResult.status });
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
      const { error } = await callServerRpc("rpc_roles_activate_client", {
        p_user_id: userId,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
    }

    if (parsed.data.role === "freelancer") {
      const { error } = await callServerRpc("rpc_roles_activate_freelancer", {
        p_user_id: userId,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
    }

    const rolesResult = await fetchRolesForUser(userId);
    if (rolesResult.error || !rolesResult.data) {
      return NextResponse.json({ error: rolesResult.error ?? "Failed to fetch roles." }, { status: rolesResult.status });
    }

    return NextResponse.json(rolesResult.data, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
