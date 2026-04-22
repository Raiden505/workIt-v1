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
