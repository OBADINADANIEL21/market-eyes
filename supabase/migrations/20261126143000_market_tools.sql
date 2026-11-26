alter table public.profiles
  add column if not exists notify_brief boolean not null default false;

alter table public.markets
  add column if not exists country text not null default 'Nigeria',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

drop policy if exists "Admins manage market coordinates" on public.markets;
create policy "Admins manage market coordinates" on public.markets
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'markets_valid_coordinates'
      and conrelid = 'public.markets'::regclass
  ) then
    alter table public.markets
      add constraint markets_valid_coordinates check (
        (latitude is null and longitude is null)
        or (latitude between -90 and 90 and longitude between -180 and 180)
      ) not valid;
  end if;
end
$$;

create table if not exists public.seasons (
  item text primary key check (length(trim(item)) > 0),
  cheap_months smallint[] not null default '{}',
  costly_months smallint[] not null default '{}',
  notes text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.seasons enable row level security;
drop policy if exists "Public can read seasons" on public.seasons;
create policy "Public can read seasons" on public.seasons
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage seasons" on public.seasons;
create policy "Admins manage seasons" on public.seasons
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.price_votes (
  voter_id uuid not null references auth.users(id) on delete cascade,
  item text not null,
  market text not null,
  price_date date not null,
  price_id bigint not null references public.prices(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (voter_id, item, market, price_date)
);

alter table public.price_votes enable row level security;
drop policy if exists "Users can read their own price votes" on public.price_votes;
create policy "Users can read their own price votes" on public.price_votes
  for select to authenticated using (voter_id = auth.uid());
create or replace function public.cast_price_vote(
  p_price_id bigint,
  p_item text,
  p_market text,
  p_price_date date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to vote'; end if;
  if not exists (
    select 1 from public.prices
    where id = p_price_id
      and item = p_item
      and market = p_market
      and country = 'Nigeria'
      and created_at::date = p_price_date
  ) then
    raise exception 'This price is not part of the selected market debate';
  end if;

  insert into public.price_votes (voter_id, item, market, price_date, price_id)
  values (auth.uid(), p_item, p_market, p_price_date, p_price_id)
  on conflict (voter_id, item, market, price_date)
  do update set price_id = excluded.price_id, created_at = now();
end;
$$;

create or replace view public.price_vote_totals with (security_barrier = true) as
  select price_id, count(*)::integer as vote_count
  from public.price_votes
  group by price_id;

create table if not exists public.price_views (
  price_id bigint not null references public.prices(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  last_viewed_at timestamptz not null default now(),
  primary key (price_id, viewer_id)
);

alter table public.price_views enable row level security;
revoke all on public.price_views from anon, authenticated;

create or replace function public.track_price_view(p_price_id bigint)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in to record price views'; end if;
  if not exists (select 1 from public.prices where id = p_price_id) then
    raise exception 'Price listing not found';
  end if;

  insert into public.price_views (price_id, viewer_id, last_viewed_at)
  values (p_price_id, auth.uid(), now())
  on conflict (price_id, viewer_id) do update set last_viewed_at = excluded.last_viewed_at;

  delete from public.price_views where last_viewed_at < now() - interval '1 day';
  select count(*)::integer into v_count
  from public.price_views
  where price_id = p_price_id and last_viewed_at >= now() - interval '15 minutes';
  return v_count;
end;
$$;

grant select on public.seasons, public.price_vote_totals to anon, authenticated;
grant insert, update, delete on public.seasons to authenticated;
grant select on public.price_votes to authenticated;
grant execute on function public.track_price_view(bigint) to authenticated;
grant execute on function public.cast_price_vote(bigint, text, text, date) to authenticated;
grant select on public.markets to anon, authenticated;
grant insert (name, country, city, latitude, longitude) on public.markets to authenticated;
grant update (latitude, longitude) on public.markets to authenticated;
grant select (notify_brief) on public.profiles to authenticated;
grant update (notify_brief) on public.profiles to authenticated;
revoke all on function public.track_price_view(bigint) from public, anon;
revoke all on function public.cast_price_vote(bigint, text, text, date) from public, anon;
