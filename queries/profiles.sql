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
