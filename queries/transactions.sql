-- Canonical RPC SQL for transaction simulation and transaction lookups.
-- Naming convention: rpc_<domain>_<action>.

create or replace function public.rpc_transactions_create_payment(
  p_user_id integer,
  p_contract_id integer
)
returns table (
  ok boolean,
  status_code integer,
  result_code text,
  message text,
  id integer,
  contract_id integer,
  sender_id integer,
  receiver_id integer,
  amount numeric,
  status public.transactions_status,
  created_at timestamptz,
  contract_status public.contract_status,
  job_id integer,
  job_status public.job_status
)
language plpgsql
as $$
declare
  v_contract public.contract%rowtype;
  v_job public.job%rowtype;
  v_transaction public.transactions%rowtype;
  v_contract_status public.contract_status;
  v_job_status public.job_status;
begin
  if p_user_id is null or p_user_id <= 0 or not public.rpc_auth_user_exists(p_user_id) then
    return query
    select
      false,
      401,
      'unauthorized',
      'Unauthorized',
      null::integer,
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.transactions_status,
      null::timestamptz,
      null::public.contract_status,
      null::integer,
      null::public.job_status;
    return;
  end if;

  select c.*
  into v_contract
  from public.contract as c
  where c.id = p_contract_id
  for update;

  if not found or v_contract.job_id is null or v_contract.freelancer_id is null then
    return query
    select
      false,
      404,
      'contract_not_found',
      'Contract not found.',
      null::integer,
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.transactions_status,
      null::timestamptz,
      null::public.contract_status,
      null::integer,
      null::public.job_status;
    return;
  end if;

  if v_contract.status <> 'active'::public.contract_status then
    return query
    select
      false,
      409,
      'contract_not_active',
      'Only active contracts can be paid.',
      null::integer,
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.transactions_status,
      null::timestamptz,
      v_contract.status,
      v_contract.job_id,
      null::public.job_status;
    return;
  end if;

  select j.*
  into v_job
  from public.job as j
  where j.id = v_contract.job_id
  for update;

  if not found then
    return query
    select
      false,
      404,
      'job_not_found',
      'Job not found.',
      null::integer,
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.transactions_status,
      null::timestamptz,
      v_contract.status,
      v_contract.job_id,
      null::public.job_status;
    return;
  end if;

  if v_job.client_id <> p_user_id then
    return query
    select
      false,
      403,
      'forbidden',
      'Forbidden',
      null::integer,
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.transactions_status,
      null::timestamptz,
      v_contract.status,
      v_contract.job_id,
      v_job.status;
    return;
  end if;

  if exists(
    select 1
    from public.transactions as t
    where t.contract_id = v_contract.id
      and t.status in ('pending'::public.transactions_status, 'completed'::public.transactions_status)
  ) then
    return query
    select
      false,
      409,
      'payment_already_simulated',
      'Payment already simulated for this contract.',
      null::integer,
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.transactions_status,
      null::timestamptz,
      v_contract.status,
      v_contract.job_id,
      v_job.status;
    return;
  end if;

  insert into public.transactions (contract_id, amount, sender_id, receiver_id, status)
  values (
    v_contract.id,
    v_contract.total_price,
    p_user_id,
    v_contract.freelancer_id,
    'completed'::public.transactions_status
  )
  returning *
  into v_transaction;

  update public.contract as c
  set status = 'completed'::public.contract_status
  where c.id = v_contract.id
    and c.status = 'active'::public.contract_status
  returning c.status
  into v_contract_status;

  if v_contract_status is null then
    return query
    select
      false,
      409,
      'contract_not_active',
      'Contract is no longer active.',
      null::integer,
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.transactions_status,
      null::timestamptz,
      v_contract.status,
      v_contract.job_id,
      v_job.status;
    return;
  end if;

  update public.job as j
  set status = 'completed'::public.job_status
  where j.id = v_contract.job_id
    and j.status = 'in_progress'::public.job_status
  returning j.status
  into v_job_status;

  return query
  select
    true,
    201,
    'payment_simulated',
    'Payment simulated successfully.',
    v_transaction.id,
    v_transaction.contract_id,
    v_transaction.sender_id,
    v_transaction.receiver_id,
    v_transaction.amount,
    v_transaction.status,
    v_transaction.created_at,
    v_contract_status,
    v_contract.job_id,
    coalesce(v_job_status, v_job.status);
exception
  when others then
    return query
    select
      false,
      500,
      'internal_error',
      sqlerrm,
      null::integer,
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.transactions_status,
      null::timestamptz,
      null::public.contract_status,
      null::integer,
      null::public.job_status;
end;
$$;

create or replace function public.rpc_transactions_latest_status(
  p_contract_id integer
)
returns public.transactions_status
language sql
stable
as $$
  select t.status
  from public.transactions as t
  where t.contract_id = p_contract_id
  order by t.created_at desc
  limit 1;
$$;
