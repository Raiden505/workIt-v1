import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveApiErrorMessage } from "@/lib/api/error";

const contractsQuerySchema = z.object({
  status: z.enum(["active", "completed", "terminated"]).optional(),
  view: z.enum(["client", "freelancer"]).optional(),
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

interface ContractResponseItem {
  id: number;
  proposal_id: number | null;
  job_id: number | null;
  freelancer_id: number | null;
  total_price: number;
  status: "active" | "completed" | "terminated" | null;
  start_date: string;
  end_date: string;
  job_title: string | null;
  freelancer_name: string | null;
  client_name: string | null;
  transaction_status: "pending" | "completed" | "failed" | "refunded" | null;
}

async function fetchLatestTransactionStatusMap(contractIds: number[]): Promise<{
  map: Map<number, "pending" | "completed" | "failed" | "refunded">;
  error: string | null;
}> {
  if (contractIds.length === 0) {
    return { map: new Map(), error: null };
  }

  const { data: transactions, error } = await supabaseServer
    .from("transactions")
    .select("contract_id, status, created_at")
    .in("contract_id", contractIds)
    .order("created_at", { ascending: false });

  if (error) {
    return { map: new Map(), error: error.message };
  }

  const statusMap = new Map<number, "pending" | "completed" | "failed" | "refunded">();
  for (const transaction of transactions) {
    if (transaction.contract_id === null || transaction.status === null) {
      continue;
    }

    if (!statusMap.has(transaction.contract_id)) {
      statusMap.set(transaction.contract_id, transaction.status);
    }
  }

  return { map: statusMap, error: null };
}

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromAuthHeader(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    const parsedQuery = contractsQuerySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      view: searchParams.get("view") ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 });
    }

    const view = parsedQuery.data.view ?? "client";
    const status = parsedQuery.data.status;

    if (view === "freelancer") {
    const { data: freelancerRow, error: freelancerError } = await supabaseServer
      .from("freelancer")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (freelancerError) {
      return NextResponse.json({ error: freelancerError.message }, { status: 500 });
    }

    if (!freelancerRow) {
      return NextResponse.json({ error: "Only freelancers can access freelancer contracts." }, { status: 403 });
    }

    let contractsQuery = supabaseServer
      .from("contract")
      .select("id, proposal_id, job_id, freelancer_id, total_price, status, start_date, end_date")
      .eq("freelancer_id", userId)
      .order("start_date", { ascending: false });

    if (status) {
      contractsQuery = contractsQuery.eq("status", status);
    }

    const { data: contracts, error: contractsError } = await contractsQuery;

    if (contractsError) {
      return NextResponse.json({ error: contractsError.message }, { status: 500 });
    }

    const usedJobIds = [
      ...new Set(contracts.map((item) => item.job_id).filter((id): id is number => id !== null)),
    ];
    let jobTitleMap = new Map<number, string>();
    let clientIdByJobId = new Map<number, number>();

    if (usedJobIds.length > 0) {
      const { data: jobs, error: jobsError } = await supabaseServer
        .from("job")
        .select("id, title, client_id")
        .in("id", usedJobIds);

      if (jobsError) {
        return NextResponse.json({ error: jobsError.message }, { status: 500 });
      }

      jobTitleMap = new Map(jobs.map((job) => [job.id, job.title]));
      clientIdByJobId = new Map(
        jobs
          .filter((job) => job.client_id !== null)
          .map((job) => [job.id, job.client_id as number]),
      );
    }

    const usedClientIds = [...new Set([...clientIdByJobId.values()])];
    let clientNameMap = new Map<number, string>();

    if (usedClientIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseServer
        .from("profile")
        .select("user_id, first_name, last_name")
        .in("user_id", usedClientIds);

      if (profilesError) {
        return NextResponse.json({ error: profilesError.message }, { status: 500 });
      }

      clientNameMap = new Map(
        profiles.map((profile) => [
          profile.user_id,
          `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`,
        ]),
      );
    }

    const usedContractIds = contracts.map((contract) => contract.id);
    const transactionStatusResult = await fetchLatestTransactionStatusMap(usedContractIds);
    if (transactionStatusResult.error) {
      return NextResponse.json({ error: transactionStatusResult.error }, { status: 500 });
    }

    const responseContracts: ContractResponseItem[] = contracts.map((contract) => {
      const clientId = contract.job_id === null ? null : clientIdByJobId.get(contract.job_id) ?? null;

      return {
        ...contract,
        job_title: contract.job_id === null ? null : jobTitleMap.get(contract.job_id) ?? null,
        freelancer_name: null,
        client_name: clientId === null ? null : clientNameMap.get(clientId) ?? null,
        transaction_status: transactionStatusResult.map.get(contract.id) ?? null,
      };
    });

      return NextResponse.json({ contracts: responseContracts }, { status: 200 });
    }

  const { data: jobsOwnedByClient, error: jobsOwnedByClientError } = await supabaseServer
    .from("job")
    .select("id")
    .eq("client_id", userId);

  if (jobsOwnedByClientError) {
    return NextResponse.json({ error: jobsOwnedByClientError.message }, { status: 500 });
  }

  const jobIds = jobsOwnedByClient.map((job) => job.id);
  if (jobIds.length === 0) {
    return NextResponse.json({ contracts: [] }, { status: 200 });
  }

  let contractsQuery = supabaseServer
    .from("contract")
    .select("id, proposal_id, job_id, freelancer_id, total_price, status, start_date, end_date")
    .in("job_id", jobIds)
    .order("start_date", { ascending: false });

  if (status) {
    contractsQuery = contractsQuery.eq("status", status);
  }

  const { data: contracts, error: contractsError } = await contractsQuery;

  if (contractsError) {
    return NextResponse.json({ error: contractsError.message }, { status: 500 });
  }

  const usedJobIds = [...new Set(contracts.map((item) => item.job_id).filter((id): id is number => id !== null))];
  const usedFreelancerIds = [
    ...new Set(contracts.map((item) => item.freelancer_id).filter((id): id is number => id !== null)),
  ];

  let jobTitleMap = new Map<number, string>();
  if (usedJobIds.length > 0) {
    const { data: jobs, error: jobsError } = await supabaseServer
      .from("job")
      .select("id, title")
      .in("id", usedJobIds);

    if (jobsError) {
      return NextResponse.json({ error: jobsError.message }, { status: 500 });
    }

    jobTitleMap = new Map(jobs.map((job) => [job.id, job.title]));
  }

  let freelancerNameMap = new Map<number, string>();
  if (usedFreelancerIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseServer
      .from("profile")
      .select("user_id, first_name, last_name")
      .in("user_id", usedFreelancerIds);

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    freelancerNameMap = new Map(
      profiles.map((profile) => [
        profile.user_id,
        `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`,
      ]),
    );
  }

  const usedContractIds = contracts.map((contract) => contract.id);
  const transactionStatusResult = await fetchLatestTransactionStatusMap(usedContractIds);
  if (transactionStatusResult.error) {
    return NextResponse.json({ error: transactionStatusResult.error }, { status: 500 });
  }

  const responseContracts: ContractResponseItem[] = contracts.map((contract) => ({
    ...contract,
    job_title: contract.job_id === null ? null : jobTitleMap.get(contract.job_id) ?? null,
    freelancer_name:
      contract.freelancer_id === null ? null : freelancerNameMap.get(contract.freelancer_id) ?? null,
    client_name: null,
    transaction_status: transactionStatusResult.map.get(contract.id) ?? null,
  }));

    return NextResponse.json({ contracts: responseContracts }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: resolveApiErrorMessage(error) }, { status: 500 });
  }
}
