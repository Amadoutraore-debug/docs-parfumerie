-- =====================================================================
--  DOC'S PARFUMERIE — Schéma Supabase (gratuit)
--  À coller en entier dans : Supabase > SQL Editor > New query > Run
--  Le script peut être relancé sans danger (idempotent).
--  Ensuite : lancer supabase/produits.sql pour charger le catalogue.
-- =====================================================================

-- ---------- 1. Administrateurs ----------------------------------------
-- Seuls les e-mails listés ici peuvent gérer la boutique.
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- 2. Réglages de la boutique --------------------------------
-- wholesale_min_qty : nombre d'articles dans le panier (tous parfums
-- confondus) à partir duquel le prix de gros s'applique.
create table if not exists public.shop_settings (
  id                 int primary key default 1 check (id = 1),
  wholesale_min_qty  int not null default 10 check (wholesale_min_qty >= 0)
);
insert into public.shop_settings (id) values (1) on conflict (id) do nothing;
alter table public.shop_settings enable row level security;

drop policy if exists "reglages visibles" on public.shop_settings;
create policy "reglages visibles" on public.shop_settings for select using (true);
drop policy if exists "admin gere reglages" on public.shop_settings;
create policy "admin gere reglages" on public.shop_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------- 3. Produits ------------------------------------------------
-- Chaque produit a un ou plusieurs FORMATS dans « variants » :
-- [{"id":"ess","label":"Essence de parfum","volume_ml":null,
--   "price":1000,"wholesale_price":800,"stock":500}, ...]
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  brand        text default '',
  category     text not null default 'Mixte',
  description  text default '',
  notes_top    text default '',
  notes_heart  text default '',
  notes_base   text default '',
  variants     jsonb not null default '[]'::jsonb,
  promo_pct    int check (promo_pct is null or (promo_pct between 0 and 90)),
  promo_until  timestamptz,
  image_url    text,
  gallery      text[] default '{}',
  color        text default '#dba524',
  featured     boolean default false,
  active       boolean default true,
  created_at   timestamptz default now()
);
-- photo détourée (fond transparent) pour les bannières
alter table public.products add column if not exists cutout_url text;
alter table public.products enable row level security;

drop policy if exists "produits visibles" on public.products;
create policy "produits visibles" on public.products
  for select using (active or public.is_admin());

drop policy if exists "admin gere produits" on public.products;
create policy "admin gere produits" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- Met à jour le stock d'un format (utilisé par les fonctions ci-dessous)
create or replace function public.variants_add_stock(p_variants jsonb, p_vid text, p_delta int)
returns jsonb
language sql immutable
as $$
  select coalesce(jsonb_agg(
           case when e.v->>'id' = p_vid
                then jsonb_set(e.v, '{stock}', to_jsonb(greatest(0, coalesce((e.v->>'stock')::int, 0) + p_delta)))
                else e.v end
           order by e.ord), '[]'::jsonb)
  from jsonb_array_elements(p_variants) with ordinality as e(v, ord);
$$;

-- ---------- 4. Commandes ----------------------------------------------
create table if not exists public.orders (
  id              bigint generated always as identity primary key,
  code            text unique not null,
  customer_name   text not null,
  phone           text not null,
  city            text default '',
  address         text default '',
  note            text default '',
  payment_method  text default 'livraison',   -- livraison | wave
  items           jsonb not null,
  total           int not null,
  wholesale       boolean default false,
  status          text not null default 'nouvelle'
                  check (status in ('nouvelle','confirmee','livree','annulee')),
  created_at      timestamptz default now()
);
alter table public.orders enable row level security;

-- Les visiteurs ne lisent JAMAIS les commandes : seule l'admin y a accès.
drop policy if exists "admin lit commandes" on public.orders;
create policy "admin lit commandes" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- 5. Passer une commande (stock décrémenté de façon sûre) ----
-- Le prix est recalculé côté serveur (impossible de tricher), la ligne
-- produit est verrouillée (2 clients ne peuvent pas acheter le dernier
-- flacon en même temps), puis le stock du format est diminué.
-- p_items : [{"id": "<uuid produit>", "vid": "<id du format>", "qty": 2}, ...]
create or replace function public.place_order(p_customer jsonb, p_items jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  it         jsonb;
  prod       public.products%rowtype;
  v          jsonb;
  q          int;
  unit       int;
  v_total    int := 0;
  v_lines    jsonb := '[]'::jsonb;
  v_code     text;
  v_phone    text;
  v_qty_all  int;
  v_min      int;
  v_whole    boolean;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'PANIER_VIDE';
  end if;
  if jsonb_array_length(p_items) > 40 then
    raise exception 'PANIER_TROP_GRAND';
  end if;

  v_phone := right(regexp_replace(coalesce(p_customer->>'phone',''), '\D', '', 'g'), 10);
  if length(trim(coalesce(p_customer->>'name',''))) < 2 or length(v_phone) < 8 then
    raise exception 'INFOS_MANQUANTES';
  end if;

  -- tarif de gros : selon le nombre total d'articles du panier
  select coalesce(sum(greatest(0, (value->>'qty')::int)), 0) into v_qty_all from jsonb_array_elements(p_items);
  select wholesale_min_qty into v_min from public.shop_settings where id = 1;
  v_whole := coalesce(v_min, 0) > 0 and v_qty_all >= v_min;

  -- tri : évite les blocages entre deux commandes simultanées
  for it in
    select value from jsonb_array_elements(p_items) order by value->>'id', value->>'vid'
  loop
    q := (it->>'qty')::int;
    if q is null or q < 1 or q > 500 then
      raise exception 'QUANTITE_INVALIDE';
    end if;

    select * into prod from public.products
     where id = (it->>'id')::uuid and active
     for update;
    if not found then
      raise exception 'PRODUIT_INDISPONIBLE';
    end if;

    select e.v into v from jsonb_array_elements(prod.variants) as e(v)
     where e.v->>'id' = it->>'vid';
    if v is null then
      raise exception 'PRODUIT_INDISPONIBLE';
    end if;
    if coalesce((v->>'stock')::int, 0) < q then
      raise exception 'STOCK_INSUFFISANT:%:%', prod.name || ' (' || (v->>'label') || ')', coalesce((v->>'stock')::int, 0);
    end if;

    unit := (v->>'price')::int;
    if coalesce(prod.promo_pct, 0) > 0 and (prod.promo_until is null or prod.promo_until > now()) then
      unit := (round(unit * (100 - prod.promo_pct) / 100.0 / 50) * 50)::int;
    end if;
    if v_whole and coalesce((v->>'wholesale_price')::int, 0) > 0 then
      unit := least(unit, (v->>'wholesale_price')::int);
    end if;

    update public.products
       set variants = public.variants_add_stock(variants, it->>'vid', -q)
     where id = prod.id;

    v_total := v_total + unit * q;
    v_lines := v_lines || jsonb_build_object(
      'id', prod.id, 'vid', v->>'id', 'variant', v->>'label', 'name', prod.name,
      'qty', q, 'price', unit, 'image_url', prod.image_url, 'color', prod.color);
  end loop;

  v_code := 'CMD-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into public.orders (code, customer_name, phone, city, address, note, payment_method, items, total, wholesale)
  values (
    v_code,
    left(trim(p_customer->>'name'), 80),
    v_phone,
    left(coalesce(p_customer->>'city', ''), 80),
    left(coalesce(p_customer->>'address', ''), 200),
    left(coalesce(p_customer->>'note', ''), 500),
    case when p_customer->>'payment_method' = 'wave' then 'wave' else 'livraison' end,
    v_lines,
    v_total,
    v_whole
  );

  return jsonb_build_object('code', v_code, 'total', v_total, 'items', v_lines, 'wholesale', v_whole);
end;
$$;
grant execute on function public.place_order(jsonb, jsonb) to anon, authenticated;

-- ---------- 6. Annulation = le stock revient automatiquement ----------
create or replace function public.orders_restore_stock()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  l    jsonb;
  sgn  int := 0;
begin
  if new.status = 'annulee' and old.status <> 'annulee' then sgn := 1;
  elsif old.status = 'annulee' and new.status <> 'annulee' then sgn := -1;
  end if;
  if sgn <> 0 then
    for l in select value from jsonb_array_elements(new.items) loop
      update public.products
         set variants = public.variants_add_stock(variants, l->>'vid', sgn * (l->>'qty')::int)
       where id = (l->>'id')::uuid;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_restore_stock on public.orders;
create trigger trg_orders_restore_stock
  after update of status on public.orders
  for each row execute function public.orders_restore_stock();

-- ---------- 7. Ajuster le stock d'un format (admin) -------------------
drop function if exists public.admin_adjust_stock(uuid, int);
create or replace function public.admin_adjust_stock(p_id uuid, p_vid text, p_delta int)
returns int
language plpgsql security definer set search_path = public
as $$
declare res int;
begin
  if not public.is_admin() then raise exception 'NON_AUTORISE'; end if;
  update public.products set variants = public.variants_add_stock(variants, p_vid, p_delta)
   where id = p_id;
  select (e.v->>'stock')::int into res
    from public.products p, jsonb_array_elements(p.variants) e(v)
   where p.id = p_id and e.v->>'id' = p_vid;
  return res;
end;
$$;
grant execute on function public.admin_adjust_stock(uuid, text, int) to authenticated;

-- ---------- 8. Client(e) de la semaine (public, anonymisé) -------------
-- Ne compte que les commandes CONFIRMÉES ou LIVRÉES (pas de triche avec
-- de fausses commandes). Renvoie « Prénom N. », jamais le téléphone.
create or replace function public.best_customers(p_week_offset int default 0, p_limit int default 3)
returns table (display_name text, orders_count int, city text)
language sql stable security definer set search_path = public
as $$
  with bounds as (
    select date_trunc('week', now()) - make_interval(weeks => greatest(0, least(p_week_offset, 8))) as d_start
  )
  select
    initcap(split_part(trim(max(o.customer_name)), ' ', 1))
      || coalesce(' ' || nullif(upper(left(split_part(trim(max(o.customer_name)), ' ', 2), 1)), '') || '.', ''),
    count(*)::int,
    max(o.city)
  from public.orders o, bounds b
  where o.status in ('confirmee', 'livree')
    and o.created_at >= b.d_start
    and o.created_at <  b.d_start + interval '7 days'
  group by o.phone
  order by sum(o.total) desc, count(*) desc
  limit greatest(1, least(p_limit, 10));
$$;
grant execute on function public.best_customers(int, int) to anon, authenticated;

-- ---------- 9. Stockage des photos ------------------------------------
insert into storage.buckets (id, name, public)
values ('produits', 'produits', true)
on conflict (id) do nothing;

drop policy if exists "photos lecture publique" on storage.objects;
create policy "photos lecture publique" on storage.objects
  for select using (bucket_id = 'produits');

drop policy if exists "photos admin ajout" on storage.objects;
create policy "photos admin ajout" on storage.objects
  for insert to authenticated with check (bucket_id = 'produits' and public.is_admin());

drop policy if exists "photos admin modif" on storage.objects;
create policy "photos admin modif" on storage.objects
  for update to authenticated using (bucket_id = 'produits' and public.is_admin());

drop policy if exists "photos admin suppr" on storage.objects;
create policy "photos admin suppr" on storage.objects
  for delete to authenticated using (bucket_id = 'produits' and public.is_admin());

-- ---------- 10. Temps réel (stock en direct + alerte nouvelle commande) -
do $$
begin
  begin alter publication supabase_realtime add table public.products; exception when others then null; end;
  begin alter publication supabase_realtime add table public.orders;   exception when others then null; end;
end $$;

-- ---------- 11. À FAIRE : mettre l'e-mail de la gérante -----------------
-- Remplacez l'adresse ci-dessous puis relancez uniquement cette ligne :
-- insert into public.admins (email) values ('gerante@exemple.com') on conflict do nothing;
