-- ─── MY FAVORITE BAGS / LOOKS — schema inicial ──────────────────────────────
-- Roda com: supabase db push

create extension if not exists "pgcrypto";

-- ── Produtos: bolsas ─────────────────────────────────────────────────────
create table if not exists public.bags (
  id           bigint generated always as identity primary key,
  name         text not null,
  cat          text not null check (cat in ('tote','shoulder','clutch','mini')),
  price        text not null,
  promo        text,
  status       text not null default 'available' check (status in ('available','sold_out','coming_soon')),
  is_new       boolean not null default false,
  favorite     boolean not null default false,
  img          text,
  tags         text[] not null default '{}',
  occasion     text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Produtos: looks (bijuteria/acessórios) ──────────────────────────────
create table if not exists public.looks (
  id           bigint generated always as identity primary key,
  name         text not null,
  cat          text not null check (cat in ('colar','brinco','pulseira','anel')),
  price        text not null,
  promo        text,
  status       text not null default 'available' check (status in ('available','sold_out','coming_soon')),
  is_new       boolean not null default false,
  img          text,
  tags         text[] not null default '{}',
  occasion     text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Configurações do site / painel admin ────────────────────────────────
-- chave/valor genérico: visibilidade do My Favorite Match, textos editáveis,
-- posição do botão flutuante, banner do hero, etc.
create table if not exists public.site_settings (
  key          text primary key,
  value        jsonb not null,
  updated_at   timestamptz not null default now()
);

-- ── Trigger simples pra manter updated_at em dia ────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bags_updated on public.bags;
create trigger trg_bags_updated before update on public.bags
  for each row execute function public.set_updated_at();

drop trigger if exists trg_looks_updated on public.looks;
create trigger trg_looks_updated before update on public.looks
  for each row execute function public.set_updated_at();

drop trigger if exists trg_settings_updated on public.site_settings;
create trigger trg_settings_updated before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ── RLS: leitura pública (o site é um catálogo público), escrita apenas
--        via service_role (usado dentro das Edge Functions do admin) ─────
alter table public.bags enable row level security;
alter table public.looks enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "bags_public_read" on public.bags;
create policy "bags_public_read" on public.bags for select using (true);

drop policy if exists "looks_public_read" on public.looks;
create policy "looks_public_read" on public.looks for select using (true);

drop policy if exists "settings_public_read" on public.site_settings;
create policy "settings_public_read" on public.site_settings for select using (true);

-- Nenhuma policy de insert/update/delete é criada de propósito:
-- com RLS ligado e sem policy de escrita, só o service_role (que ignora RLS)
-- consegue escrever — e o service_role só existe dentro das Edge Functions,
-- nunca no navegador. Todo write do admin passa pela function `admin-write`.
