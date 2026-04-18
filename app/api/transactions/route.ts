import { NextResponse } from "next/server";
import { z } from "zod";
import type { TablesInsert } from "@/types/database";
import { supabaseServer } from "@/lib/supabase/server";
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

    const contractId = parsedBody.data.contractId;

    const { data: contract, error: contractError } = await supabaseServer
      .from("contract")
      .select("id, job_id, freelancer_id, total_price, status")
      .eq("id", contractId)
      .maybeSingle();

    if (contractError) {
      return NextResponse.json({ error: contractError.message }, { status: 500 });
    }

    if (!contract || contract.job_id === null || contract.freelancer_id === null) {
      return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    }

    if (contract.status !== "active") {
      return NextResponse.json({ error: "Only active contracts can be paid." }, { status: 409 });
    }

    const { data: job, error: jobError } = await supabaseServer
      .from("job")
      .select("id, client_id")
      .eq("id", contract.job_id)
      .maybeSingle();

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    if (job.client_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: existingTransaction, error: existingTransactionError } = await supabaseServer
      .from("transactions")
      .select("id, status")
      .eq("contract_id", contract.id)
      .in("status", ["pending", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingTransactionError) {
      return NextResponse.json({ error: existingTransactionError.message }, { status: 500 });
    }

    if (existingTransaction) {
      return NextResponse.json({ error: "Payment already simulated for this contract." }, { status: 409 });
    }

    const payload: TablesInsert<"transactions"> = {
      contract_id: contract.id,
      amount: contract.total_price,
      sender_id: userId,
      receiver_id: contract.freelancer_id,
      status: "completed",
    };

    const { data: transaction, error: createTransactionError } = await supabaseServer
      .from("transactions")
      .insert(payload)
      .select("id, contract_id, sender_id, receiver_id, amount, status, created_at")
      .single();

    if (createTransactionError) {
      return NextResponse.json({ error: createTransactionError.message }, { status: 500 });
    }

    const { data: updatedContract, error: updateContractError } = await supabaseServer
      .from("contract")
      .update({ status: "completed" })
      .eq("id", contract.id)
      .eq("status", "active")
      .select("id, status")
      .maybeSingle();

    if (updateContractError) {
      await supabaseServer.from("transactions").delete().eq("id", transaction.id);
      return NextResponse.json({ error: updateContractError.message }, { status: 500 });
    }

    if (!updatedContract) {
      await supabaseServer.from("transactions").delete().eq("id", transaction.id);
      return NextResponse.json({ error: "Contract is no longer active." }, { status: 409 });
    }

    return NextResponse.json({ transaction, contract: updatedContract }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
