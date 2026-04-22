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
