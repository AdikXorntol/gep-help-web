# GEP Help (website)

Pusat tutorial bergambar dan video untuk **GEP APP**, **GEP OPS** dan **GEP LITE**, dalam Bahasa Malaysia dan English.

- **Website:** https://adikxorntol.github.io/gep-help-web/
- **Panel admin:** https://adikxorntol.github.io/gep-help-web/#/admin
- **Panduan setup (sekali sahaja):** [SETUP.md](SETUP.md)

Selagi `web/config.js` kosong, website berjalan dalam **mod demo** (data contoh dalam memori, tiada apa-apa disimpan).

## Apa yang ada
- Tutorial dengan langkah bernombor, gambar (boleh dizum) dan penanda merah (bulatan/anak panah), mod langkah demi langkah, dan pautan video YouTube.
- Dwibahasa BM/EN: butang **BM | EN** di setiap halaman; kandungan tutorial juga ada medan BM dan EN.
- Staf: nota peribadi, kegemaran, tanda "Dah faham", soalan/komen, cadang tutorial, laporkan masalah.
- Admin: tambah/edit/padam/susun produk, tutorial dan langkah; muat naik gambar (dikecilkan automatik); kotak masuk; urus peranan pengguna; tetapan WhatsApp dan "wajib log masuk".
- Editor: tambah dan edit tutorial sebagai draf; admin yang menerbitkan.
- Boleh dipasang ke skrin utama telefon (PWA) dan dibuka semula tanpa internet (salinan terakhir).

## Struktur
| Folder / fail | Isi |
|---|---|
| `web/` | Website (HTML/CSS/JS statik, tiada langkah build). Inilah yang diterbitkan ke GitHub Pages. |
| `web/config.js` | Satu-satunya fail yang perlu diubah: Project URL dan anon key Supabase. |
| `web/i18n/ms.json`, `en.json` | Semua teks antara muka dalam dua bahasa. |
| `supabase/schema.sql` | Jadual, keselamatan (RLS), storan gambar dan data contoh. Selamat dijalankan semula. |
| `supabase/make-admin.sql` | Jadikan akaun anda admin. |
| `supabase/test-rls.sql` | Ujian keselamatan yang boleh dijalankan dalam SQL Editor (tiada data kekal). |
| `tests/` | Ujian automatik (kamus, database, pelayar mod demo, pelayar dengan Supabase sebenar, Lighthouse). |
| `.github/workflows/` | Terbit ke GitHub Pages, jalankan ujian, dan "kejutkan" Supabase setiap 2 hari. |

## Ujian
Setiap push ke `main` menjalankan ujian di GitHub Actions: semakan kamus BM/EN, `schema.sql` dua kali, ujian RLS dalam Postgres dan dalam Supabase sebenar (`supabase start`), ujian pelayar untuk mod demo dan mod Supabase, serta Lighthouse mobile.

Jalankan secara tempatan:
```bash
python3 tests/check_i18n.py
tests/serve.sh &                                # http://127.0.0.1:8090/
python3 tests/e2e_demo.py http://127.0.0.1:8090/
PGHOST=... PGUSER=postgres tests/db/run_local.sh
```

## Kredit
Fon TeX Gyre Heros dan Heros Cn oleh GUST e-foundry, GUST Font License. Gambar contoh dalam `web/img/contoh/` dilukis oleh `tools/make_sample_images.py`.
