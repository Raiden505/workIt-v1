import { NextResponse } from "next/server";
import { callServerRpc } from "@/lib/supabase/rpc";
import { resolveApiErrorMessage } from "@/lib/api/error";
import { signupSchema } from "@/lib/validations/auth";

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { data, error } = await callServerRpc("rpc_auth_sign_up", {
      p_email: parsed.data.email,
      p_password: parsed.data.password,
      p_first_name: parsed.data.firstName,
      p_last_name: parsed.data.lastName ?? null,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const rows = (data as Array<{ user_id: number }> | null) ?? [];
    const createdUser = rows[0];
    if (!createdUser?.user_id) {
      return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
    }

    return NextResponse.json({ user_id: createdUser.user_id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
