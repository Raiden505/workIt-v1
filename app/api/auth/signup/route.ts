import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveApiErrorMessage } from "@/lib/api/error";
import { signupSchema } from "@/lib/validations/auth";

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { data: existingUser, error: existingUserError } = await supabaseServer
      .from("users")
      .select("id")
      .eq("email", parsed.data.email)
      .maybeSingle();

    if (existingUserError) {
      return NextResponse.json({ error: existingUserError.message }, { status: 500 });
    }

    if (existingUser) {
      return NextResponse.json({ error: "Email is already registered." }, { status: 409 });
    }

    const { data: createdUser, error: createUserError } = await supabaseServer
      .from("users")
      .insert({
        email: parsed.data.email,
        password: parsed.data.password,
      })
      .select("id")
      .single();

    if (createUserError) {
      return NextResponse.json({ error: createUserError.message }, { status: 500 });
    }

    const normalizedLastName = parsed.data.lastName?.trim() || null;

    const { error: createProfileError } = await supabaseServer.from("profile").insert({
      user_id: createdUser.id,
      first_name: parsed.data.firstName,
      last_name: normalizedLastName,
    });

    if (createProfileError) {
      await supabaseServer.from("users").delete().eq("id", createdUser.id);
      return NextResponse.json({ error: createProfileError.message }, { status: 500 });
    }

    return NextResponse.json({ user_id: createdUser.id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
