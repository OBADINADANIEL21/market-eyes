create table if not exists public.prices (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  country text not null default 'Nigeria',
  city text not null,
  market text not null,
  unit text,
  price numeric(12, 2) not null check (price > 0),
  currency text not null default 'NGN',
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  country text not null check (length(trim(country)) > 0),
  city text not null check (length(trim(city)) > 0),
  market text not null check (length(trim(market)) > 0),
  item text not null check (length(trim(item)) > 0),
  unit text not null check (length(trim(unit)) > 0),
  currency text not null check (length(trim(currency)) > 0),
  price numeric(12, 2) not null check (price > 0),
  created_at timestamptz not null default now()
);

alter table public.prices
  add column if not exists item text,
  add column if not exists country text default 'Nigeria',
  add column if not exists city text,
  add column if not exists market text,
  add column if not exists unit text,
  add column if not exists price numeric(12, 2),
  add column if not exists currency text default 'NGN',
  add column if not exists created_at timestamptz default now();

alter table public.reports
  add column if not exists name text,
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists market text,
  add column if not exists item text,
  add column if not exists unit text,
  add column if not exists currency text,
  add column if not exists price numeric(12, 2),
  add column if not exists created_at timestamptz default now();

alter table public.prices enable row level security;
alter table public.reports enable row level security;

drop policy if exists "Public can read prices" on public.prices;
create policy "Public can read prices"
  on public.prices for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can submit reports" on public.reports;
create policy "Public can submit reports"
  on public.reports for insert
  to anon, authenticated
  with check (
    length(trim(name)) > 0
    and length(trim(country)) > 0
    and length(trim(city)) > 0
    and length(trim(market)) > 0
    and length(trim(item)) > 0
    and length(trim(unit)) > 0
    and length(trim(currency)) > 0
    and price > 0
  );

grant select on public.prices to anon, authenticated;
revoke all on public.reports from anon, authenticated;
grant insert on public.reports to anon, authenticated;

notify pgrst, 'reload schema';
