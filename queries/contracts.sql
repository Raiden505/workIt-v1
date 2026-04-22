-- Canonical RPC SQL for contract lifecycle and contract projections.
-- Naming convention: rpc_<domain>_<action>.

create or replace function public.rpc_contracts_accept_proposal(
  p_user_id integer,
  p_proposal_id integer,
  p_duration_days integer default 30
)
returns table (
  ok boolean,
  status_code integer,
  result_code text,
  message text,
  id integer,
  proposal_id integer,
  job_id integer,
  freelancer_id integer,
  total_price numeric,
  status public.contract_status,
  start_date date,
  end_date date,
  job_status public.job_status
)
language plpgsql
as $$
declare
  v_proposal public.proposal%rowtype;
  v_job public.job%rowtype;
  v_contract public.contract%rowtype;
  v_start_date date := current_date;
  v_end_date date;
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
      null::public.contract_status,
      null::date,
      null::date,
      null::public.job_status;
    return;
  end if;

  if p_duration_days is null or p_duration_days <= 0 then
    return query
    select
      false,
      400,
      'invalid_duration',
      'Duration must be greater than zero.',
      null::integer,
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.contract_status,
      null::date,
      null::date,
      null::public.job_status;
    return;
  end if;

  select p.*
  into v_proposal
  from public.proposal as p
  where p.id = p_proposal_id
  for update;

  if not found or v_proposal.job_id is null or v_proposal.freelancer_id is null or v_proposal.bid_amount is null then
    return query
    select
      false,
      404,
      'proposal_not_found',
      'Proposal not found.',
      null::integer,
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.contract_status,
      null::date,
      null::date,
      null::public.job_status;
    return;
  end if;

  select j.*
  into v_job
  from public.job as j
  where j.id = v_proposal.job_id
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
      null::public.contract_status,
      null::date,
      null::date,
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
      null::public.contract_status,
      null::date,
      null::date,
      null::public.job_status;
    return;
  end if;

  if v_proposal.status <> 'pending'::public.proposal_status then
    return query
    select
      false,
      409,
      'proposal_not_pending',
      'Proposal is no longer pending.',
      null::integer,
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.contract_status,
      null::date,
      null::date,
      null::public.job_status;
    return;
  end if;

  if v_job.status <> 'open'::public.job_status then
    return query
    select
      false,
      409,
      'job_not_open',
      'Job is not open for accepting proposals.',
      null::integer,
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.contract_status,
      null::date,
      null::date,
      null::public.job_status;
    return;
  end if;

  if exists(
    select 1
    from public.contract as c
    where c.job_id = v_job.id
  ) then
    return query
    select
      false,
      409,
      'contract_exists',
      'A contract already exists for this job.',
      null::integer,
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.contract_status,
      null::date,
      null::date,
      null::public.job_status;
    return;
  end if;

  update public.proposal as p
  set status = 'accepted'::public.proposal_status
  where p.id = v_proposal.id
    and p.status = 'pending'::public.proposal_status
  returning p.id
  into v_proposal.id;

  if v_proposal.id is null then
    return query
    select
      false,
      409,
      'proposal_not_pending',
      'Proposal is no longer pending.',
      null::integer,
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.contract_status,
      null::date,
      null::date,
      null::public.job_status;
    return;
  end if;

  v_end_date := v_start_date + p_duration_days;

  insert into public.contract (
    proposal_id,
    job_id,
    freelancer_id,
    total_price,
    status,
    start_date,
    end_date
  )
  values (
    p_proposal_id,
    v_job.id,
    v_proposal.freelancer_id,
    v_proposal.bid_amount,
    'active'::public.contract_status,
    v_start_date,
    v_end_date
  )
  returning *
  into v_contract;

  update public.proposal as p
  set status = 'rejected'::public.proposal_status
  where p.job_id = v_job.id
    and p.id <> p_proposal_id
    and p.status = 'pending'::public.proposal_status;

  update public.job as j
  set status = 'in_progress'::public.job_status
  where j.id = v_job.id
    and j.status = 'open'::public.job_status
  returning j.status
  into v_job_status;

  return query
  select
    true,
    200,
    'contract_created',
    'Proposal accepted.',
    v_contract.id,
    v_contract.proposal_id,
    v_contract.job_id,
    v_contract.freelancer_id,
    v_contract.total_price,
    v_contract.status,
    v_contract.start_date,
    v_contract.end_date,
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
      null::public.contract_status,
      null::date,
      null::date,
      null::public.job_status;
end;
$$;

create or replace function public.rpc_contracts_set_status(
  p_user_id integer,
  p_contract_id integer,
  p_next_status public.contract_status
)
returns table (
  ok boolean,
  status_code integer,
  result_code text,
  message text,
  id integer,
  status public.contract_status,
  job_id integer,
  job_status public.job_status
)
language plpgsql
as $$
declare
  v_contract public.contract%rowtype;
  v_job public.job%rowtype;
  v_updated_contract public.contract%rowtype;
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
      null::public.contract_status,
      null::integer,
      null::public.job_status;
    return;
  end if;

  if p_next_status <> 'terminated'::public.contract_status then
    return query
    select
      false,
      400,
      'invalid_status_transition',
      'Only terminated transition is supported by this RPC.',
      null::integer,
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
      null::public.contract_status,
      null::integer,
      null::public.job_status;
    return;
  end if;

  select j.*
  into v_job
  from public.job as j
  where j.id = v_contract.job_id
  for update;

  if not found or v_job.client_id is null then
    return query
    select
      false,
      404,
      'job_not_found',
      'Job not found.',
      null::integer,
      null::public.contract_status,
      null::integer,
      null::public.job_status;
    return;
  end if;

  if p_user_id <> v_contract.freelancer_id and p_user_id <> v_job.client_id then
    return query
    select
      false,
      403,
      'forbidden',
      'Forbidden',
      null::integer,
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
      'Only active contracts can be terminated.',
      null::integer,
      null::public.contract_status,
      v_contract.job_id,
      v_job.status;
    return;
  end if;

  update public.contract as c
  set status = p_next_status
  where c.id = p_contract_id
    and c.status = 'active'::public.contract_status
  returning c.*
  into v_updated_contract;

  if v_updated_contract.id is null then
    return query
    select
      false,
      409,
      'contract_not_active',
      'Contract is no longer active.',
      null::integer,
      null::public.contract_status,
      v_contract.job_id,
      v_job.status;
    return;
  end if;

  update public.job as j
  set status = 'cancelled'::public.job_status
  where j.id = v_contract.job_id
    and j.status = 'in_progress'::public.job_status
  returning j.status
  into v_job_status;

  return query
  select
    true,
    200,
    'contract_terminated',
    'Contract terminated.',
    v_updated_contract.id,
    v_updated_contract.status,
    v_updated_contract.job_id,
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
      null::public.contract_status,
      null::integer,
      null::public.job_status;
end;
$$;

create or replace function public.rpc_contracts_list_for_user(
  p_user_id integer,
  p_view text default 'client',
  p_status public.contract_status default null
)
returns table (
  id integer,
  proposal_id integer,
  job_id integer,
  freelancer_id integer,
  client_id integer,
  total_price numeric,
  status public.contract_status,
  start_date date,
  end_date date,
  job_title text,
  freelancer_name text,
  client_name text,
  freelancer_avatar_url text,
  client_avatar_url text,
  transaction_status public.transactions_status,
  counterparty_user_id integer,
  my_reviewed boolean,
  review_count bigint
)
language plpgsql
stable
as $$
declare
  v_view text := coalesce(p_view, 'client');
begin
  perform public.rpc_auth_require_user(p_user_id);

  if v_view not in ('client', 'freelancer') then
    raise exception 'Invalid contract view.'
      using errcode = '22023';
  end if;

  if v_view = 'freelancer' and not public.rpc_auth_is_freelancer(p_user_id) then
    raise exception 'Only freelancers can access freelancer contracts.'
      using errcode = '42501';
  end if;

  if v_view = 'freelancer' then
    return query
    select
      c.id,
      c.proposal_id,
      c.job_id,
      c.freelancer_id,
      j.client_id,
      c.total_price,
      c.status,
      c.start_date::date,
      c.end_date::date,
      j.title::text as job_title,
      null::text as freelancer_name,
      concat_ws(' ', cp.first_name, cp.last_name)::text as client_name,
      null::text as freelancer_avatar_url,
      cp.avatar_url::text as client_avatar_url,
      lt.status as transaction_status,
      j.client_id as counterparty_user_id,
      exists(
        select 1
        from public.review as rv
        where rv.contract_id = c.id
          and rv.reviewer_id = p_user_id
      ) as my_reviewed,
      (
        select count(*)
        from public.review as rv
        where rv.contract_id = c.id
      ) as review_count
    from public.contract as c
    inner join public.job as j
      on j.id = c.job_id
    left join public.profile as cp
      on cp.user_id = j.client_id
    left join lateral (
      select t.status
      from public.transactions as t
      where t.contract_id = c.id
      order by t.created_at desc
      limit 1
    ) as lt on true
    where c.freelancer_id = p_user_id
      and (p_status is null or c.status = p_status)
    order by c.start_date desc;
  else
    return query
    select
      c.id,
      c.proposal_id,
      c.job_id,
      c.freelancer_id,
      j.client_id,
      c.total_price,
      c.status,
      c.start_date::date,
      c.end_date::date,
      j.title::text as job_title,
      concat_ws(' ', fp.first_name, fp.last_name)::text as freelancer_name,
      null::text as client_name,
      fp.avatar_url::text as freelancer_avatar_url,
      null::text as client_avatar_url,
      lt.status as transaction_status,
      c.freelancer_id as counterparty_user_id,
      exists(
        select 1
        from public.review as rv
        where rv.contract_id = c.id
          and rv.reviewer_id = p_user_id
      ) as my_reviewed,
      (
        select count(*)
        from public.review as rv
        where rv.contract_id = c.id
      ) as review_count
    from public.contract as c
    inner join public.job as j
      on j.id = c.job_id
    left join public.profile as fp
      on fp.user_id = c.freelancer_id
    left join lateral (
      select t.status
      from public.transactions as t
      where t.contract_id = c.id
      order by t.created_at desc
      limit 1
    ) as lt on true
    where j.client_id = p_user_id
      and (p_status is null or c.status = p_status)
    order by c.start_date desc;
  end if;
end;
$$;
