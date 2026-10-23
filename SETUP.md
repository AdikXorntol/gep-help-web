# Panduan setup GEP Help (sekali sahaja)

Masa: kira-kira 20 minit. Semua percuma, tiada kad kredit.
Anda perlukan: akaun GitHub (sudah ada) dan pelayar di laptop atau telefon.

> Nama menu dalam Supabase kadang-kadang berubah sedikit. Kalau tak jumpa satu menu, cari perkataan dalam kurungan.

---

## Bahagian A: Hidupkan website (GitHub Pages)

1. Buka **https://github.com/AdikXorntol/gep-help-web/settings/pages**.
2. Bawah **Build and deployment → Source**, pilih **GitHub Actions**.
3. Tunggu 1–2 minit, kemudian buka **https://adikxorntol.github.io/gep-help-web/**.
   Website akan buka dalam **mod demo**. Anda boleh cuba semuanya, tapi tiada apa-apa disimpan.

---

## Bahagian B: Cipta pangkalan data (Supabase)

### B1. Daftar dan cipta projek
1. Buka **https://supabase.com** → **Start your project** → **Continue with GitHub**.
2. Tekan **New project**.
   - **Name:** `gep-help`
   - **Database Password:** tekan *Generate a password* dan simpan di tempat selamat (jarang diperlukan).
   - **Region:** *Southeast Asia (Singapore)* (paling dekat dengan Malaysia).
   - **Plan:** *Free*.
3. Tekan **Create new project** dan tunggu 1–2 minit sehingga siap.

### B2. Pasang jadual dan keselamatan
1. Menu kiri → **SQL Editor** → **New query**.
2. Buka fail **[supabase/schema.sql](supabase/schema.sql)** di GitHub → tekan butang **Copy raw file** (ikon dua kotak di kanan atas).
3. Tampal ke dalam SQL Editor → tekan **Run**.
4. Mesej yang betul: **Success. No rows returned**.

*(Pilihan, disyorkan)* Uji keselamatan: buat **New query** lagi, tampal **[supabase/test-rls.sql](supabase/test-rls.sql)**, tekan **Run**. Semua baris dalam lajur *keputusan* patut **LULUS**. Ujian ini tidak meninggalkan sebarang data.

### B3. Tetapan log masuk (penting)
Plan percuma Supabase hanya menghantar e-mel kepada ahli pasukan projek (2 e-mel sejam). Staf anda tidak akan menerima e-mel pengesahan, jadi matikan pengesahan e-mel:

1. Menu kiri → **Authentication** → **Sign In / Providers** (atau *Providers → Email*).
2. Matikan **Confirm email** → **Save**.
3. **Authentication** → **URL Configuration**:
   - **Site URL:** `https://adikxorntol.github.io/gep-help-web/`
   - **Redirect URLs** → **Add URL:** `https://adikxorntol.github.io/gep-help-web/`
   - **Save**.

### B4. Salin dua kunci awam
1. Menu kiri → **Project Settings** (ikon gear) → **Data API** / **API**.
2. Salin **Project URL** (contoh `https://abcdefgh.supabase.co`).
3. **Project Settings** → **API Keys**. Salin kunci **anon public** (tab *Legacy API keys*). Kalau hanya ada **Publishable key** (`sb_publishable_...`), salin yang itu.

> **JANGAN** salin kunci *service_role* atau *secret*. Kunci itu memberi kuasa penuh dan tidak boleh diletak dalam website. Kunci *anon/publishable* memang direka untuk awam; data anda dilindungi oleh peraturan keselamatan (RLS) dalam `schema.sql`.

---

## Bahagian C: Sambungkan website ke Supabase

1. Buka **https://github.com/AdikXorntol/gep-help-web/edit/main/web/config.js**.
2. Tampal dua kunci di antara tanda `'...'`:
   ```js
   window.GEP_CONFIG = {
     supabaseUrl: 'https://abcdefgh.supabase.co',
     supabaseAnonKey: 'eyJhbGciOi...'
   };
   ```
3. Tekan **Commit changes...** → **Commit changes**.
4. Tunggu 1–2 minit. Muat semula website. Banner "Mod demo" sepatutnya hilang dan 3 produk contoh dimuatkan dari pangkalan data.

---

## Bahagian D: Jadikan akaun anda admin

1. Di website, tekan **Log masuk** → **Daftar**. Isi nama, e-mel dan kata laluan (minimum 6 aksara).
2. Kembali ke Supabase → **SQL Editor** → **New query**.
3. Tampal **[supabase/make-admin.sql](supabase/make-admin.sql)**, tukar `emel.anda@contoh.com` (dua tempat) kepada e-mel yang anda daftar tadi → **Run**.
   Hasil yang betul: satu baris dengan **peranan = admin**.
4. Muat semula website → ikon akaun → **Panel admin**.

Siap! Anda boleh mula menambah tutorial.

---

## Kegunaan harian

- **Tambah tutorial:** Panel admin → Kandungan → *Tambah tutorial* → isi tajuk (BM wajib, EN pilihan) → Simpan → *Tambah langkah* → pilih screenshot → ketik pada gambar untuk letak bulatan/anak panah → tulis arahan → Simpan → **Terbitkan**.
- **Video:** muat naik ke YouTube sebagai *Unlisted*, salin pautan, tampal di ruang *Pautan video YouTube*.
- **Pengguna baharu:** minta mereka daftar sendiri di website. Mereka menjadi *Pengawal* secara automatik.
- **Peranan** (Panel admin → Pengguna):
  - *Pengawal*: tengok tutorial untuk semua sahaja.
  - *Staf*: tengok semua tutorial, termasuk yang ditanda *Staf sahaja*.
  - *Editor*: seperti staf, dan boleh tambah/ubah tutorial; perubahan menjadi draf sehingga admin menerbitkannya.
  - *Admin*: urus semua.
- **Tutorial untuk staf sahaja:** semasa edit tutorial, pilih *Siapa boleh tengok tutorial ini? → Staf sahaja*. Pengawal tidak nampak tutorial itu, langkahnya atau soalan di dalamnya, walaupun mereka ada pautannya. Produk yang hanya ada tutorial staf disembunyikan daripada pengawal.
- **Sembunyikan semua tutorial daripada orang yang belum log masuk:** Panel admin → Tetapan → hidupkan *Wajib log masuk*.
- **Butang WhatsApp:** Panel admin → Tetapan → nombor WhatsApp support (contoh `60123456789`).

## Bila website dikemas kini

Kadang-kadang ciri baharu memerlukan perubahan pada pangkalan data. Bila diberitahu, buka Supabase → **SQL Editor** → **New query**, tampal **[supabase/schema.sql](supabase/schema.sql)** terbaru → **Run**. Fail ini selamat dijalankan semula: data, pengguna dan tutorial anda tidak hilang, dan tutorial contoh tidak muncul semula.

Kalau website memaparkan *"Pangkalan data perlu dikemas kini"*, itu tandanya langkah ini belum dibuat.

## Perkara penting

- **Projek percuma berhenti selepas 7 hari tanpa aktiviti.** Aliran kerja *Keep Supabase awake* di GitHub menghantar satu permintaan kecil setiap 2 hari. Kalau projek tetap berhenti, buka Supabase → pilih projek → **Resume project** (data tidak hilang).
  GitHub mematikan jadual automatik selepas 60 hari tanpa sebarang commit. Kalau itu berlaku, buka tab **Actions → Keep Supabase awake → Enable workflow**.
- **Lupa kata laluan:** tanpa SMTP sendiri, e-mel tetapan semula tidak sampai kepada staf. Pilihan:
  - Staf yang masih log masuk boleh tukar kata laluan di **Akaun saya → Tukar kata laluan**.
  - Admin padam pengguna di Supabase → **Authentication → Users**, kemudian staf daftar semula (nota dan kegemaran mereka akan hilang).
  - Atau sambungkan SMTP percuma (contoh Brevo) di **Authentication → Emails → SMTP Settings**, supaya e-mel sampai kepada semua orang.
- **Had percuma Supabase:** 500 MB pangkalan data dan 1 GB storan. Gambar dikecilkan kepada kira-kira 100–200 KB, jadi 1 GB memuatkan beribu-ribu gambar. Video disimpan di YouTube, bukan di Supabase.
- **Gambar langkah boleh dibuka melalui pautan terus**, walaupun *Wajib log masuk* dihidupkan (pautannya panjang dan rawak). Jangan muat naik screenshot yang mengandungi maklumat sulit.
- Panel admin → Tetapan → **Cari gambar tidak digunakan** membersihkan storan bila perlu.
