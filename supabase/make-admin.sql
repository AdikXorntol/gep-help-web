-- =====================================================================
-- GEP Help: jadikan akaun anda ADMIN
-- 1. Daftar akaun dahulu di website GEP Help (butang Log masuk > Daftar).
-- 2. Tukar emel.anda@contoh.com di bawah kepada e-mel yang anda daftar.
-- 3. Supabase > SQL Editor > New query > tampal > Run.
-- Hasil yang betul: satu baris dengan peranan = admin.
-- =====================================================================

update public.profiles
set peranan = 'admin'
where emel = lower(trim('emel.anda@contoh.com'));

select emel, nama, peranan
from public.profiles
where emel = lower(trim('emel.anda@contoh.com'));

-- Tiada baris? Semak ejaan e-mel, atau pastikan anda sudah mendaftar di website.
