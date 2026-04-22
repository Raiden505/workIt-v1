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
