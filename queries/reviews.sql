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
