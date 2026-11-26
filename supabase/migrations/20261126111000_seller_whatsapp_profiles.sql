alter table public.profiles
  add column if not exists store_name text not null default '',
  add column if not exists whatsapp_number text not null default '',
  add column if not exists show_whatsapp boolean not null default true,
  add column if not exists group_link text not null default '';

update public.profiles p
set store_name = coalesce(nullif(trim(p.store_name), ''), nullif(trim(sp.shop_name), ''), p.name)
from public.seller_profiles sp
where sp.id = p.id and p.role = 'seller';

update public.profiles
set store_name = name
where role = 'seller' and nullif(trim(store_name), '') is null;

update public.seller_profiles sp
set shop_name = p.store_name
from public.profiles p
where p.id = sp.id and p.role = 'seller' and nullif(trim(p.store_name), '') is not null;

create or replace function public.create_market_eye_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_name text;
  v_phone text;
  v_market text;
  v_store_name text;
  v_whatsapp_number text;
  v_group_link text;
begin
  v_role := case when new.raw_user_meta_data ->> 'role' = 'seller' then 'seller' else 'buyer' end;
  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1));
  v_phone := coalesce(new.raw_user_meta_data ->> 'phone', '');
  v_market := coalesce(new.raw_user_meta_data ->> 'market', '');
  v_store_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'store_name'), ''), v_name);
  v_whatsapp_number := coalesce(new.raw_user_meta_data ->> 'whatsapp_number', '');
  v_group_link := coalesce(new.raw_user_meta_data ->> 'group_link', '');
  insert into public.profiles (id, name, phone, role, market, store_name, whatsapp_number, group_link)
  values (new.id, v_name, v_phone, v_role, v_market, v_store_name, v_whatsapp_number, v_group_link)
  on conflict (id) do nothing;
  if v_role = 'seller' then
    insert into public.seller_profiles (id, shop_name, market)
    values (new.id, v_store_name, v_market)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.sync_market_eye_seller_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role = 'seller' then
    update public.seller_profiles
    set shop_name = coalesce(nullif(trim(new.store_name), ''), new.name),
        market = new.market
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_seller_store on public.profiles;
create trigger profiles_sync_seller_store
after update of name, role, market, store_name on public.profiles
for each row execute function public.sync_market_eye_seller_profile();

create or replace view public.seller_public_profiles with (security_barrier = true) as
  select
    p.id,
    coalesce(nullif(trim(p.store_name), ''), sp.shop_name, p.name) as store_name,
    coalesce(nullif(trim(sp.market), ''), p.market) as market,
    sp.verified,
    p.show_whatsapp,
    case when p.show_whatsapp then nullif(trim(p.whatsapp_number), '') else null end as whatsapp_number,
    nullif(trim(p.group_link), '') as group_link
  from public.profiles p
  join public.seller_profiles sp on sp.id = p.id
  where p.role = 'seller';

grant select (store_name, whatsapp_number, show_whatsapp, group_link) on public.profiles to authenticated;
grant update (store_name, whatsapp_number, show_whatsapp, group_link) on public.profiles to authenticated;
grant select on public.seller_public_profiles to anon, authenticated;
revoke all on function public.sync_market_eye_seller_profile() from public, anon, authenticated;
