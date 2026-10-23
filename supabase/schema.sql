-- =====================================================================
-- GEP Help: pangkalan data untuk Supabase
-- Cara guna: Supabase > SQL Editor > New query > tampal SEMUA isi fail
-- ini > tekan Run. Selamat dijalankan semula (tiada data hilang).
-- =====================================================================

set client_min_messages = warning;

-- ---------------------------------------------------------------------
-- 1. JADUAL
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  emel          text not null default '',
  nama          text not null default '' check (char_length(nama) <= 80),
  peranan       text not null default 'staf' check (peranan in ('admin', 'editor', 'staf')),
  bahasa        text not null default 'ms' check (bahasa in ('ms', 'en')),
  dicipta       timestamptz not null default now(),
  dikemas_kini  timestamptz not null default now()
);

create table if not exists public.tetapan (
  id               smallint primary key default 1 check (id = 1),
  whatsapp         text not null default '' check (whatsapp ~ '^[0-9]{0,15}$'),
  wajib_log_masuk  boolean not null default false,
  dikemas_kini     timestamptz not null default now()
);

create table if not exists public.produk (
  id             uuid primary key default gen_random_uuid(),
  kod            text not null check (kod ~ '^[A-Z0-9]{1,6}$'),
  nama_ms        text not null check (char_length(nama_ms) between 1 and 60),
  nama_en        text not null default '' check (char_length(nama_en) <= 60),
  keterangan_ms  text not null default '' check (char_length(keterangan_ms) <= 200),
  keterangan_en  text not null default '' check (char_length(keterangan_en) <= 200),
  warna          text not null default '#FFC20E' check (warna ~ '^#[0-9A-Fa-f]{6}$'),
  susunan        integer not null default 0,
  dicipta        timestamptz not null default now(),
  dikemas_kini   timestamptz not null default now()
);

create table if not exists public.tutorial (
  id             uuid primary key default gen_random_uuid(),
  produk_id      uuid not null references public.produk (id) on delete cascade,
  tajuk_ms       text not null check (char_length(tajuk_ms) between 1 and 120),
  tajuk_en       text not null default '' check (char_length(tajuk_en) <= 120),
  ringkasan_ms   text not null default '' check (char_length(ringkasan_ms) <= 400),
  ringkasan_en   text not null default '' check (char_length(ringkasan_en) <= 400),
  video_url_ms   text not null default '' check (video_url_ms = '' or video_url_ms ~ '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/[A-Za-z0-9_?=&/.%-]{1,200}$'),
  video_url_en   text not null default '' check (video_url_en = '' or video_url_en ~ '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/[A-Za-z0-9_?=&/.%-]{1,200}$'),
  status         text not null default 'draf' check (status in ('draf', 'terbit')),
  susunan        integer not null default 0,
  dicipta_oleh   uuid references auth.users (id) on delete set null,
  diterbit_pada  timestamptz,
  dicipta        timestamptz not null default now(),
  dikemas_kini   timestamptz not null default now()
);
create index if not exists tutorial_produk_idx on public.tutorial (produk_id, susunan);

create table if not exists public.langkah (
  id            uuid primary key default gen_random_uuid(),
  tutorial_id   uuid not null references public.tutorial (id) on delete cascade,
  susunan       integer not null default 0,
  teks_ms       text not null check (char_length(teks_ms) between 1 and 500),
  teks_en       text not null default '' check (char_length(teks_en) <= 500),
  gambar_path   text not null default ''
                check (gambar_path ~ '^(img/contoh/[a-z0-9-]{1,40}\.(jpg|png|webp)|[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80})?$'),
  penanda       jsonb not null default '[]'::jsonb
                check (jsonb_typeof(penanda) = 'array' and jsonb_array_length(penanda) <= 20),
  dicipta       timestamptz not null default now(),
  dikemas_kini  timestamptz not null default now()
);
create index if not exists langkah_tutorial_idx on public.langkah (tutorial_id, susunan);

create table if not exists public.nota (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tutorial_id   uuid not null references public.tutorial (id) on delete cascade,
  teks          text not null check (char_length(teks) between 1 and 2000),
  dikemas_kini  timestamptz not null default now(),
  primary key (user_id, tutorial_id)
);

create table if not exists public.kegemaran (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tutorial_id  uuid not null references public.tutorial (id) on delete cascade,
  dicipta      timestamptz not null default now(),
  primary key (user_id, tutorial_id)
);

create table if not exists public.ditonton (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tutorial_id  uuid not null references public.tutorial (id) on delete cascade,
  dicipta      timestamptz not null default now(),
  primary key (user_id, tutorial_id)
);

create table if not exists public.soalan (
  id            uuid primary key default gen_random_uuid(),
  tutorial_id   uuid not null references public.tutorial (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nama          text not null default '',
  teks          text not null check (char_length(teks) between 1 and 1000),
  jawapan       text not null default '' check (char_length(jawapan) <= 2000),
  dijawab_pada  timestamptz,
  dicipta       timestamptz not null default now(),
  dikemas_kini  timestamptz not null default now()
);
create index if not exists soalan_tutorial_idx on public.soalan (tutorial_id, dicipta);

create table if not exists public.cadangan (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nama          text not null default '',
  produk_id     uuid references public.produk (id) on delete set null,
  tajuk         text not null check (char_length(tajuk) between 1 and 120),
  butiran       text not null default '' check (char_length(butiran) <= 1000),
  status        text not null default 'baru' check (status in ('baru', 'selesai', 'ditolak')),
  dicipta       timestamptz not null default now(),
  dikemas_kini  timestamptz not null default now()
);

create table if not exists public.laporan (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nama          text not null default '',
  tutorial_id   uuid not null references public.tutorial (id) on delete cascade,
  jenis         text not null default 'lain' check (jenis in ('video', 'gambar', 'langkah', 'lain')),
  butiran       text not null default '' check (char_length(butiran) <= 1000),
  status        text not null default 'baru' check (status in ('baru', 'selesai')),
  dicipta       timestamptz not null default now(),
  dikemas_kini  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. FUNGSI PEMBANTU (semak peranan tanpa terkena RLS)
-- ---------------------------------------------------------------------

create or replace function public.peranan_saya()
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.peranan from public.profiles p where p.id = auth.uid()), 'tetamu');
$$;

create or replace function public.ialah_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.peranan_saya() = 'admin'; $$;

create or replace function public.ialah_penyunting()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.peranan_saya() in ('admin', 'editor'); $$;

create or replace function public.wajib_log_masuk()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select t.wajib_log_masuk from public.tetapan t where t.id = 1), false); $$;

create or replace function public.nama_saya()
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select coalesce(nullif(p.nama, ''), split_part(p.emel, '@', 1)) from public.profiles p where p.id = auth.uid()),
    '');
$$;

-- ---------------------------------------------------------------------
-- 3. TRIGGER
-- ---------------------------------------------------------------------

-- 3a. Cap masa dikemas_kini
create or replace function public.set_dikemas_kini()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.dikemas_kini := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'tetapan', 'produk', 'tutorial', 'langkah', 'nota', 'soalan', 'cadangan', 'laporan']
  loop
    execute format('drop trigger if exists set_dikemas_kini on public.%I', t);
    execute format('create trigger set_dikemas_kini before update on public.%I
                    for each row execute function public.set_dikemas_kini()', t);
  end loop;
end;
$$;

-- 3b. Profil dicipta automatik bila pengguna mendaftar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, emel, nama, bahasa)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    left(coalesce(new.raw_user_meta_data ->> 'nama', ''), 80),
    case when new.raw_user_meta_data ->> 'bahasa' in ('ms', 'en')
         then new.raw_user_meta_data ->> 'bahasa' else 'ms' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Pengguna yang mendaftar sebelum fail ini dijalankan juga dapat profil.
insert into public.profiles (id, emel)
select u.id, lower(coalesce(u.email, '')) from auth.users u
on conflict (id) do nothing;

-- 3c. Lindungi peranan: hanya admin boleh mengubah peranan; mesti kekal sekurang-kurangnya seorang admin
create or replace function public.lindungi_profil()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.ialah_admin() then
    if new.peranan is distinct from old.peranan or new.emel is distinct from old.emel or new.id is distinct from old.id then
      raise exception 'Anda tiada kebenaran mengubah peranan atau e-mel.' using errcode = '42501';
    end if;
  end if;
  if old.peranan = 'admin' and new.peranan <> 'admin'
     and (select count(*) from public.profiles where peranan = 'admin') <= 1 then
    raise exception 'Mesti ada sekurang-kurangnya seorang admin.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists lindungi_profil on public.profiles;
create trigger lindungi_profil before update on public.profiles
  for each row execute function public.lindungi_profil();

-- 3d. Tutorial: editor hanya boleh menulis draf; admin yang menerbitkan
create or replace function public.kawal_tutorial()
returns trigger language plpgsql set search_path = ''
as $$
declare
  admin boolean := auth.uid() is null or public.ialah_admin();
begin
  if tg_op = 'INSERT' then
    new.dicipta_oleh := coalesce(auth.uid(), new.dicipta_oleh);
    if not admin then
      new.status := 'draf';
    end if;
  else
    new.dicipta_oleh := old.dicipta_oleh;
    if not admin then
      if new.status = 'terbit' and old.status <> 'terbit' then
        new.status := old.status;
      end if;
      if new.tajuk_ms is distinct from old.tajuk_ms or new.tajuk_en is distinct from old.tajuk_en
         or new.ringkasan_ms is distinct from old.ringkasan_ms or new.ringkasan_en is distinct from old.ringkasan_en
         or new.video_url_ms is distinct from old.video_url_ms or new.video_url_en is distinct from old.video_url_en
         or new.produk_id is distinct from old.produk_id then
        new.status := 'draf';
      end if;
    end if;
  end if;
  if new.status = 'terbit' then
    if tg_op = 'INSERT' then
      new.diterbit_pada := now();
    elsif old.status <> 'terbit' then
      new.diterbit_pada := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists kawal_tutorial on public.tutorial;
create trigger kawal_tutorial before insert or update on public.tutorial
  for each row execute function public.kawal_tutorial();

-- 3e. Bila editor mengubah langkah, tutorial kembali menjadi draf untuk kelulusan admin
create or replace function public.langkah_diubah()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.ialah_admin() then
    if tg_op in ('INSERT', 'UPDATE') then
      update public.tutorial set status = 'draf' where id = new.tutorial_id and status <> 'draf';
    end if;
    if tg_op in ('UPDATE', 'DELETE') then
      update public.tutorial set status = 'draf' where id = old.tutorial_id and status <> 'draf';
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists langkah_diubah on public.langkah;
create trigger langkah_diubah after insert or update or delete on public.langkah
  for each row execute function public.langkah_diubah();

-- 3f. Soalan: nama penanya diisi automatik; hanya admin boleh menjawab
create or replace function public.kawal_soalan()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare admin boolean := auth.uid() is null or public.ialah_admin();
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.user_id := auth.uid();
      new.nama := public.nama_saya();
    end if;
    if not admin then
      new.jawapan := '';
      new.dijawab_pada := null;
    end if;
  else
    new.user_id := old.user_id;
    new.tutorial_id := old.tutorial_id;
    new.nama := old.nama;
    if not admin then
      new.jawapan := old.jawapan;
      new.dijawab_pada := old.dijawab_pada;
    end if;
    -- Hanya pemilik boleh menukar soalannya sendiri
    if auth.uid() is not null and auth.uid() <> old.user_id then
      new.teks := old.teks;
    end if;
  end if;
  if new.jawapan = '' then
    new.dijawab_pada := null;
  elsif tg_op = 'INSERT' then
    new.dijawab_pada := now();
  elsif new.jawapan is distinct from old.jawapan then
    new.dijawab_pada := now();
  end if;
  return new;
end;
$$;

drop trigger if exists kawal_soalan on public.soalan;
create trigger kawal_soalan before insert or update on public.soalan
  for each row execute function public.kawal_soalan();

-- 3g. Cadangan dan laporan: pemilik dan nama diisi automatik; hanya admin menukar status
create or replace function public.kawal_maklum_balas()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare admin boolean := auth.uid() is null or public.ialah_admin();
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.user_id := auth.uid();
      new.nama := public.nama_saya();
    end if;
    if not admin then
      new.status := 'baru';
    end if;
  else
    new.user_id := old.user_id;
    new.nama := old.nama;
    if not admin then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists kawal_maklum_balas on public.cadangan;
create trigger kawal_maklum_balas before insert or update on public.cadangan
  for each row execute function public.kawal_maklum_balas();
drop trigger if exists kawal_maklum_balas on public.laporan;
create trigger kawal_maklum_balas before insert or update on public.laporan
  for each row execute function public.kawal_maklum_balas();

-- ---------------------------------------------------------------------
-- 4. KEBENARAN ASAS (RLS di bawah menentukan baris mana yang dibenarkan)
-- ---------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

revoke all on public.profiles, public.tetapan, public.produk, public.tutorial, public.langkah,
  public.nota, public.kegemaran, public.ditonton, public.soalan, public.cadangan, public.laporan
  from anon, authenticated;

grant select on public.tetapan, public.produk, public.tutorial, public.langkah to anon, authenticated;
grant update on public.tetapan to authenticated;
grant insert, update, delete on public.produk, public.tutorial, public.langkah to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.nota, public.kegemaran, public.ditonton,
  public.soalan, public.cadangan, public.laporan to authenticated;

revoke execute on function public.peranan_saya(), public.ialah_admin(), public.ialah_penyunting(),
  public.wajib_log_masuk(), public.nama_saya() from public;
grant execute on function public.peranan_saya(), public.ialah_admin(), public.ialah_penyunting(),
  public.wajib_log_masuk(), public.nama_saya() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.profiles  enable row level security;
alter table public.tetapan   enable row level security;
alter table public.produk    enable row level security;
alter table public.tutorial  enable row level security;
alter table public.langkah   enable row level security;
alter table public.nota      enable row level security;
alter table public.kegemaran enable row level security;
alter table public.ditonton  enable row level security;
alter table public.soalan    enable row level security;
alter table public.cadangan  enable row level security;
alter table public.laporan   enable row level security;

-- Buang dasar lama supaya fail ini boleh dijalankan semula
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'tetapan', 'produk', 'tutorial', 'langkah', 'nota', 'kegemaran',
                        'ditonton', 'soalan', 'cadangan', 'laporan')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end;
$$;

-- profiles: lihat dan ubah profil sendiri; admin lihat dan ubah semua
create policy profil_baca on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.ialah_admin()));
create policy profil_ubah on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.ialah_admin()))
  with check (id = (select auth.uid()) or (select public.ialah_admin()));

-- tetapan: semua boleh baca; admin sahaja ubah
create policy tetapan_baca on public.tetapan for select to anon, authenticated using (true);
create policy tetapan_ubah on public.tetapan for update to authenticated
  using ((select public.ialah_admin())) with check ((select public.ialah_admin()));

-- produk: dibaca semua (kecuali tetamu bila log masuk diwajibkan); admin sahaja tulis
create policy produk_baca on public.produk for select to anon, authenticated
  using ((select auth.uid()) is not null or not (select public.wajib_log_masuk()));
create policy produk_tambah on public.produk for insert to authenticated
  with check ((select public.ialah_admin()));
create policy produk_ubah on public.produk for update to authenticated
  using ((select public.ialah_admin())) with check ((select public.ialah_admin()));
create policy produk_padam on public.produk for delete to authenticated
  using ((select public.ialah_admin()));

-- tutorial: yang terbit dibaca semua; draf hanya untuk admin/editor
create policy tutorial_baca on public.tutorial for select to anon, authenticated
  using (
    (status = 'terbit' and ((select auth.uid()) is not null or not (select public.wajib_log_masuk())))
    or (select public.ialah_penyunting())
  );
create policy tutorial_tambah on public.tutorial for insert to authenticated
  with check ((select public.ialah_penyunting()));
create policy tutorial_ubah on public.tutorial for update to authenticated
  using ((select public.ialah_penyunting())) with check ((select public.ialah_penyunting()));
create policy tutorial_padam on public.tutorial for delete to authenticated
  using (
    (select public.ialah_admin())
    or ((select public.peranan_saya()) = 'editor' and status = 'draf' and dicipta_oleh = (select auth.uid()))
  );

-- langkah: ikut keterlihatan tutorial; admin/editor menulis
create policy langkah_baca on public.langkah for select to anon, authenticated
  using (exists (select 1 from public.tutorial t where t.id = tutorial_id));
create policy langkah_tambah on public.langkah for insert to authenticated
  with check ((select public.ialah_penyunting()) and exists (select 1 from public.tutorial t where t.id = tutorial_id));
create policy langkah_ubah on public.langkah for update to authenticated
  using ((select public.ialah_penyunting()))
  with check ((select public.ialah_penyunting()) and exists (select 1 from public.tutorial t where t.id = tutorial_id));
create policy langkah_padam on public.langkah for delete to authenticated
  using ((select public.ialah_penyunting()));

-- nota, kegemaran, ditonton: milik sendiri sahaja
create policy nota_sendiri on public.nota for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy kegemaran_sendiri on public.kegemaran for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ditonton_sendiri on public.ditonton for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- soalan: pengguna log masuk boleh baca soalan bagi tutorial yang mereka boleh lihat;
-- tulis soalan sendiri; admin boleh jawab dan padam
create policy soalan_baca on public.soalan for select to authenticated
  using (exists (select 1 from public.tutorial t where t.id = tutorial_id));
create policy soalan_tambah on public.soalan for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.tutorial t where t.id = tutorial_id));
create policy soalan_ubah on public.soalan for update to authenticated
  using (user_id = (select auth.uid()) or (select public.ialah_admin()))
  with check (user_id = (select auth.uid()) or (select public.ialah_admin()));
create policy soalan_padam on public.soalan for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.ialah_admin()));

-- cadangan dan laporan: pengguna lihat milik sendiri; admin lihat semua dan menukar status
create policy cadangan_baca on public.cadangan for select to authenticated
  using (user_id = (select auth.uid()) or (select public.ialah_admin()));
create policy cadangan_tambah on public.cadangan for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy cadangan_ubah on public.cadangan for update to authenticated
  using ((select public.ialah_admin())) with check ((select public.ialah_admin()));
create policy cadangan_padam on public.cadangan for delete to authenticated
  using ((user_id = (select auth.uid()) and status = 'baru') or (select public.ialah_admin()));

create policy laporan_baca on public.laporan for select to authenticated
  using (user_id = (select auth.uid()) or (select public.ialah_admin()));
create policy laporan_tambah on public.laporan for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.tutorial t where t.id = tutorial_id));
create policy laporan_ubah on public.laporan for update to authenticated
  using ((select public.ialah_admin())) with check ((select public.ialah_admin()));
create policy laporan_padam on public.laporan for delete to authenticated
  using ((user_id = (select auth.uid()) and status = 'baru') or (select public.ialah_admin()));

-- ---------------------------------------------------------------------
-- 6. STORAN GAMBAR (bucket 'langkah')
-- Fail boleh dibaca melalui pautan awam. Hanya admin/editor boleh muat naik,
-- senarai, tukar atau padam fail.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('langkah', 'langkah', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists gep_langkah_baca on storage.objects;
drop policy if exists gep_langkah_tambah on storage.objects;
drop policy if exists gep_langkah_ubah on storage.objects;
drop policy if exists gep_langkah_padam on storage.objects;

create policy gep_langkah_baca on storage.objects for select to authenticated
  using (bucket_id = 'langkah' and (select public.ialah_penyunting()));
create policy gep_langkah_tambah on storage.objects for insert to authenticated
  with check (bucket_id = 'langkah' and (select public.ialah_penyunting()));
create policy gep_langkah_ubah on storage.objects for update to authenticated
  using (bucket_id = 'langkah' and (select public.ialah_penyunting()))
  with check (bucket_id = 'langkah' and (select public.ialah_penyunting()));
create policy gep_langkah_padam on storage.objects for delete to authenticated
  using (bucket_id = 'langkah' and (select public.ialah_penyunting()));

-- ---------------------------------------------------------------------
-- 7. DATA PERMULAAN (hanya bila pangkalan data masih kosong)
-- Gambar contoh disimpan dalam website (img/contoh/...), bukan dalam storan.
-- ---------------------------------------------------------------------

insert into public.tetapan (id) values (1) on conflict (id) do nothing;

do $$
declare
  p_app  uuid := 'a0000000-0000-4000-8000-000000000001';
  p_ops  uuid := 'a0000000-0000-4000-8000-000000000002';
  p_lite uuid := 'a0000000-0000-4000-8000-000000000003';
  t_app  uuid := 'b0000000-0000-4000-8000-000000000001';
  t_ops  uuid := 'b0000000-0000-4000-8000-000000000002';
  t_lite uuid := 'b0000000-0000-4000-8000-000000000003';
begin
  if exists (select 1 from public.produk) then
    return;
  end if;

  insert into public.produk (id, kod, nama_ms, nama_en, keterangan_ms, keterangan_en, warna, susunan) values
    (p_app,  'APP',  'GEP APP',  'GEP APP',
     'App pengawal: pasang, log masuk dan buat rondaan.', 'The guard app: install, sign in and patrol.', '#FFC20E', 1),
    (p_ops,  'OPS',  'GEP OPS',  'GEP OPS',
     'Konsol penyelia untuk pantau pengawal dan buat laporan.', 'The supervisor console to monitor guards and build reports.', '#2563B8', 2),
    (p_lite, 'LITE', 'GEP LITE', 'GEP LITE',
     'Versi ringan untuk daftar masuk dengan cepat.', 'A lighter version for quick check-ins.', '#2E9A63', 3);

  insert into public.tutorial (id, produk_id, tajuk_ms, tajuk_en, ringkasan_ms, ringkasan_en, status, susunan) values
    (t_app, p_app, 'Pasang & log masuk GEP APP', 'Install & sign in to GEP APP',
     'Muat turun GEP APP, log masuk dengan akaun syarikat dan sampai ke skrin utama.',
     'Download GEP APP, sign in with your company account and reach the home screen.', 'terbit', 1),
    (t_ops, p_ops, 'Log masuk ke konsol GEP OPS', 'Sign in to the GEP OPS console',
     'Masuk ke papan pemuka GEP OPS dengan akaun penyelia.',
     'Open the GEP OPS dashboard with your supervisor account.', 'terbit', 1),
    (t_lite, p_lite, 'Pasang & log masuk GEP LITE', 'Install & sign in to GEP LITE',
     'Muat turun GEP LITE dan log masuk dengan akaun anda.',
     'Download GEP LITE and sign in with your account.', 'terbit', 1);

  insert into public.langkah (tutorial_id, susunan, teks_ms, teks_en, gambar_path, penanda) values
    (t_app, 1, 'Buka Play Store, cari "GEP APP" dan tekan Pasang.', 'Open the Play Store, search for "GEP APP" and tap Install.',
     'img/contoh/app-1.jpg', '[{"t":"o","x":50,"y":50,"r":14}]'),
    (t_app, 2, 'Buka app dan masukkan e-mel serta kata laluan syarikat anda.', 'Open the app and enter your company email and password.',
     'img/contoh/app-2.jpg', '[]'),
    (t_app, 3, 'Tekan Log Masuk. Skrin utama akan muncul.', 'Tap Sign in. The home screen appears.',
     'img/contoh/app-3.jpg', '[{"t":"a","x":50,"y":70,"d":135}]'),
    (t_ops, 1, 'Buka pautan konsol GEP OPS dalam pelayar.', 'Open the GEP OPS console link in your browser.',
     'img/contoh/ops-1.jpg', '[]'),
    (t_ops, 2, 'Masukkan ID penyelia dan kata laluan.', 'Enter your supervisor ID and password.',
     'img/contoh/ops-2.jpg', '[{"t":"o","x":50,"y":45,"r":16}]'),
    (t_ops, 3, 'Papan pemuka dibuka. Anda sedia memantau.', 'The dashboard opens. You are ready to monitor.',
     'img/contoh/ops-3.jpg', '[]'),
    (t_lite, 1, 'Pasang GEP LITE dari Play Store.', 'Install GEP LITE from the Play Store.',
     'img/contoh/lite-1.jpg', '[]'),
    (t_lite, 2, 'Buka app dan pilih Log Masuk.', 'Open the app and choose Sign in.',
     'img/contoh/lite-2.jpg', '[{"t":"a","x":50,"y":60,"d":45}]'),
    (t_lite, 3, 'Masukkan butiran akaun dan tekan Teruskan.', 'Enter your account details and tap Continue.',
     'img/contoh/lite-3.jpg', '[]');
end;
$$;

-- Siap. Langkah seterusnya: daftar akaun di website, kemudian jalankan make-admin.sql.
