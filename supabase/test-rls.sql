-- =====================================================================
-- GEP Help: ujian keselamatan pangkalan data
-- Cara guna: Supabase > SQL Editor > New query > tampal fail ini > Run.
-- Ujian mencipta pengguna dan data sementara, kemudian membatalkan
-- semuanya. Tiada apa-apa yang kekal dalam pangkalan data anda.
-- Hasil: jadual dengan lajur "keputusan". Semua baris patut LULUS.
-- =====================================================================

drop table if exists pg_temp.hasil_ujian;
create temp table hasil_ujian (no serial primary key, ujian text not null, keputusan text not null);

do $ujian$
declare
  hasil   text[] := '{}';
  u_admin uuid := gen_random_uuid();
  u_edit  uuid := gen_random_uuid();
  u_staf  uuid := gen_random_uuid();
  u_lain  uuid := gen_random_uuid();
  p_id    uuid := gen_random_uuid();
  t_pub   uuid := gen_random_uuid();
  t_draf  uuid := gen_random_uuid();
  r       text;
  v       text;
  wajib   boolean;
  i       int;

  -- semak(nama ujian, dapat, jangka)
begin
  begin
    -- Fungsi pembantu sementara: jalankan SQL sebagai pengguna tertentu (null = tetamu)
    create function pg_temp.sebagai(u uuid, q text) returns text language plpgsql as $f$
    declare n bigint;
    begin
      if u is null then
        perform set_config('request.jwt.claims', '{"role":"anon"}', true);
        perform set_config('request.jwt.claim.sub', '', true);
        execute 'set local role anon';
      else
        perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
        perform set_config('request.jwt.claim.sub', u::text, true);
        execute 'set local role authenticated';
      end if;
      begin
        execute q;
        get diagnostics n = row_count;
        execute 'reset role';
        perform set_config('request.jwt.claims', '', true);
        perform set_config('request.jwt.claim.sub', '', true);
        return 'ok:' || n;
      exception when others then
        execute 'reset role';
        perform set_config('request.jwt.claims', '', true);
        perform set_config('request.jwt.claim.sub', '', true);
        return 'ralat:' || sqlstate;
      end;
    end;
    $f$;

    -- Pengguna ujian
    insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values
      ('00000000-0000-0000-0000-000000000000', u_admin, 'authenticated', 'authenticated', 'ujian-admin-' || u_admin || '@gep.test', '{}', '{"nama":"Ujian Admin"}', now(), now()),
      ('00000000-0000-0000-0000-000000000000', u_edit,  'authenticated', 'authenticated', 'ujian-editor-' || u_edit || '@gep.test', '{}', '{"nama":"Ujian Editor"}', now(), now()),
      ('00000000-0000-0000-0000-000000000000', u_staf,  'authenticated', 'authenticated', 'ujian-staf-' || u_staf || '@gep.test', '{}', '{"nama":"Ujian Staf"}', now(), now()),
      ('00000000-0000-0000-0000-000000000000', u_lain,  'authenticated', 'authenticated', 'ujian-lain-' || u_lain || '@gep.test', '{}', '{"nama":"Ujian Lain"}', now(), now());

    hasil := hasil || array['Profil dicipta automatik semasa daftar',
      case when (select count(*) from public.profiles where id in (u_admin, u_edit, u_staf, u_lain)) = 4 then 'LULUS' else 'GAGAL' end];
    hasil := hasil || array['Pengguna baharu menjadi staf',
      case when (select peranan from public.profiles where id = u_staf) = 'staf' then 'LULUS' else 'GAGAL' end];

    update public.profiles set peranan = 'admin' where id = u_admin;
    update public.profiles set peranan = 'editor' where id = u_edit;

    -- Data ujian
    insert into public.produk (id, kod, nama_ms, susunan) values (p_id, 'UJI', 'Produk Ujian', 99);
    insert into public.tutorial (id, produk_id, tajuk_ms, status) values (t_pub, p_id, 'Tutorial terbit ujian', 'terbit');
    insert into public.tutorial (id, produk_id, tajuk_ms, status) values (t_draf, p_id, 'Tutorial draf ujian', 'draf');
    insert into public.langkah (tutorial_id, susunan, teks_ms) values (t_pub, 1, 'Langkah ujian');
    insert into public.nota (user_id, tutorial_id, teks) values (u_lain, t_pub, 'Nota peribadi orang lain');

    select wajib_log_masuk into wajib from public.tetapan where id = 1;
    update public.tetapan set wajib_log_masuk = false where id = 1;

    -- ---------------- Tetamu (tidak log masuk) ----------------
    r := pg_temp.sebagai(null, format('select 1 from public.tutorial where id = %L', t_pub));
    hasil := hasil || array['Tetamu boleh lihat tutorial terbit', case when r = 'ok:1' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(null, format('select 1 from public.tutorial where id = %L', t_draf));
    hasil := hasil || array['Tetamu tidak nampak draf', case when r = 'ok:0' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(null, format('select 1 from public.langkah where tutorial_id = %L', t_pub));
    hasil := hasil || array['Tetamu boleh lihat langkah tutorial terbit', case when r = 'ok:1' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(null, format('insert into public.tutorial (produk_id, tajuk_ms) values (%L, %L)', p_id, 'Cubaan tetamu'));
    hasil := hasil || array['Tetamu tidak boleh tambah tutorial', case when r like 'ralat:%' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(null, 'select 1 from public.profiles');
    hasil := hasil || array['Tetamu tidak boleh baca profil', case when r like 'ralat:%' or r = 'ok:0' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(null, 'select 1 from public.nota');
    hasil := hasil || array['Tetamu tidak boleh baca nota', case when r like 'ralat:%' or r = 'ok:0' then 'LULUS' else 'GAGAL (' || r || ')' end];

    -- ---------------- Staf ----------------
    r := pg_temp.sebagai(u_staf, format('update public.tutorial set tajuk_ms = %L where id = %L', 'Diubah staf', t_pub));
    hasil := hasil || array['Staf tidak boleh edit tutorial', case when (r = 'ok:0' or r like 'ralat:%') and (select tajuk_ms from public.tutorial where id = t_pub) = 'Tutorial terbit ujian' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_staf, format('select 1 from public.tutorial where id = %L', t_draf));
    hasil := hasil || array['Staf tidak nampak draf', case when r = 'ok:0' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_staf, format('delete from public.produk where id = %L', p_id));
    hasil := hasil || array['Staf tidak boleh padam produk', case when exists (select 1 from public.produk where id = p_id) then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_staf, format('update public.profiles set peranan = %L where id = %L', 'admin', u_staf));
    hasil := hasil || array['Staf tidak boleh jadikan diri admin', case when (select peranan from public.profiles where id = u_staf) = 'staf' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_staf, format('update public.profiles set bahasa = %L where id = %L', 'en', u_staf));
    hasil := hasil || array['Staf boleh tukar bahasa sendiri', case when r = 'ok:1' and (select bahasa from public.profiles where id = u_staf) = 'en' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_staf, format('update public.profiles set bahasa = %L where id = %L', 'en', u_lain));
    hasil := hasil || array['Staf tidak boleh ubah profil orang lain', case when (select bahasa from public.profiles where id = u_lain) = 'ms' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_staf, 'select 1 from public.profiles');
    hasil := hasil || array['Staf hanya nampak profil sendiri', case when r = 'ok:1' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_staf, format('insert into public.nota (tutorial_id, teks) values (%L, %L)', t_pub, 'Nota saya'));
    hasil := hasil || array['Staf boleh simpan nota sendiri', case when r = 'ok:1' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_staf, format('select 1 from public.nota where user_id = %L', u_lain));
    hasil := hasil || array['Staf tidak boleh baca nota orang lain', case when r = 'ok:0' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_staf, format('insert into public.nota (user_id, tutorial_id, teks) values (%L, %L, %L)', u_lain, t_draf, 'Menyamar'));
    hasil := hasil || array['Staf tidak boleh tulis nota atas nama orang lain', case when r like 'ralat:%' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_staf, format('insert into public.kegemaran (tutorial_id) values (%L)', t_pub));
    hasil := hasil || array['Staf boleh tanda kegemaran', case when r = 'ok:1' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_staf, format('insert into public.soalan (tutorial_id, teks, jawapan) values (%L, %L, %L)', t_pub, 'Soalan staf', 'Jawapan palsu'));
    hasil := hasil || array['Staf boleh bertanya tetapi tidak boleh menjawab',
      case when r = 'ok:1' and (select jawapan from public.soalan where tutorial_id = t_pub and user_id = u_staf) = '' then 'LULUS' else 'GAGAL (' || r || ')' end];
    hasil := hasil || array['Nama penanya diisi automatik',
      case when (select nama from public.soalan where tutorial_id = t_pub and user_id = u_staf) = 'Ujian Staf' then 'LULUS' else 'GAGAL' end];
    r := pg_temp.sebagai(u_staf, format('insert into public.cadangan (tajuk, status) values (%L, %L)', 'Cadangan staf', 'selesai'));
    hasil := hasil || array['Staf boleh hantar cadangan (status kekal baru)',
      case when r = 'ok:1' and (select status from public.cadangan where user_id = u_staf) = 'baru' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_lain, 'select 1 from public.cadangan');
    hasil := hasil || array['Staf lain tidak nampak cadangan orang lain', case when r = 'ok:0' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_staf, format('insert into public.laporan (tutorial_id, jenis, butiran) values (%L, %L, %L)', t_pub, 'video', 'Video tak main'));
    hasil := hasil || array['Staf boleh laporkan masalah', case when r = 'ok:1' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_staf, 'update public.tetapan set wajib_log_masuk = true where id = 1');
    hasil := hasil || array['Staf tidak boleh ubah tetapan', case when (select wajib_log_masuk from public.tetapan where id = 1) = false then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_staf, format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'langkah', 'ujian/staf.jpg'));
    hasil := hasil || array['Staf tidak boleh muat naik gambar', case when r like 'ralat:%' then 'LULUS' else 'GAGAL (' || r || ')' end];

    -- ---------------- Editor ----------------
    r := pg_temp.sebagai(u_edit, format('delete from public.produk where id = %L', p_id));
    hasil := hasil || array['Editor tidak boleh padam produk', case when exists (select 1 from public.produk where id = p_id) then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_edit, format('select 1 from public.tutorial where id = %L', t_draf));
    hasil := hasil || array['Editor nampak draf', case when r = 'ok:1' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_edit, format('insert into public.tutorial (produk_id, tajuk_ms, status) values (%L, %L, %L)', p_id, 'Tutorial editor', 'terbit'));
    hasil := hasil || array['Tutorial baharu editor disimpan sebagai draf',
      case when r = 'ok:1' and (select status from public.tutorial where tajuk_ms = 'Tutorial editor' and produk_id = p_id) = 'draf' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_edit, format('update public.tutorial set status = %L where id = %L', 'terbit', t_draf));
    hasil := hasil || array['Editor tidak boleh menerbitkan', case when (select status from public.tutorial where id = t_draf) = 'draf' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_edit, format('update public.tutorial set tajuk_ms = %L where id = %L', 'Disunting editor', t_pub));
    hasil := hasil || array['Suntingan editor menjadikan tutorial draf semula',
      case when r = 'ok:1' and (select status from public.tutorial where id = t_pub) = 'draf' then 'LULUS' else 'GAGAL (' || r || ')' end];
    update public.tutorial set status = 'terbit' where id = t_pub;
    r := pg_temp.sebagai(u_edit, format('insert into public.langkah (tutorial_id, susunan, teks_ms) values (%L, 2, %L)', t_pub, 'Langkah editor'));
    hasil := hasil || array['Langkah baharu editor menjadikan tutorial draf',
      case when r = 'ok:1' and (select status from public.tutorial where id = t_pub) = 'draf' then 'LULUS' else 'GAGAL (' || r || ')' end];
    update public.tutorial set status = 'terbit' where id = t_pub;
    r := pg_temp.sebagai(u_edit, format('update public.profiles set peranan = %L where id = %L', 'admin', u_edit));
    hasil := hasil || array['Editor tidak boleh jadikan diri admin', case when (select peranan from public.profiles where id = u_edit) = 'editor' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_edit, format('insert into public.langkah (tutorial_id, susunan, teks_ms, gambar_path) values (%L, 9, %L, %L)', t_draf, 'Gambar luar', 'https://contoh.test/x.png'));
    hasil := hasil || array['Pautan gambar luar ditolak', case when r like 'ralat:%' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_edit, format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'langkah', 'ujian/editor.jpg'));
    hasil := hasil || array['Editor boleh muat naik gambar', case when r = 'ok:1' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_edit, 'select 1 from public.cadangan');
    hasil := hasil || array['Editor tidak nampak kotak masuk admin', case when r = 'ok:0' then 'LULUS' else 'GAGAL (' || r || ')' end];

    -- ---------------- Admin ----------------
    r := pg_temp.sebagai(u_admin, format('update public.tutorial set status = %L where id = %L', 'terbit', t_draf));
    hasil := hasil || array['Admin boleh menerbitkan', case when (select status from public.tutorial where id = t_draf) = 'terbit' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_admin, format('update public.soalan set jawapan = %L where tutorial_id = %L', 'Ini jawapannya', t_pub));
    hasil := hasil || array['Admin boleh menjawab soalan',
      case when (select dijawab_pada is not null from public.soalan where tutorial_id = t_pub and user_id = u_staf) then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_admin, 'select 1 from public.cadangan');
    hasil := hasil || array['Admin nampak semua cadangan', case when r <> 'ok:0' and r like 'ok:%' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_admin, format('update public.profiles set peranan = %L where id = %L', 'editor', u_lain));
    hasil := hasil || array['Admin boleh tukar peranan pengguna', case when (select peranan from public.profiles where id = u_lain) = 'editor' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_admin, 'update public.tetapan set whatsapp = ''60123456789'' where id = 1');
    hasil := hasil || array['Admin boleh ubah tetapan', case when (select whatsapp from public.tetapan where id = 1) = '60123456789' then 'LULUS' else 'GAGAL (' || r || ')' end];

    -- ---------------- Wajib log masuk ----------------
    update public.tetapan set wajib_log_masuk = true where id = 1;
    r := pg_temp.sebagai(null, format('select 1 from public.tutorial where id = %L', t_pub));
    hasil := hasil || array['Bila log masuk diwajibkan, tetamu tidak nampak tutorial', case when r = 'ok:0' then 'LULUS' else 'GAGAL (' || r || ')' end];
    r := pg_temp.sebagai(u_staf, format('select 1 from public.tutorial where id = %L', t_pub));
    hasil := hasil || array['Bila log masuk diwajibkan, staf masih nampak tutorial', case when r = 'ok:1' then 'LULUS' else 'GAGAL (' || r || ')' end];
    update public.tetapan set wajib_log_masuk = coalesce(wajib, false) where id = 1;

    -- Batalkan semua perubahan ujian
    raise exception using errcode = 'P0001', message = '__batal_ujian__';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '__batal_ujian__' then
      raise;
    end if;
  end;

  i := 1;
  while i < array_length(hasil, 1) loop
    insert into hasil_ujian (ujian, keputusan) values (hasil[i], hasil[i + 1]);
    i := i + 2;
  end loop;
end;
$ujian$;

select no, ujian, keputusan from hasil_ujian order by no;
