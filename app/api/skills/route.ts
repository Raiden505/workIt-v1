import { NextResponse } from "next/server";
import { callServerRpc } from "@/lib/supabase/rpc";
import { resolveApiErrorMessage } from "@/lib/api/error";

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

    const { data: skills, error } = await callServerRpc("rpc_skills_list_for_user", { p_user_id: userId });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ skills: skills ?? [] }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
