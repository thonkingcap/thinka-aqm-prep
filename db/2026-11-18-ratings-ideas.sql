-- Nov 18 2026: Dr Phil reply ratings and feature ideas (applied to Supabase project aqm-prep-logs).
-- Additive: old log_event calls keep working because every new parameter has a default.

-- Ratings ride on events: kind 'rate', rating 1 / -1 (0 = taken back), ref = "<chat>:<reply>", detail = reason code.
alter table public.events add column if not exists rating smallint check (rating is null or rating in (-1, 0, 1));
alter table public.events add column if not exists ref text;
alter table public.events add column if not exists detail text;
alter table public.events drop constraint if exists events_kind_check;
alter table public.events add constraint events_kind_check check (kind in ('hello', 'time', 'claude', 'key', 'cost', 'rate'));

drop function if exists public.log_event(uuid, text, text, integer, text, text, text, numeric, integer, integer, text);
create function public.log_event(p_visitor uuid, p_kind text, p_name text default null, p_seconds integer default 0,
  p_feature text default null, p_page text default null, p_key_tag text default null, p_cost numeric default 0,
  p_tokens_in integer default 0, p_tokens_out integer default 0, p_email text default null,
  p_rating integer default null, p_ref text default null, p_detail text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_kind not in ('hello','time','claude','key','cost','rate') then return; end if;
  if p_kind = 'rate' and (p_rating is null or p_rating not in (-1, 0, 1) or p_ref !~ '^[A-Za-z0-9_-]{1,24}:[0-9]{1,4}$') then return; end if;
  insert into public.events (visitor, name, kind, seconds, feature, page, key_tag, cost, tokens_in, tokens_out, email, rating, ref, detail)
  values (
    p_visitor,
    nullif(left(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g'), 60), ''),
    p_kind,
    greatest(0, least(coalesce(p_seconds, 0), 3600)),
    case when p_feature in ('tutor','mark','design','plan','verify') then p_feature end,
    left(p_page, 40),
    case when p_key_tag ~ '^[A-Za-z0-9_-]{1,16}$' then p_key_tag end,
    greatest(0, least(coalesce(p_cost, 0), 5)),
    greatest(0, least(coalesce(p_tokens_in, 0), 2000000)),
    greatest(0, least(coalesce(p_tokens_out, 0), 200000)),
    case when lower(trim(p_email)) ~ '^[a-z0-9._%+-]+@babson\.edu$' then left(lower(trim(p_email)), 120) end,
    case when p_kind = 'rate' then p_rating end,
    case when p_kind = 'rate' then p_ref end,
    case when p_kind = 'rate' and p_detail in ('wrong', 'confusing', 'long', 'off') then p_detail end
  );
end; $$;
revoke all on function public.log_event(uuid, text, text, integer, text, text, text, numeric, integer, integer, text, integer, text, text) from public;
grant execute on function public.log_event(uuid, text, text, integer, text, text, text, numeric, integer, integer, text, integer, text, text) to anon, service_role;

-- Feature ideas: written by students on purpose, so the text is kept (up to 1000 characters).
create table if not exists public.ideas (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  visitor uuid not null,
  name text,
  body text not null check (char_length(body) between 3 and 1000),
  page text,
  source text check (source in ('prompt', 'button'))
);
alter table public.ideas enable row level security; -- no policies: only the functions below touch it

create or replace function public.suggest_idea(p_visitor uuid, p_body text, p_name text default null, p_page text default null, p_source text default null)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare b text := left(trim(regexp_replace(coalesce(p_body, ''), '[\x01-\x09\x0b-\x1f\x7f]', '', 'g')), 1000);
begin
  if p_visitor is null or char_length(b) < 3 then return false; end if;
  if (select count(*) from public.ideas where visitor = p_visitor and at > now() - interval '1 hour') >= 10 then return false; end if;
  insert into public.ideas (visitor, name, body, page, source)
  values (p_visitor, nullif(left(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g'), 60), ''), b, left(p_page, 40),
          case when p_source in ('prompt', 'button') then p_source end);
  return true;
end; $$;
revoke all on function public.suggest_idea(uuid, text, text, text, text) from public;
grant execute on function public.suggest_idea(uuid, text, text, text, text) to anon, service_role;

-- Admin: everything it returned before, plus 'ratings' (latest rating per reply) and 'ideas'.
create or replace function public.admin_stats(p_code text)
returns json language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare h text; fails int; result json;
begin
  select count(*) into fails from public.admin_attempts where at > now() - interval '10 minutes';
  if fails >= 20 then raise exception 'locked' using errcode = 'P0001'; end if;
  select hash into h from public.admin_secret where id = 1;
  if h is null or p_code is null or extensions.crypt(p_code, h) <> h then
    insert into public.admin_attempts default values;
    delete from public.admin_attempts where at < now() - interval '1 day';
    raise exception 'wrong code' using errcode = 'P0001';
  end if;
  with latest as (
    select distinct on (visitor, ref) visitor, ref, rating, detail, at, page
    from public.events where kind = 'rate' order by visitor, ref, at desc, id desc
  ), r as (select * from latest where rating <> 0)
  select json_build_object(
    'generated_at', now(),
    'totals', (select json_build_object(
        'people', count(distinct visitor),
        'named', count(distinct visitor) filter (where name is not null),
        'minutes', round(coalesce(sum(seconds), 0) / 60.0, 1),
        'claude_requests', count(*) filter (where kind = 'claude'),
        'unique_keys', count(distinct key_tag) filter (where key_tag is not null and key_tag not in ('code', 'email', 'shared')),
        'code_users', count(distinct visitor) filter (where key_tag = 'code'),
        'spend', round(coalesce(sum(cost), 0), 4),
        'tokens_in', coalesce(sum(tokens_in), 0),
        'tokens_out', coalesce(sum(tokens_out), 0),
        'spend_since', min(at) filter (where kind = 'cost'),
        'shared_spend', (select round(coalesce(sum(spent), 0), 4) from public.shared_spend),
        'shared_users', (select count(*) from public.shared_spend))
      from public.events),
    'people', (select coalesce(json_agg(p order by p.last_seen desc), '[]'::json) from (
        select e.visitor,
          (array_agg(name order by at desc) filter (where name is not null))[1] as name,
          (array_agg(email order by at desc) filter (where email is not null))[1] as email,
          bool_or(key_tag = 'shared') as used_shared,
          min(at) as first_seen, max(at) as last_seen,
          round(coalesce(sum(seconds), 0) / 60.0, 1) as minutes,
          count(*) filter (where kind = 'claude') as requests,
          round(coalesce(sum(cost), 0), 4) as spend,
          count(distinct key_tag) filter (where key_tag is not null and key_tag not in ('code', 'email', 'shared')) as keys,
          bool_or(key_tag = 'code') as used_code,
          count(distinct date(at at time zone 'America/New_York')) as days,
          (select count(*) from r where r.visitor = e.visitor and r.rating = 1) as up,
          (select count(*) from r where r.visitor = e.visitor and r.rating = -1) as down
        from public.events e group by e.visitor) p),
    'shared', (select coalesce(json_agg(s order by s.spent desc), '[]'::json) from (
        select ss.email,
          case when ss.email like 'v:%' then (select e.name from public.events e where e.visitor::text = substr(ss.email, 3) and e.name is not null order by e.at desc limit 1) end as name,
          round(ss.spent, 4) as spent, ss.requests, ss.first_at, ss.last_at from public.shared_spend ss) s),
    'days', (select coalesce(json_agg(d order by d.day desc), '[]'::json) from (
        select date(at at time zone 'America/New_York') as day,
          count(distinct visitor) as people,
          round(coalesce(sum(seconds), 0) / 60.0, 1) as minutes,
          count(*) filter (where kind = 'claude') as requests,
          round(coalesce(sum(cost), 0), 4) as spend
        from public.events group by 1) d),
    'features', (select coalesce(json_object_agg(f, n), '{}'::json) from (
        select feature as f, count(*) as n from public.events where kind = 'claude' and feature is not null group by feature) x),
    'ratings', (select json_build_object(
        'up', count(*) filter (where rating = 1),
        'down', count(*) filter (where rating = -1),
        'raters', count(distinct visitor),
        'reasons', (select coalesce(json_object_agg(detail, n), '{}'::json) from (select detail, count(*) n from r where rating = -1 and detail is not null group by detail) y),
        'recent_down', (select coalesce(json_agg(z order by z.at desc), '[]'::json) from (
            select r.at, r.detail,
              (select e.name from public.events e where e.visitor = r.visitor and e.name is not null order by e.at desc limit 1) as name
            from r where rating = -1 order by r.at desc limit 50) z))
      from r),
    'ideas', (select coalesce(json_agg(i order by i.at desc), '[]'::json) from (
        select at, name, body, page, source from public.ideas order by at desc limit 300) i)
  ) into result;
  return result;
end; $function$;
