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
