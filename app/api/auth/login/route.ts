import { NextResponse } from "next/server";
import { callServerRpc } from "@/lib/supabase/rpc";
import { resolveApiErrorMessage } from "@/lib/api/error";
import { loginSchema } from "@/lib/validations/auth";

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { data, error } = await callServerRpc("rpc_auth_login", {
      p_email: parsed.data.email,
      p_password: parsed.data.password,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const users = (data as Array<{ user_id: number }> | null) ?? [];
    const user = users[0];
    if (!user?.user_id) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    return NextResponse.json({ user_id: user.user_id }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
