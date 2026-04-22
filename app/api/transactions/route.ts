import { NextResponse } from "next/server";
import { z } from "zod";
import { callServerRpc } from "@/lib/supabase/rpc";
import { resolveApiErrorMessage } from "@/lib/api/error";

const createTransactionSchema = z.object({
  contractId: z.coerce.number().int().positive(),
});

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

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    const parsedBody = createTransactionSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 });
    }

    const { data, error } = await callServerRpc("rpc_transactions_create_payment", {
      p_user_id: userId,
      p_contract_id: parsedBody.data.contractId,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const rows = (data as Array<{
      ok: boolean;
      status_code: number;
      message: string;
      id: number | null;
      contract_id: number | null;
      sender_id: number | null;
      receiver_id: number | null;
      amount: number | null;
      status: "pending" | "completed" | "failed" | "refunded" | null;
      created_at: string | null;
      contract_status: "active" | "completed" | "terminated" | null;
    }> | null) ?? [];
    const result = rows[0];
    if (!result) {
      return NextResponse.json({ error: "Failed to create payment transaction." }, { status: 500 });
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status_code });
    }

    return NextResponse.json(
      {
        transaction: {
          id: result.id,
          contract_id: result.contract_id,
          sender_id: result.sender_id,
          receiver_id: result.receiver_id,
          amount: result.amount,
          status: result.status,
          created_at: result.created_at,
        },
        contract: {
          id: result.contract_id,
          status: result.contract_status,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
