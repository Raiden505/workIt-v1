import { NextResponse } from "next/server";
import { callServerRpc } from "@/lib/supabase/rpc";
import { resolveApiErrorMessage } from "@/lib/api/error";
import { contractIdParamsSchema, updateContractStatusSchema } from "@/lib/validations/contract";

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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const parsedParams = contractIdParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: parsedParams.error.issues }, { status: 400 });
    }

    const body: unknown = await request.json();
    const parsedBody = updateContractStatusSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 });
    }

    const { data, error } = await callServerRpc("rpc_contracts_set_status", {
      p_user_id: userId,
      p_contract_id: parsedParams.data.id,
      p_next_status: parsedBody.data.status,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const rows = (data as Array<{
      ok: boolean;
      status_code: number;
      message: string;
      id: number | null;
      status: "active" | "completed" | "terminated" | null;
    }> | null) ?? [];
    const result = rows[0];
    if (!result) {
      return NextResponse.json({ error: "Failed to update contract status." }, { status: 500 });
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status_code });
    }

    return NextResponse.json({ contract: { id: result.id, status: result.status } }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
