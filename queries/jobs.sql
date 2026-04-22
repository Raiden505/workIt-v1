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
