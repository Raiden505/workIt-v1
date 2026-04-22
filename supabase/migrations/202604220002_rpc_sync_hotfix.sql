-- RPC sync hotfix migration: re-apply canonical query functions.

-- Source: queries/auth.sql
-- Canonical RPC SQL for authentication and shared auth helpers.
-- Naming convention: rpc_<domain>_<action>.

create or replace function public.rpc_auth_user_exists(p_user_id integer)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.users as u
    where u.id = p_user_id
  );
$$;

create or replace function public.rpc_auth_require_user(p_user_id integer)
returns void
language plpgsql
as $$
begin
  if p_user_id is null or p_user_id <= 0 then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if not public.rpc_auth_user_exists(p_user_id) then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.rpc_auth_is_client(p_user_id integer)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.client as c
    where c.user_id = p_user_id
  );
$$;

create or replace function public.rpc_auth_is_freelancer(p_user_id integer)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.freelancer as f
    where f.user_id = p_user_id
  );
$$;

create or replace function public.rpc_auth_sign_up(
  p_email text,
  p_password text,
  p_first_name text,
  p_last_name text default null
)
returns table (user_id integer)
language plpgsql
as $$
declare
  v_user_id integer;
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_first_name text := nullif(btrim(coalesce(p_first_name, '')), '');
  v_last_name text := nullif(btrim(coalesce(p_last_name, '')), '');
begin
  if v_email is null then
    raise exception 'Email is required.'
      using errcode = '22023';
  end if;

  if p_password is null or p_password = '' then
    raise exception 'Password is required.'
      using errcode = '22023';
  end if;

  if v_first_name is null then
    raise exception 'First name is required.'
      using errcode = '22023';
  end if;

  with inserted_user as (
    insert into public.users (email, password)
    values (v_email, p_password)
    on conflict (email) do nothing
    returning id
  ),
  inserted_profile as (
    insert into public.profile (user_id, first_name, last_name)
    select iu.id, v_first_name, v_last_name
    from inserted_user as iu
    returning user_id
  )
  select ip.user_id
  into v_user_id
  from inserted_profile as ip;

  if v_user_id is null then
    raise exception 'Email is already registered.'
      using errcode = '23505';
  end if;

  return query
  select v_user_id;
end;
$$;

create or replace function public.rpc_auth_login(
  p_email text,
  p_password text
)
returns table (user_id integer)
language sql
stable
as $$
  select u.id as user_id
  from public.users as u
  where u.email = nullif(btrim(coalesce(p_email, '')), '')
    and u.password = p_password
  order by u.id asc
  limit 1;
$$;

-- Source: queries/categories.sql
-- Canonical RPC SQL for category catalog read models.
-- Naming convention: rpc_<domain>_<action>.

create or replace function public.rpc_categories_list(p_user_id integer)
returns table (
  id integer,
  name text
)
language plpgsql
stable
as $$
begin
  perform public.rpc_auth_require_user(p_user_id);

  return query
  select c.id, c.name::text
  from public.category as c
  order by c.name asc;
end;
$$;

-- Source: queries/contracts.sql
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

-- Source: queries/jobs.sql
-- Canonical RPC SQL for jobs and job-skill mappings.
-- Naming convention: rpc_<domain>_<action>.

create or replace function public.rpc_jobs_create(
  p_user_id integer,
  p_category_id integer,
  p_title text,
  p_description text,
  p_budget numeric,
  p_skill_ids integer[]
)
returns table (
  id integer,
  client_id integer,
  category_id integer,
  title text,
  description text,
  budget numeric,
  status public.job_status,
  created_at timestamptz
)
language plpgsql
as $$
declare
  v_skill_ids integer[];
  v_existing_skill_count integer;
begin
  perform public.rpc_auth_require_user(p_user_id);

  if not public.rpc_auth_is_client(p_user_id) then
    raise exception 'Only clients can post jobs.'
      using errcode = '42501';
  end if;

  if p_budget <= 0 then
    raise exception 'Budget must be greater than zero.'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct skill_id), '{}'::integer[])
  into v_skill_ids
  from unnest(coalesce(p_skill_ids, '{}'::integer[])) as skill_id;

  if cardinality(v_skill_ids) = 0 then
    raise exception 'At least one skill is required.'
      using errcode = '22023';
  end if;

  select count(*)
  into v_existing_skill_count
  from public.skill as s
  where s.id = any(v_skill_ids);

  if v_existing_skill_count <> cardinality(v_skill_ids) then
    raise exception 'One or more selected skills are invalid.'
      using errcode = '22023';
  end if;

  return query
  with inserted_job as (
    insert into public.job (client_id, category_id, title, description, budget, status)
    values (
      p_user_id,
      p_category_id,
      btrim(p_title),
      btrim(p_description),
      p_budget,
      'open'::public.job_status
    )
    returning *
  ),
  inserted_skills as (
    insert into public.job_skill (job_id, skill_id)
    select ij.id, skill_id
    from inserted_job as ij
    cross join unnest(v_skill_ids) as skill_id
  )
  select
    ij.id,
    ij.client_id,
    ij.category_id,
    ij.title::text,
    ij.description::text,
    ij.budget,
    ij.status,
    ij.created_at
  from inserted_job as ij;
end;
$$;

create or replace function public.rpc_jobs_list(
  p_user_id integer,
  p_client_id integer default null,
  p_status public.job_status default null
)
returns table (
  id integer,
  client_id integer,
  category_id integer,
  title text,
  description text,
  budget numeric,
  status public.job_status,
  created_at timestamptz,
  category_name text,
  client_name text,
  client_avatar_url text,
  skills jsonb
)
language plpgsql
stable
as $$
begin
  perform public.rpc_auth_require_user(p_user_id);

  return query
  with filtered_jobs as (
    select j.*
    from public.job as j
    where (
      case
        when p_client_id is not null then j.client_id = p_client_id
        when p_status is null then j.client_id = p_user_id
        else true
      end
    )
    and (p_status is null or j.status = p_status)
  )
  select
    j.id,
    j.client_id,
    j.category_id,
    j.title::text,
    j.description::text,
    j.budget,
    j.status,
    j.created_at,
    c.name::text as category_name,
    concat_ws(' ', p.first_name, p.last_name)::text as client_name,
    p.avatar_url::text as client_avatar_url,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object('id', s.id, 'name', s.name)
                 order by s.name asc
               )
        from public.job_skill as js
        inner join public.skill as s
          on s.id = js.skill_id
        where js.job_id = j.id
      ),
      '[]'::jsonb
    ) as skills
  from filtered_jobs as j
  left join public.category as c
    on c.id = j.category_id
  left join public.profile as p
    on p.user_id = j.client_id
  order by j.created_at desc;
end;
$$;

create or replace function public.rpc_jobs_get_detail(
  p_user_id integer,
  p_job_id integer
)
returns table (
  id integer,
  client_id integer,
  category_id integer,
  title text,
  description text,
  budget numeric,
  status public.job_status,
  created_at timestamptz,
  category_name text,
  client_name text,
  client_avatar_url text,
  skills jsonb
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

  if v_job.client_id <> p_user_id and not public.rpc_auth_is_freelancer(p_user_id) then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  return query
  select
    j.id,
    j.client_id,
    j.category_id,
    j.title::text,
    j.description::text,
    j.budget,
    j.status,
    j.created_at,
    c.name::text as category_name,
    concat_ws(' ', p.first_name, p.last_name)::text as client_name,
    p.avatar_url::text as client_avatar_url,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object('id', s.id, 'name', s.name)
                 order by s.name asc
               )
        from public.job_skill as js
        inner join public.skill as s
          on s.id = js.skill_id
        where js.job_id = j.id
      ),
      '[]'::jsonb
    ) as skills
  from public.job as j
  left join public.category as c
    on c.id = j.category_id
  left join public.profile as p
    on p.user_id = j.client_id
  where j.id = p_job_id;
end;
$$;

create or replace function public.rpc_jobs_delete_open(
  p_user_id integer,
  p_job_id integer
)
returns table (
  ok boolean,
  status_code integer,
  result_code text,
  message text,
  deleted boolean,
  job_id integer
)
language plpgsql
as $$
declare
  v_job public.job%rowtype;
begin
  if p_user_id is null or p_user_id <= 0 or not public.rpc_auth_user_exists(p_user_id) then
    return query
    select false, 401, 'unauthorized', 'Unauthorized', false, null::integer;
    return;
  end if;

  select j.*
  into v_job
  from public.job as j
  where j.id = p_job_id
  for update;

  if not found then
    return query
    select false, 404, 'job_not_found', 'Job not found.', false, null::integer;
    return;
  end if;

  if v_job.client_id <> p_user_id then
    return query
    select false, 403, 'forbidden', 'Forbidden', false, v_job.id;
    return;
  end if;

  if v_job.status <> 'open'::public.job_status then
    return query
    select false, 409, 'job_not_open', 'Only open jobs can be deleted.', false, v_job.id;
    return;
  end if;

  if exists(
    select 1
    from public.contract as c
    where c.job_id = p_job_id
  ) then
    return query
    select false, 409, 'job_has_contract', 'Cannot delete a job that already has a contract.', false, v_job.id;
    return;
  end if;

  delete from public.job_skill as js
  where js.job_id = p_job_id;

  delete from public.proposal as p
  where p.job_id = p_job_id;

  delete from public.job as j
  where j.id = p_job_id;

  return query
  select true, 200, 'job_deleted', 'Job deleted successfully.', true, p_job_id;
exception
  when others then
    return query
    select false, 500, 'internal_error', sqlerrm, false, null::integer;
end;
$$;

-- Source: queries/profiles.sql
-- Canonical RPC SQL for profile reads and profile updates.
-- Naming convention: rpc_<domain>_<action>.

create or replace function public.rpc_profiles_get_me(p_user_id integer)
returns jsonb
language plpgsql
stable
as $$
declare
  v_payload jsonb;
begin
  perform public.rpc_auth_require_user(p_user_id);

  select jsonb_build_object(
           'user', jsonb_build_object('id', u.id, 'email', u.email),
           'profile', to_jsonb(p),
           'client', (
             select to_jsonb(c)
             from public.client as c
             where c.user_id = u.id
           ),
           'freelancer', (
             select to_jsonb(f)
             from public.freelancer as f
             where f.user_id = u.id
           )
         )
  into v_payload
  from public.users as u
  inner join public.profile as p
    on p.user_id = u.id
  where u.id = p_user_id;

  if v_payload is null then
    raise exception 'Profile not found.'
      using errcode = 'P0002';
  end if;

  return v_payload;
end;
$$;

create or replace function public.rpc_profiles_update_me(
  p_user_id integer,
  p_set_bio boolean default false,
  p_bio text default null,
  p_set_avatar_url boolean default false,
  p_avatar_url text default null,
  p_set_company_name boolean default false,
  p_company_name text default null,
  p_set_hourly_rate boolean default false,
  p_hourly_rate numeric default null,
  p_set_portfolio_url boolean default false,
  p_portfolio_url text default null
)
returns table (
  ok boolean,
  status_code integer,
  result_code text,
  message text,
  payload jsonb
)
language plpgsql
as $$
declare
  v_payload jsonb;
begin
  if p_user_id is null or p_user_id <= 0 or not public.rpc_auth_user_exists(p_user_id) then
    return query
    select false, 401, 'unauthorized', 'Unauthorized', null::jsonb;
    return;
  end if;

  if not (
    coalesce(p_set_bio, false)
    or coalesce(p_set_avatar_url, false)
    or coalesce(p_set_company_name, false)
    or coalesce(p_set_hourly_rate, false)
    or coalesce(p_set_portfolio_url, false)
  ) then
    return query
    select false, 400, 'no_profile_updates', 'Provide at least one field to update.', null::jsonb;
    return;
  end if;

  if not exists(
    select 1
    from public.profile as p
    where p.user_id = p_user_id
  ) then
    return query
    select false, 404, 'profile_not_found', 'Profile not found.', null::jsonb;
    return;
  end if;

  if coalesce(p_set_company_name, false) and not public.rpc_auth_is_client(p_user_id) then
    return query
    select false, 403, 'forbidden', 'Only clients can update company details.', null::jsonb;
    return;
  end if;

  if (coalesce(p_set_hourly_rate, false) or coalesce(p_set_portfolio_url, false))
    and not public.rpc_auth_is_freelancer(p_user_id) then
    return query
    select false, 403, 'forbidden', 'Only freelancers can update freelancer details.', null::jsonb;
    return;
  end if;

  if coalesce(p_set_hourly_rate, false) and (p_hourly_rate is null or p_hourly_rate < 0) then
    return query
    select false, 400, 'invalid_hourly_rate', 'Hourly rate cannot be negative.', null::jsonb;
    return;
  end if;

  if coalesce(p_set_bio, false) or coalesce(p_set_avatar_url, false) then
    update public.profile as p
    set bio = case when coalesce(p_set_bio, false) then p_bio else p.bio end,
        avatar_url = case
          when coalesce(p_set_avatar_url, false) then nullif(btrim(coalesce(p_avatar_url, '')), '')
          else p.avatar_url
        end
    where p.user_id = p_user_id;
  end if;

  if coalesce(p_set_company_name, false) then
    update public.client as c
    set company_name = nullif(btrim(coalesce(p_company_name, '')), '')
    where c.user_id = p_user_id;
  end if;

  if coalesce(p_set_hourly_rate, false) or coalesce(p_set_portfolio_url, false) then
    update public.freelancer as f
    set hourly_rate = case when coalesce(p_set_hourly_rate, false) then p_hourly_rate else f.hourly_rate end,
        portfolio_url = case
          when coalesce(p_set_portfolio_url, false) then nullif(btrim(coalesce(p_portfolio_url, '')), '')
          else f.portfolio_url
        end
    where f.user_id = p_user_id;
  end if;

  select jsonb_build_object(
           'user', jsonb_build_object('id', u.id, 'email', u.email),
           'profile', to_jsonb(p),
           'client', (
             select to_jsonb(c)
             from public.client as c
             where c.user_id = u.id
           ),
           'freelancer', (
             select to_jsonb(f)
             from public.freelancer as f
             where f.user_id = u.id
           )
         )
  into v_payload
  from public.users as u
  inner join public.profile as p
    on p.user_id = u.id
  where u.id = p_user_id;

  if v_payload is null then
    return query
    select false, 404, 'profile_not_found', 'Profile not found.', null::jsonb;
    return;
  end if;

  return query
  select true, 200, 'profile_updated', 'Profile updated.', v_payload;
exception
  when others then
    return query
    select false, 500, 'internal_error', sqlerrm, null::jsonb;
end;
$$;

create or replace function public.rpc_profiles_update_core(
  p_user_id integer,
  p_bio text,
  p_avatar_url text
)
returns jsonb
language plpgsql
as $$
declare
  v_payload jsonb;
begin
  perform public.rpc_auth_require_user(p_user_id);

  update public.profile as p
  set bio = p_bio,
      avatar_url = nullif(btrim(coalesce(p_avatar_url, '')), '')
  where p.user_id = p_user_id
  returning to_jsonb(p.*) into v_payload;

  if v_payload is null then
    raise exception 'Profile not found.'
      using errcode = 'P0002';
  end if;

  return v_payload;
end;
$$;

create or replace function public.rpc_profiles_update_client_company(
  p_user_id integer,
  p_company_name text
)
returns jsonb
language plpgsql
as $$
declare
  v_payload jsonb;
begin
  perform public.rpc_auth_require_user(p_user_id);

  if not public.rpc_auth_is_client(p_user_id) then
    raise exception 'Only clients can update company details.'
      using errcode = '42501';
  end if;

  update public.client as c
  set company_name = nullif(btrim(coalesce(p_company_name, '')), '')
  where c.user_id = p_user_id
  returning to_jsonb(c.*) into v_payload;

  if v_payload is null then
    raise exception 'Client profile not found.'
      using errcode = 'P0002';
  end if;

  return v_payload;
end;
$$;

create or replace function public.rpc_profiles_update_freelancer_details(
  p_user_id integer,
  p_hourly_rate numeric,
  p_portfolio_url text
)
returns jsonb
language plpgsql
as $$
declare
  v_payload jsonb;
begin
  perform public.rpc_auth_require_user(p_user_id);

  if not public.rpc_auth_is_freelancer(p_user_id) then
    raise exception 'Only freelancers can update freelancer details.'
      using errcode = '42501';
  end if;

  if p_hourly_rate < 0 then
    raise exception 'Hourly rate cannot be negative.'
      using errcode = '22023';
  end if;

  update public.freelancer as f
  set hourly_rate = p_hourly_rate,
      portfolio_url = nullif(btrim(coalesce(p_portfolio_url, '')), '')
  where f.user_id = p_user_id
  returning to_jsonb(f.*) into v_payload;

  if v_payload is null then
    raise exception 'Freelancer profile not found.'
      using errcode = 'P0002';
  end if;

  return v_payload;
end;
$$;

create or replace function public.rpc_profiles_get_public(
  p_requester_user_id integer,
  p_target_user_id integer
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_payload jsonb;
begin
  perform public.rpc_auth_require_user(p_requester_user_id);

  select jsonb_build_object(
           'user_id', p.user_id,
           'first_name', p.first_name,
           'last_name', p.last_name,
           'avatar_url', p.avatar_url,
           'bio', p.bio,
           'client', (
             select to_jsonb(c)
             from public.client as c
             where c.user_id = p.user_id
           ),
           'freelancer', (
             select to_jsonb(f)
             from public.freelancer as f
             where f.user_id = p.user_id
           ),
           'skills', coalesce(
             (
               select jsonb_agg(
                        jsonb_build_object('id', s.id, 'name', s.name)
                        order by s.name asc
                      )
               from public.freelancer_skill as fs
               inner join public.skill as s
                 on s.id = fs.skill_id
               where fs.freelancer_id = p.user_id
             ),
             '[]'::jsonb
           ),
           'reviews', jsonb_build_object(
             'count', (
               select count(*)
               from public.review as r
               where r.reviewee_id = p.user_id
             ),
             'average_rating', (
               select
                 case
                   when count(r.rating) = 0 then null
                   else round(avg(r.rating)::numeric, 2)
                 end
               from public.review as r
               where r.reviewee_id = p.user_id
             ),
             'items', coalesce(
               (
                 select jsonb_agg(
                          jsonb_build_object(
                            'id', r.id,
                            'contract_id', r.contract_id,
                            'reviewer_id', r.reviewer_id,
                            'reviewee_id', r.reviewee_id,
                            'rating', r.rating,
                            'comment', r.comment,
                            'created_at', r.created_at,
                            'reviewer_name', concat_ws(' ', rp.first_name, rp.last_name)
                          )
                          order by r.created_at desc
                        )
                 from public.review as r
                 left join public.profile as rp
                   on rp.user_id = r.reviewer_id
                 where r.reviewee_id = p.user_id
               ),
               '[]'::jsonb
             )
           )
         )
  into v_payload
  from public.profile as p
  where p.user_id = p_target_user_id;

  if v_payload is null then
    raise exception 'Profile not found.'
      using errcode = 'P0002';
  end if;

  return v_payload;
end;
$$;

-- Source: queries/proposals.sql
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

-- Source: queries/reviews.sql
-- Canonical RPC SQL for reviews write/read flows.
-- Naming convention: rpc_<domain>_<action>.

create or replace function public.rpc_reviews_list(
  p_user_id integer,
  p_reviewee_id integer default null,
  p_contract_id integer default null
)
returns table (
  id integer,
  contract_id integer,
  reviewer_id integer,
  reviewee_id integer,
  rating integer,
  comment text,
  created_at timestamptz,
  reviewer_name text
)
language plpgsql
stable
as $$
begin
  perform public.rpc_auth_require_user(p_user_id);

  return query
  select
    r.id,
    r.contract_id,
    r.reviewer_id,
    r.reviewee_id,
    r.rating::integer,
    r.comment,
    r.created_at,
    concat_ws(' ', p.first_name, p.last_name) as reviewer_name
  from public.review as r
  left join public.profile as p
    on p.user_id = r.reviewer_id
  where (p_reviewee_id is null or r.reviewee_id = p_reviewee_id)
    and (p_contract_id is null or r.contract_id = p_contract_id)
  order by r.created_at desc;
end;
$$;

create or replace function public.rpc_reviews_get_summary(
  p_user_id integer,
  p_reviewee_id integer default null,
  p_contract_id integer default null
)
returns table (
  count bigint,
  average_rating numeric
)
language plpgsql
stable
as $$
begin
  perform public.rpc_auth_require_user(p_user_id);

  return query
  select
    count(*)::bigint as count,
    case
      when count(r.rating) = 0 then null
      else round(avg(r.rating)::numeric, 2)
    end as average_rating
  from public.review as r
  where (p_reviewee_id is null or r.reviewee_id = p_reviewee_id)
    and (p_contract_id is null or r.contract_id = p_contract_id);
end;
$$;

create or replace function public.rpc_reviews_create(
  p_user_id integer,
  p_contract_id integer,
  p_reviewee_id integer,
  p_rating integer,
  p_comment text default null
)
returns table (
  id integer,
  contract_id integer,
  reviewer_id integer,
  reviewee_id integer,
  rating integer,
  comment text,
  created_at timestamptz
)
language plpgsql
as $$
declare
  v_contract public.contract%rowtype;
  v_job public.job%rowtype;
  v_expected_reviewee integer;
begin
  perform public.rpc_auth_require_user(p_user_id);

  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5.'
      using errcode = '22023';
  end if;

  select c.*
  into v_contract
  from public.contract as c
  where c.id = p_contract_id
  for update;

  if not found or v_contract.job_id is null or v_contract.freelancer_id is null then
    raise exception 'Contract not found.'
      using errcode = 'P0002';
  end if;

  if v_contract.status <> 'completed'::public.contract_status then
    raise exception 'Reviews can only be submitted for completed contracts.'
      using errcode = '23514';
  end if;

  select j.*
  into v_job
  from public.job as j
  where j.id = v_contract.job_id;

  if not found or v_job.client_id is null then
    raise exception 'Job not found.'
      using errcode = 'P0002';
  end if;

  if p_user_id = v_job.client_id then
    v_expected_reviewee := v_contract.freelancer_id;
  elsif p_user_id = v_contract.freelancer_id then
    v_expected_reviewee := v_job.client_id;
  else
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  if p_reviewee_id <> v_expected_reviewee then
    raise exception 'Invalid reviewee for this contract.'
      using errcode = '22023';
  end if;

  if exists(
    select 1
    from public.review as r
    where r.contract_id = p_contract_id
      and r.reviewer_id = p_user_id
      and r.reviewee_id = p_reviewee_id
  ) then
    raise exception 'You have already reviewed this user for this contract.'
      using errcode = '23505';
  end if;

  return query
  insert into public.review (contract_id, reviewer_id, reviewee_id, rating, comment)
  values (p_contract_id, p_user_id, p_reviewee_id, p_rating, nullif(btrim(coalesce(p_comment, '')), ''))
  returning
    review.id,
    review.contract_id,
    review.reviewer_id,
    review.reviewee_id,
    review.rating::integer,
    review.comment,
    review.created_at;
end;
$$;

-- Source: queries/roles.sql
-- Canonical RPC SQL for role activation and role discovery.
-- Naming convention: rpc_<domain>_<action>.

create or replace function public.rpc_roles_get(p_user_id integer)
returns table (
  client_id integer,
  freelancer_id integer
)
language plpgsql
stable
as $$
begin
  perform public.rpc_auth_require_user(p_user_id);

  return query
  select
    (select c.user_id from public.client as c where c.user_id = p_user_id) as client_id,
    (select f.user_id from public.freelancer as f where f.user_id = p_user_id) as freelancer_id;
end;
$$;

create or replace function public.rpc_roles_activate_client(
  p_user_id integer,
  p_company_name text default null
)
returns table (
  user_id integer,
  company_name text
)
language plpgsql
as $$
declare
  v_company_name text := nullif(btrim(coalesce(p_company_name, '')), '');
begin
  perform public.rpc_auth_require_user(p_user_id);

  insert into public.client (user_id, company_name)
  values (p_user_id, v_company_name)
  on conflict (user_id)
  do nothing;

  return query
  select c.user_id, c.company_name
  from public.client as c
  where c.user_id = p_user_id;
end;
$$;

create or replace function public.rpc_roles_activate_freelancer(
  p_user_id integer,
  p_hourly_rate numeric default 0,
  p_portfolio_url text default null
)
returns table (
  user_id integer,
  hourly_rate numeric,
  portfolio_url text
)
language plpgsql
as $$
declare
  v_hourly_rate numeric := coalesce(p_hourly_rate, 0);
  v_portfolio_url text := nullif(btrim(coalesce(p_portfolio_url, '')), '');
begin
  perform public.rpc_auth_require_user(p_user_id);

  if v_hourly_rate < 0 then
    raise exception 'Hourly rate cannot be negative.'
      using errcode = '22023';
  end if;

  insert into public.freelancer (user_id, hourly_rate, portfolio_url)
  values (p_user_id, v_hourly_rate, v_portfolio_url)
  on conflict (user_id)
  do nothing;

  return query
  select f.user_id, f.hourly_rate, f.portfolio_url
  from public.freelancer as f
  where f.user_id = p_user_id;
end;
$$;

-- Source: queries/skills.sql
-- Canonical RPC SQL for skills catalog and freelancer skill mappings.
-- Naming convention: rpc_<domain>_<action>.

create or replace function public.rpc_skills_list()
returns table (
  id integer,
  name text
)
language sql
stable
as $$
  select s.id, s.name::text
  from public.skill as s
  order by s.name asc;
$$;

create or replace function public.rpc_skills_list_for_user(p_user_id integer)
returns table (
  id integer,
  name text
)
language plpgsql
stable
as $$
begin
  perform public.rpc_auth_require_user(p_user_id);

  return query
  select s.id, s.name::text
  from public.skill as s
  order by s.name asc;
end;
$$;

create or replace function public.rpc_skills_list_for_freelancer(p_freelancer_id integer)
returns table (
  id integer,
  name text
)
language sql
stable
as $$
  select s.id, s.name::text
  from public.freelancer_skill as fs
  inner join public.skill as s
    on s.id = fs.skill_id
  where fs.freelancer_id = p_freelancer_id
  order by s.name asc;
$$;

create or replace function public.rpc_skills_replace_for_freelancer(
  p_user_id integer,
  p_skill_ids integer[]
)
returns table (
  ok boolean,
  status_code integer,
  result_code text,
  message text,
  skill_ids integer[],
  skills jsonb
)
language plpgsql
as $$
declare
  v_skill_ids integer[];
  v_existing_count integer;
  v_result_skill_ids integer[];
  v_skills jsonb;
begin
  if p_user_id is null or p_user_id <= 0 or not public.rpc_auth_user_exists(p_user_id) then
    return query
    select
      false,
      401,
      'unauthorized',
      'Unauthorized',
      null::integer[],
      null::jsonb;
    return;
  end if;

  if not public.rpc_auth_is_freelancer(p_user_id) then
    return query
    select
      false,
      403,
      'forbidden',
      'Only freelancers can manage skills.',
      null::integer[],
      null::jsonb;
    return;
  end if;

  select coalesce(array_agg(distinct skill_id order by skill_id), '{}'::integer[])
  into v_skill_ids
  from unnest(coalesce(p_skill_ids, '{}'::integer[])) as skill_id;

  if cardinality(v_skill_ids) > 0 then
    select count(*)
    into v_existing_count
    from public.skill as s
    where s.id = any(v_skill_ids);

    if v_existing_count <> cardinality(v_skill_ids) then
      return query
      select
        false,
        400,
        'invalid_skills',
        'One or more skills are invalid.',
        null::integer[],
        null::jsonb;
      return;
    end if;
  end if;

  delete from public.freelancer_skill as fs
  where fs.freelancer_id = p_user_id;

  if cardinality(v_skill_ids) > 0 then
    insert into public.freelancer_skill (freelancer_id, skill_id)
    select p_user_id, skill_id
    from unnest(v_skill_ids) as skill_id;
  end if;

  select
    coalesce(array_agg(s.id order by s.name asc), '{}'::integer[]),
    coalesce(
      jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name asc),
      '[]'::jsonb
    )
  into v_result_skill_ids, v_skills
  from public.freelancer_skill as fs
  inner join public.skill as s
    on s.id = fs.skill_id
  where fs.freelancer_id = p_user_id;

  return query
  select
    true,
    200,
    'skills_replaced',
    'Freelancer skills updated.',
    v_result_skill_ids,
    v_skills;
exception
  when others then
    return query
    select
      false,
      500,
      'internal_error',
      sqlerrm,
      null::integer[],
      null::jsonb;
end;
$$;

-- Source: queries/transactions.sql
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

