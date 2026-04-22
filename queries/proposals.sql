-- Canonical RPC SQL for proposal submission and lifecycle transitions.
-- Naming convention: rpc_<domain>_<action>.

create or replace function public.rpc_proposals_create(
  p_user_id integer,
  p_job_id integer,
  p_bid_amount numeric
)
returns table (
  ok boolean,
  status_code integer,
  result_code text,
  message text,
  id integer,
  job_id integer,
  freelancer_id integer,
  bid_amount numeric,
  status public.proposal_status,
  created_at timestamptz
)
language plpgsql
as $$
declare
  v_job public.job%rowtype;
  v_proposal public.proposal%rowtype;
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
      null::numeric,
      null::public.proposal_status,
      null::timestamptz;
    return;
  end if;

  if not public.rpc_auth_is_freelancer(p_user_id) then
    return query
    select
      false,
      403,
      'forbidden',
      'Only freelancers can submit proposals.',
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.proposal_status,
      null::timestamptz;
    return;
  end if;

  if p_bid_amount is null or p_bid_amount <= 0 then
    return query
    select
      false,
      400,
      'invalid_bid_amount',
      'Bid amount must be greater than zero.',
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.proposal_status,
      null::timestamptz;
    return;
  end if;

  select j.*
  into v_job
  from public.job as j
  where j.id = p_job_id
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
      null::numeric,
      null::public.proposal_status,
      null::timestamptz;
    return;
  end if;

  if v_job.client_id = p_user_id then
    return query
    select
      false,
      403,
      'cannot_bid_own_job',
      'You cannot bid on your own job.',
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.proposal_status,
      null::timestamptz;
    return;
  end if;

  if v_job.status <> 'open'::public.job_status then
    return query
    select
      false,
      409,
      'job_not_open',
      'This job is not open for bidding.',
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.proposal_status,
      null::timestamptz;
    return;
  end if;

  insert into public.proposal (job_id, freelancer_id, bid_amount, status)
  values (p_job_id, p_user_id, p_bid_amount, 'pending'::public.proposal_status)
  on conflict (job_id, freelancer_id) do nothing
  returning *
  into v_proposal;

  if v_proposal.id is null then
    return query
    select
      false,
      409,
      'duplicate_proposal',
      'You have already submitted a proposal for this job.',
      null::integer,
      null::integer,
      null::integer,
      null::numeric,
      null::public.proposal_status,
      null::timestamptz;
    return;
  end if;

  return query
  select
    true,
    201,
    'proposal_created',
    'Proposal created.',
    v_proposal.id,
    v_proposal.job_id,
    v_proposal.freelancer_id,
    v_proposal.bid_amount,
    v_proposal.status,
    v_proposal.created_at;
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
      null::numeric,
      null::public.proposal_status,
      null::timestamptz;
end;
$$;

create or replace function public.rpc_proposals_list_for_job_owner(
  p_user_id integer,
  p_job_id integer
)
returns table (
  id integer,
  job_id integer,
  freelancer_id integer,
  bid_amount numeric,
  status public.proposal_status,
  created_at timestamptz,
  freelancer_name text,
  freelancer_avatar_url text
)
language plpgsql
stable
as $$
declare
  v_job public.job%rowtype;
begin
  perform public.rpc_auth_require_user(p_user_id);

  select j.*
  into v_job
  from public.job as j
  where j.id = p_job_id;

  if not found then
    raise exception 'Job not found.'
      using errcode = 'P0002';
  end if;

  if v_job.client_id <> p_user_id then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.job_id,
    p.freelancer_id,
    p.bid_amount,
    p.status,
    p.created_at,
    concat_ws(' ', pr.first_name, pr.last_name) as freelancer_name,
    pr.avatar_url as freelancer_avatar_url
  from public.proposal as p
  left join public.profile as pr
    on pr.user_id = p.freelancer_id
  where p.job_id = p_job_id
  order by p.created_at asc;
end;
$$;

create or replace function public.rpc_proposals_get_job_owner_view(
  p_user_id integer,
  p_job_id integer
)
returns table (
  job jsonb,
  proposals jsonb
)
language plpgsql
stable
as $$
declare
  v_job public.job%rowtype;
begin
  perform public.rpc_auth_require_user(p_user_id);

  select j.*
  into v_job
  from public.job as j
  where j.id = p_job_id;

  if not found then
    raise exception 'Job not found.'
      using errcode = 'P0002';
  end if;

  if v_job.client_id <> p_user_id then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  return query
  select
    jsonb_build_object(
      'id', j.id,
      'client_id', j.client_id,
      'category_id', j.category_id,
      'title', j.title,
      'description', j.description,
      'budget', j.budget,
      'status', j.status,
      'created_at', j.created_at,
      'client_name', concat_ws(' ', cp.first_name, cp.last_name),
      'client_avatar_url', cp.avatar_url
    ) as job,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'id', p.id,
                   'job_id', p.job_id,
                   'freelancer_id', p.freelancer_id,
                   'bid_amount', p.bid_amount,
                   'status', p.status,
                   'created_at', p.created_at,
                   'freelancer_name', concat_ws(' ', fp.first_name, fp.last_name),
                   'freelancer_avatar_url', fp.avatar_url
                 )
                 order by p.created_at asc
               )
        from public.proposal as p
        left join public.profile as fp
          on fp.user_id = p.freelancer_id
        where p.job_id = j.id
      ),
      '[]'::jsonb
    ) as proposals
  from public.job as j
  left join public.profile as cp
    on cp.user_id = j.client_id
  where j.id = p_job_id;
end;
$$;

create or replace function public.rpc_proposals_set_status(
  p_user_id integer,
  p_proposal_id integer,
  p_next_status public.proposal_status
)
returns table (
  ok boolean,
  status_code integer,
  result_code text,
  message text,
  id integer,
  status public.proposal_status,
  job_id integer
)
language plpgsql
as $$
declare
  v_proposal public.proposal%rowtype;
  v_job public.job%rowtype;
  v_pending_message text;
  v_success_message text;
  v_success_code text;
  v_updated public.proposal%rowtype;
begin
  if p_user_id is null or p_user_id <= 0 or not public.rpc_auth_user_exists(p_user_id) then
    return query
    select
      false,
      401,
      'unauthorized',
      'Unauthorized',
      null::integer,
      null::public.proposal_status,
      null::integer;
    return;
  end if;

  if p_next_status = 'withdrawn'::public.proposal_status then
    v_pending_message := 'Only pending proposals can be withdrawn.';
    v_success_message := 'Proposal withdrawn.';
    v_success_code := 'proposal_withdrawn';
  elsif p_next_status = 'rejected'::public.proposal_status then
    v_pending_message := 'Only pending proposals can be declined.';
    v_success_message := 'Proposal declined.';
    v_success_code := 'proposal_declined';
  else
    return query
    select
      false,
      400,
      'invalid_status_transition',
      'Only rejected or withdrawn transitions are allowed in this RPC.',
      null::integer,
      null::public.proposal_status,
      null::integer;
    return;
  end if;

  select p.*
  into v_proposal
  from public.proposal as p
  where p.id = p_proposal_id
  for update;

  if not found then
    return query
    select
      false,
      404,
      'proposal_not_found',
      'Proposal not found.',
      null::integer,
      null::public.proposal_status,
      null::integer;
    return;
  end if;

  if p_next_status = 'withdrawn'::public.proposal_status and v_proposal.freelancer_id is null then
    return query
    select
      false,
      404,
      'proposal_not_found',
      'Proposal not found.',
      null::integer,
      null::public.proposal_status,
      null::integer;
    return;
  end if;

  if p_next_status = 'rejected'::public.proposal_status and v_proposal.job_id is null then
    return query
    select
      false,
      404,
      'proposal_not_found',
      'Proposal not found.',
      null::integer,
      null::public.proposal_status,
      null::integer;
    return;
  end if;

  if p_next_status = 'withdrawn'::public.proposal_status then
    if v_proposal.freelancer_id <> p_user_id then
      return query
      select
        false,
        403,
        'forbidden',
        'Forbidden',
        null::integer,
        null::public.proposal_status,
        null::integer;
      return;
    end if;
  else
    select j.*
    into v_job
    from public.job as j
    where j.id = v_proposal.job_id;

    if not found then
      return query
      select
        false,
        404,
        'job_not_found',
        'Job not found.',
        null::integer,
        null::public.proposal_status,
        null::integer;
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
        null::public.proposal_status,
        null::integer;
      return;
    end if;
  end if;

  if v_proposal.status <> 'pending'::public.proposal_status then
    return query
    select
      false,
      409,
      'proposal_not_pending',
      v_pending_message,
      null::integer,
      null::public.proposal_status,
      v_proposal.job_id;
    return;
  end if;

  update public.proposal as p
  set status = p_next_status
  where p.id = p_proposal_id
    and p.status = 'pending'::public.proposal_status
  returning p.*
  into v_updated;

  if v_updated.id is null then
    return query
    select
      false,
      409,
      'proposal_not_pending',
      v_pending_message,
      null::integer,
      null::public.proposal_status,
      v_proposal.job_id;
    return;
  end if;

  return query
  select
    true,
    200,
    v_success_code,
    v_success_message,
    v_updated.id,
    v_updated.status,
    v_updated.job_id;
exception
  when others then
    return query
    select
      false,
      500,
      'internal_error',
      sqlerrm,
      null::integer,
      null::public.proposal_status,
      null::integer;
end;
$$;
