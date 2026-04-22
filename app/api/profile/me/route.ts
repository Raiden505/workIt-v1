import { NextResponse } from "next/server";
import { callServerRpc } from "@/lib/supabase/rpc";
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

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await callServerRpc("rpc_profiles_get_me", { p_user_id: userId });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (!data) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    return NextResponse.json(data, { status: 200 });
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
    const { data, error } = await callServerRpc("rpc_profiles_update_me", {
      p_user_id: userId,
      p_set_bio: bio !== undefined,
      p_bio: bio ?? null,
      p_set_avatar_url: avatarUrl !== undefined,
      p_avatar_url: avatarUrl ?? null,
      p_set_company_name: companyName !== undefined,
      p_company_name: companyName ?? null,
      p_set_hourly_rate: hourlyRate !== undefined,
      p_hourly_rate: hourlyRate ?? null,
      p_set_portfolio_url: portfolioUrl !== undefined,
      p_portfolio_url: portfolioUrl ?? null,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const rows = (data as Array<{
      ok: boolean;
      status_code: number;
      message: string;
      payload: Record<string, unknown> | null;
    }> | null) ?? [];
    const result = rows[0];
    if (!result) {
      return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status_code });
    }

    return NextResponse.json(result.payload, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
