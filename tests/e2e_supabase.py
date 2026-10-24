"""End-to-end tests against a real (local) Supabase stack started with `supabase start`.

Env:   SUPABASE_URL, SUPABASE_ANON_KEY, DB_URL (postgres connection string for psql)
Usage: python3 tests/e2e_supabase.py http://127.0.0.1:8090/
Runs in GitHub Actions (see .github/workflows/test.yml). Exits 1 if any check fails.
"""
import json, os, subprocess, sys, tempfile, time, traceback
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8090/"
SB_URL = os.environ["SUPABASE_URL"]
SB_KEY = os.environ["SUPABASE_ANON_KEY"]
DB_URL = os.environ["DB_URL"]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web")
MS = json.load(open(os.path.join(ROOT, "i18n", "ms.json"), encoding="utf-8"))
EN = json.load(open(os.path.join(ROOT, "i18n", "en.json"), encoding="utf-8"))
CONFIG = "window.GEP_CONFIG = { supabaseUrl: %s, supabaseAnonKey: %s };" % (json.dumps(SB_URL), json.dumps(SB_KEY))
results, console_problems, expected_network = [], [], []
PAGES, CONTEXTS = {}, []
ART = os.environ.get("ARTIFACT_DIR", "test-artifacts")
PW = "Rahsia-123"


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond or not detail else "  -> " + str(detail)), flush=True)


def psql(sql):
    r = subprocess.run(["psql", DB_URL, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr)
    return r.stdout.strip()


REST = """path => fetch(%s + '/rest/v1/' + path, { headers: { apikey: %s } })
  .then(r => r.json().then(j => ({ status: r.status, count: Array.isArray(j) ? j.length : -1 })))""" % (json.dumps(SB_URL), json.dumps(SB_KEY))

# Same request, but signed in as whoever is logged in on that page (straight to the database API).
REST_ME = """path => {
  const k = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k));
  const tok = k ? JSON.parse(localStorage.getItem(k)).access_token : '';
  return fetch(%s + '/rest/v1/' + path, { headers: { apikey: %s, Authorization: 'Bearer ' + tok } })
    .then(r => r.json().then(j => ({ status: r.status, count: Array.isArray(j) ? j.length : -1 })));
}""" % (json.dumps(SB_URL), json.dumps(SB_KEY))


def poll(fn, expected, timeout=10):
    end = time.time() + timeout
    while time.time() < end:
        if fn() == expected:
            return True
        time.sleep(0.4)
    return False


def make_image(path):
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (720, 1280), "#ffffff")
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 720, 120], fill="#2E9A63")
    d.rounded_rectangle([110, 760, 610, 860], 24, fill="#13202D")
    im.save(path)


def context(browser, locale="ms-MY", lang="ms", sw=False, offline_ok=False):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale=locale, service_workers="allow" if sw else "block")
    ctx.tracing.start(screenshots=True, snapshots=True)
    CONTEXTS.append(ctx)
    ctx.route("**/config.js", lambda route: route.fulfill(status=200, content_type="application/javascript", body=CONFIG))
    script = "try{if(!localStorage.getItem('gep_welcome_seen'))localStorage.setItem('gep_welcome_seen','1')}catch(e){}"
    if lang:
        script += "try{if(!localStorage.getItem('gep_lang'))localStorage.setItem('gep_lang',JSON.stringify('%s'))}catch(e){}" % lang
    ctx.add_init_script(script)
    return ctx


def open_page(ctx, hash_=""):
    page = ctx.new_page()
    PAGES[len(PAGES)] = page
    page.on("console", lambda m: page_log.append("[%d] %s: %s" % (len(PAGES) - 1, m.type, m.text)))

    def on_console(m):
        if m.type not in ("error", "warning") or "Service Worker registration blocked" in m.text:
            return
        # Expected: HTTP 4xx from the permission tests and failed requests while offline.
        if m.text.startswith("Failed to load resource") or "ERR_INTERNET_DISCONNECTED" in m.text:
            expected_network.append(m.text)
            return
        console_problems.append("%s: %s" % (m.type, m.text))
    page.on("console", on_console)
    page.on("pageerror", lambda e: console_problems.append("pageerror: %s" % e))
    page.goto(BASE + hash_, wait_until="networkidle")
    ready(page)
    return page


def ready(page, timeout=20000):
    page.wait_for_function("window.GEPApp && GEPApp.S && !document.querySelector('.skel') && (GEPApp.st.refreshing || 0) === 0", timeout=timeout)


def go(page, hash_):
    page.evaluate("h => { location.hash = h; }", hash_)
    page.wait_for_timeout(200)
    ready(page)


def toast(page, timeout=10000):
    page.wait_for_selector("#toast.show", timeout=timeout)
    txt = page.inner_text("#toast")
    page.evaluate("() => { document.getElementById('toast').className = 'toast'; }")
    return txt


def until(page, js, arg=None, timeout=10000):
    try:
        page.wait_for_function(js, arg=arg, timeout=timeout)
        return True
    except Exception:
        return False


def sign_up(page, email, nama, lang_btn=None):
    page.click(".signin")
    if lang_btn:
        page.click(".sheet [data-act=lang][data-lang=%s]" % lang_btn)
    page.click("[data-act=auth-mode][data-mode=up]")
    page.fill("#au-nama", nama)
    page.fill("#au-emel", email)
    page.fill("#au-pw", PW)
    page.click("[data-form=auth] [type=submit]")
    page.wait_for_selector(".avatar", timeout=20000)
    toast(page)
    ready(page)


def sign_in(page, email, pw=PW):
    page.click(".signin")
    page.fill("#au-emel", email)
    page.fill("#au-pw", pw)
    page.click("[data-form=auth] [type=submit]")
    page.wait_for_selector(".avatar", timeout=20000)
    toast(page)
    ready(page)


def sign_out(page):
    go(page, "#/akaun")
    page.click("[data-act=logout]")
    page.wait_for_selector(".signin", timeout=15000)
    toast(page)
    ready(page)


def run(browser):
    tmp = tempfile.mkdtemp()
    img = os.path.join(tmp, "langkah.png")
    make_image(img)
    lite = "a0000000-0000-4000-8000-000000000003"

    # ---------------- guest sees seeded data ----------------
    gctx = context(browser)
    g = open_page(gctx)
    check("Mod Supabase aktif", g.evaluate("GEPApp.S.mode") == "supabase")
    check("Tetamu nampak 3 produk dari pangkalan data", g.locator("a.product").count() == 3)
    go(g, "#/t/b0000000-0000-4000-8000-000000000003")
    check("Tutorial contoh dengan 3 langkah bergambar", g.locator(".steps .step").count() == 3)
    check("Gambar contoh dimuatkan", until(g, "[...document.querySelectorAll('.steps img')].every(i => i.complete && i.naturalWidth > 0)"))
    check("Tetamu tidak nampak soalan (perlu log masuk)", MS["qa.signIn"] in g.inner_text("#qa-box"))
    rows = g.evaluate(REST, "profiles?select=*")
    check("Tetamu tidak boleh baca profil melalui API", rows["status"] >= 400 or rows["count"] == 0, rows)

    # ---------------- admin account ----------------
    actx = context(browser)
    a = open_page(actx)
    sign_up(a, "admin@gep.test", "Aina Admin")
    check("Profil dicipta dengan nama", psql("select nama || '|' || peranan from public.profiles where emel = 'admin@gep.test'") == "Aina Admin|pengawal")
    sql = open(os.path.join(ROOT, "..", "supabase", "make-admin.sql"), encoding="utf-8").read().replace("emel.anda@contoh.com", "admin@gep.test")
    r = subprocess.run(["psql", DB_URL, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], capture_output=True, text=True)
    check("make-admin.sql berjalan", r.returncode == 0 and "admin" in r.stdout, r.stderr or r.stdout)
    a.reload(wait_until="networkidle")
    ready(a)
    go(a, "#/admin")
    check("Admin masuk panel admin", a.locator(".tabs a").count() == 4)

    # create tutorial with an uploaded picture and markers
    go(a, "#/admin/t/baru?p=" + lite)
    a.fill("#ed-tajuk-ms", "Hantar laporan ringkas")
    a.fill("#ed-ring-ms", "Hantar laporan pendek dari tapak.")
    a.fill("#ed-vid-ms", "https://youtu.be/M7lc1UVf-VE")
    a.click("[data-form=adm-tut] [data-act=ltab][data-l=en]")
    a.fill("#ed-tajuk-en", "Send a quick report")
    a.click("[data-form=adm-tut] [data-intent=save]")
    toast(a)
    a.wait_for_selector("[data-act=adm-step-edit].add-btn")
    tid = a.evaluate("location.hash.split('/')[3].split('?')[0]")
    check("Tutorial baharu disimpan sebagai draf", psql("select status || '|' || video_url_ms from public.tutorial where id = '%s'" % tid) == "draf|https://www.youtube.com/watch?v=M7lc1UVf-VE")
    a.click("[data-act=adm-step-edit].add-btn")
    a.set_input_files(".sheet input[type=file]", img)
    a.wait_for_selector(".sheet .mk-stage img")
    until(a, "document.querySelector('.sheet .mk-stage img').complete")
    box = a.locator(".sheet .mk-stage").bounding_box()
    a.mouse.click(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.633)
    check("Bulatan diletak pada gambar", until(a, "!!document.querySelector('.sheet .mk-stage .mk-o')"), box)
    a.fill("#st-teks-ms", "Tekan butang Hantar.")
    a.click("[data-form=adm-step] [data-act=ltab][data-l=en]")
    a.fill("#st-teks-en", "Tap the Send button.")
    a.click("[data-form=adm-step] [type=submit]")
    t = toast(a, 30000)
    check("Langkah bergambar disimpan", t == MS["form.saved"], t)
    path = psql("select gambar_path from public.langkah where tutorial_id = '%s'" % tid)
    check("Gambar dimuat naik ke storan (dimampatkan)", path.startswith(tid + "/") and psql("select count(*) from storage.objects where bucket_id = 'langkah' and name = '%s'" % path) == "1", path)
    size = psql("select coalesce((metadata->>'size')::int, 0) from storage.objects where name = '%s'" % path)
    check("Saiz gambar di bawah 300 KB", 0 < int(size or 0) < 300 * 1024, size)
    check("Penanda disimpan sebagai JSON", psql("select penanda->0->>'t' from public.langkah where tutorial_id = '%s'" % tid) == "o")
    a.click("[data-act=adm-step-edit].add-btn")
    a.fill("#st-teks-ms", "Tunggu tanda berjaya.")
    a.click("[data-form=adm-step] [type=submit]")
    toast(a)
    a.wait_for_function("document.querySelectorAll('.adm-steps li').length === 2")
    a.click(".adm-steps li >> nth=1 >> [data-act=adm-step-move][data-dir='-1']")
    toast(a)
    check("Susunan langkah disimpan", psql("select string_agg(teks_ms, '|' order by susunan) from public.langkah where tutorial_id = '%s'" % tid) == "Tunggu tanda berjaya.|Tekan butang Hantar.")
    a.click("[data-form=adm-tut] [data-intent=terbit]")
    toast(a)
    check("Admin menerbitkan tutorial", psql("select status from public.tutorial where id = '%s'" % tid) == "terbit")
    go(a, "#/t/" + tid)
    check("Gambar dari storan dipaparkan", until(a, "[...document.querySelectorAll('.steps img')].length === 1 && [...document.querySelectorAll('.steps img')].every(i => i.complete && i.naturalWidth > 0)", timeout=15000))
    check("Penanda bulatan dipaparkan", a.locator(".steps .mk-o").count() == 1)

    # ---------------- staff account (chooses English at sign-up) ----------------
    sctx = context(browser, sw=True)
    s = open_page(sctx)
    sign_up(s, "staf@gep.test", "Kumar Staf", lang_btn="en")
    check("Bahasa daftar disimpan dalam profil", psql("select bahasa from public.profiles where emel = 'staf@gep.test'") == "en")
    sid = psql("select id from public.profiles where emel = 'staf@gep.test'")
    check("Pendaftaran baharu menjadi pengawal", psql("select peranan from public.profiles where id = '%s'" % sid) == "pengawal")

    # ---------------- staff-only tutorials and the guard role ----------------
    ops_t = "b0000000-0000-4000-8000-000000000002"
    go(a, "#/admin/t/" + ops_t)
    a.wait_for_selector("#ed-audiens")
    a.select_option("#ed-audiens", "staf")
    a.click("[data-form=adm-tut] [data-intent=save]")
    toast(a)
    check("Admin menjadikan tutorial staf sahaja", psql("select audiens || '|' || status from public.tutorial where id = '%s'" % ops_t) == "staf|terbit")
    s.reload(wait_until="networkidle")
    ready(s)
    check("Pengawal tidak nampak produk yang hanya ada tutorial staf", "GEP OPS" not in s.inner_text("main") and s.locator("a.product").count() == 2)
    go(s, "#/t/" + ops_t)
    s.wait_for_function("!document.querySelector('.skel') && (GEPApp.st.refreshing || 0) === 0")
    check("Pengawal tidak boleh buka tutorial staf melalui pautan", EN["notfound.title"] in s.inner_text("main"))
    rows = s.evaluate(REST_ME, "tutorial?select=id&id=eq." + ops_t)
    check("Pangkalan data menolak tutorial staf untuk pengawal (API)", rows["status"] == 200 and rows["count"] == 0, rows)
    rows = s.evaluate(REST_ME, "langkah?select=id&tutorial_id=eq." + ops_t)
    check("Pangkalan data menolak langkah tutorial staf untuk pengawal (API)", rows["status"] == 200 and rows["count"] == 0, rows)
    rows = g.evaluate(REST, "tutorial?select=id&id=eq." + ops_t)
    check("Tetamu juga tidak nampak tutorial staf (API)", rows["count"] == 0, rows)
    go(a, "#/admin/pengguna")
    a.wait_for_selector("select[data-role-for='%s']" % sid)
    a.select_option("select[data-role-for='%s']" % sid, "staf")
    check("Admin menaikkan pengawal menjadi staf", toast(a) == MS["users.saved"] and psql("select peranan from public.profiles where id = '%s'" % sid) == "staf")
    s.reload(wait_until="networkidle")
    ready(s)
    go(s, "#/t/" + ops_t)
    s.wait_for_selector(".banner.staff", timeout=15000)
    check("Staf nampak tutorial staf sahaja", "GEP OPS" in s.inner_text("main"))
    go(s, "#/t/" + tid)
    check("Staf nampak tutorial terbit (EN)", "Send a quick report" in s.inner_text("main"))
    check("Langkah tanpa EN memaparkan label belum diterjemah", EN["i18n.notTranslated"] in s.inner_text(".steps"))
    s.fill("[data-form=note] textarea", "My private note")
    s.click("[data-form=note] [type=submit]")
    check("Nota disimpan", toast(s) == EN["note.saved"])
    s.click("[data-act=fav]")
    check("Kegemaran disimpan", toast(s) == EN["fav.added"])
    s.wait_for_selector("[data-form=ask]")
    s.fill("[data-form=ask] textarea", "Does this work offline?")
    s.click("[data-form=ask] [type=submit]")
    check("Soalan dihantar", toast(s) == EN["qa.sent"])
    s.click("[data-act=understood]")
    toast(s)
    check("Data peribadi dalam pangkalan data", psql("select concat((select count(*) from public.nota where user_id='%s'), (select count(*) from public.kegemaran where user_id='%s'), (select count(*) from public.ditonton where user_id='%s'), (select count(*) from public.soalan where user_id='%s'))" % (sid, sid, sid, sid)) == "1111")
    check("Nama penanya diisi oleh pangkalan data", psql("select nama from public.soalan where user_id = '%s'" % sid) == "Kumar Staf")
    err = s.evaluate("() => GEPApp.S.saveProduk({kod:'HACK', nama_ms:'Hack', warna:'#FFFFFF'}).then(() => 'ok', e => e.code)")
    check("Staf disekat menulis produk (RLS)", err == "permission", err)
    err = s.evaluate("id => GEPApp.S.setRole(id, 'admin').then(() => 'ok', e => e.code)", sid)
    check("Staf disekat menaikkan peranan sendiri", err != "ok" and psql("select peranan from public.profiles where id = '%s'" % sid) == "staf", err)
    err = s.evaluate("t => GEPApp.S.saveTutorial({id: t, tajuk_ms: 'Diceroboh'}).then(() => 'ok', e => e.code)", tid)
    check("Staf disekat mengubah tutorial", err == "permission" and psql("select tajuk_ms from public.tutorial where id = '%s'" % tid) == "Hantar laporan ringkas", err)
    go(s, "#/admin")
    check("Staf tidak boleh buka panel admin", s.locator(".tabs").count() == 0)

    # language follows the account to a fresh device
    s2ctx = context(browser, lang=None, locale="ms-MY")
    s2 = open_page(s2ctx)
    check("Peranti baharu bermula dalam BM", s2.evaluate("document.documentElement.lang") == "ms")
    sign_in(s2, "staf@gep.test")
    check("Bahasa akaun (EN) diguna pada peranti lain", until(s2, "document.documentElement.lang === 'en'"))
    s2.click("[data-act=lang][data-lang=ms] >> nth=0")
    check("Tukar bahasa disimpan ke profil", poll(lambda: psql("select bahasa from public.profiles where id = '%s'" % sid), "ms"))
    s2.click("[data-act=lang][data-lang=en] >> nth=0")
    check("Tukar semula ke EN disimpan", poll(lambda: psql("select bahasa from public.profiles where id = '%s'" % sid), "en"))
    s2ctx.close()

    # ---------------- admin answers in the inbox ----------------
    go(a, "#/admin/kotak")
    a.click("[data-act=inbox-reload]")
    a.wait_for_selector(".inbox li:has-text('Does this work offline?')", timeout=15000)
    a.click(".inbox li:has-text('Does this work offline?') [data-act=qa-answer]")
    a.fill("#qa-t", "Yes, the last copy stays on your phone.")
    a.click("[data-form=qa-text] [type=submit]")
    toast(a)
    check("Jawapan admin disimpan", psql("select jawapan <> '' and dijawab_pada is not null from public.soalan where user_id = '%s'" % sid) == "t")
    s.reload(wait_until="networkidle")
    ready(s)
    go(s, "#/t/" + tid)
    s.wait_for_selector(".qa-a", timeout=15000)
    check("Staf nampak jawapan admin", "Yes, the last copy stays" in s.inner_text("#qa"))

    # ---------------- editor workflow ----------------
    ectx = context(browser)
    e = open_page(ectx)
    sign_up(e, "editor@gep.test", "Hafiz Editor")
    eid = psql("select id from public.profiles where emel = 'editor@gep.test'")
    # The editor asks for the role from their account page; the admin approves it.
    go(e, "#/akaun")
    e.wait_for_selector("[data-act=role-req]", timeout=15000)
    e.click("[data-act=role-req]")
    e.check("[data-form=role-req] input[value=editor]")
    e.fill("#rq-s", "Saya tulis tutorial untuk pasukan.")
    e.click("[data-form=role-req] [type=submit]")
    check("Permohonan peranan dihantar", toast(e) == MS["reqrole.sent"])
    check("Permohonan disimpan dengan butiran pemohon", psql("select status || '|' || peranan || '|' || peranan_semasa || '|' || nama from public.permohonan_peranan where user_id = '%s'" % eid) == "baru|editor|pengawal|Hafiz Editor")
    rows = e.evaluate(REST_ME, "permohonan_peranan?select=id")
    check("Pemohon hanya nampak permohonan sendiri (API)", rows["status"] == 200 and rows["count"] == 1, rows)
    check("Pemohon tidak boleh meluluskan sendiri (API)", e.evaluate("id => GEPApp.S.listMyRoleRequests().then(r => GEPApp.S.decideRoleRequest(r[0].id, 'diluluskan')).then(() => 'ok', e => e.code)", eid) != "ok"
          and psql("select peranan from public.profiles where id = '%s'" % eid) == "pengawal")
    go(a, "#/admin/pengguna")
    a.wait_for_selector(".reqs li:has-text('Hafiz Editor')", timeout=15000)
    check("Tab Pengguna menunjukkan lencana permohonan", a.locator(".tabs a[href='#/admin/pengguna'] .badge").count() == 1)
    a.click(".reqs li:has-text('Hafiz Editor') [data-act=req-decide][data-s=diluluskan]")
    toast(a)
    check("Admin meluluskan permohonan: peranan dinaikkan", psql("select peranan from public.profiles where id = '%s'" % eid) == "editor"
          and psql("select status from public.permohonan_peranan where user_id = '%s'" % eid) == "diluluskan")
    check("Senarai pengguna menunjukkan peranan baharu", a.input_value("select[data-role-for='%s']" % eid) == "editor")
    e.reload(wait_until="networkidle")
    ready(e)
    go(e, "#/admin/t/" + tid)
    e.wait_for_selector("[data-form=adm-tut]")
    check("Editor tiada butang Terbitkan", e.locator("[data-intent=terbit]").count() == 0)
    e.fill("#ed-tajuk-ms", "Hantar laporan ringkas (v2)")
    e.click("[data-form=adm-tut] [data-intent=save]")
    check("Suntingan editor menjadi draf", toast(e) == MS["admin.editorBackToDraft"] and psql("select status from public.tutorial where id = '%s'" % tid) == "draf")
    s.reload(wait_until="networkidle")
    ready(s)
    go(s, "#/p/" + lite)
    check("Staf tidak nampak draf", s.locator("a[href='#/t/%s']" % tid).count() == 0 and s.locator("a.lesson").count() >= 1)
    err = e.evaluate("() => GEPApp.S.deleteProduk('a0000000-0000-4000-8000-000000000001').then(() => 'ok', e => e.code)")
    check("Editor disekat memadam produk", err == "permission" and psql("select count(*) from public.produk") == "3", err)
    a.reload(wait_until="networkidle")
    ready(a)
    go(a, "#/admin/t/" + tid)
    a.wait_for_selector("[data-intent=terbit]", timeout=15000)
    a.click("[data-intent=terbit]")
    toast(a)
    check("Admin meluluskan suntingan editor", psql("select status from public.tutorial where id = '%s'" % tid) == "terbit")

    # ---------------- suggestions, reports, status ----------------
    go(s, "#/")
    s.click(".foot-card [data-act=suggest]")
    s.fill("#sg-t", "Export reports")
    s.click("[data-form=suggest] [type=submit]")
    check("Cadangan dihantar", toast(s) == EN["suggest.thanks"])
    go(s, "#/t/" + tid)
    s.click("[data-act=report]")
    s.fill("#rp-b", "Picture is blurry")
    s.click("[data-form=report] [type=submit]")
    check("Laporan dihantar", toast(s) == EN["report.thanks"])
    go(a, "#/admin/kotak")
    a.click("[data-act=inbox-reload]")
    a.wait_for_selector(".inbox")
    a.click("[data-act=inbox-tab][data-k=cadangan]")
    a.click(".inbox li:has-text('Export reports') [data-act=inbox-status][data-s=selesai]")
    toast(a)
    check("Status cadangan dikemas kini", psql("select status from public.cadangan where tajuk = 'Export reports'") == "selesai")

    # ---------------- settings: WhatsApp + require sign-in ----------------
    go(a, "#/admin/tetapan")
    a.fill("#set-wa", "60123456789")
    a.check("#set-wajib", force=True)
    a.click("[data-form=adm-settings] [type=submit]")
    toast(a)
    check("Tetapan disimpan", psql("select whatsapp || '|' || wajib_log_masuk from public.tetapan") == "60123456789|true")
    g.reload(wait_until="networkidle")
    ready(g)
    check("Wajib log masuk: tetamu nampak dinding log masuk", MS["wall.title"] in g.inner_text("main") and g.locator("a.product").count() == 0)
    n = g.evaluate(REST, "tutorial?select=id")
    check("Wajib log masuk: API tidak memulangkan tutorial kepada tetamu", n["count"] == 0, n)
    a.uncheck("#set-wajib", force=True)
    a.click("[data-form=adm-settings] [type=submit]")
    toast(a)

    # ---------------- unused pictures ----------------
    orphan = a.evaluate("""t => new Promise(res => { const c = document.createElement('canvas'); c.width = c.height = 40; c.toBlob(b => res(b), 'image/png'); })
      .then(b => GEPApp.S.uploadImage(t, { blob: b, type: 'image/png', ext: 'png' }))""", tid)
    check("Gambar yatim dicipta untuk ujian", psql("select count(*) from storage.objects where name = '%s'" % orphan) == "1")
    a.click("[data-act=orphans-find]")
    a.wait_for_selector("[data-act=orphans-del]", timeout=15000)
    check("Gambar yatim dijumpai", (MS["settings.orphansFound.one"]) in a.inner_text("main"))
    a.click("[data-act=orphans-del]")
    a.click("[data-act=confirm-yes]")
    toast(a)
    check("Gambar yatim dipadam dari storan", psql("select count(*) from storage.objects where name = '%s'" % orphan) == "0")

    # ---------------- offline copy ----------------
    s.evaluate("() => navigator.serviceWorker.ready")
    s.reload(wait_until="networkidle")
    s.wait_for_function("navigator.serviceWorker.controller !== null", timeout=15000)
    ready(s)
    go(s, "#/t/" + tid)
    until(s, "[...document.querySelectorAll('.steps img')].every(i => i.complete && i.naturalWidth > 0)", timeout=15000)
    sctx.set_offline(True)
    s.reload(wait_until="load")
    ok = until(s, "window.GEPApp && GEPApp.st && !GEPApp.st.loading", timeout=20000)
    check("Luar talian: website dibuka", ok)
    check("Luar talian: banner luar talian dipaparkan", until(s, "!!document.querySelector('.banner.off')"))
    check("Luar talian: tutorial dari salinan terakhir", "Send a quick report" in s.inner_text("main") or "Hantar laporan ringkas" in s.inner_text("main"))
    check("Luar talian: gambar dari cache", until(s, "[...document.querySelectorAll('.steps img')].length > 0 && [...document.querySelectorAll('.steps img')].every(i => i.complete && i.naturalWidth > 0)", timeout=15000))
    sctx.set_offline(False)
    s.reload(wait_until="networkidle")
    ready(s)

    # ---------------- password change and wrong password ----------------
    go(s, "#/akaun")
    s.click("[data-act=new-password]")
    s.fill("#np1", "BaruRahsia-456")
    s.fill("#np2", "BaruRahsia-456")
    s.click("[data-form=newpw] [type=submit]")
    check("Kata laluan ditukar", toast(s) == EN["auth.passwordChanged"])
    sign_out(s)
    s.click(".signin")
    s.fill("#au-emel", "staf@gep.test")
    s.fill("#au-pw", PW)
    s.click("[data-form=auth] [type=submit]")
    s.wait_for_selector("[data-form=auth] .err:not(:empty)", timeout=15000)
    check("Kata laluan lama ditolak", s.inner_text("[data-form=auth] .err") in (EN["err.auth-wrong"], MS["err.auth-wrong"]))
    s.keyboard.press("Escape")
    sign_in(s, "staf@gep.test", "BaruRahsia-456")
    check("Log masuk dengan kata laluan baharu", s.locator(".avatar").count() == 1)

    # ---------------- deleting cleans up pictures ----------------
    go(a, "#/admin/t/" + tid)
    a.wait_for_selector(".adm-steps li")
    img_li = a.locator(".adm-steps li:has(.st-thumb img)")
    img_li.locator("[data-act=adm-step-del]").click()
    a.click("[data-act=confirm-yes]")
    toast(a)
    check("Padam langkah membuang gambarnya dari storan", psql("select count(*) from storage.objects where name = '%s'" % path) == "0")
    a.click("[data-act=adm-tut-del]")
    a.click("[data-act=confirm-yes]")
    toast(a)
    check("Tutorial dipadam bersama data berkaitan", psql("select (select count(*) from public.tutorial where id='%s') + (select count(*) from public.langkah where tutorial_id='%s') + (select count(*) from public.soalan where tutorial_id='%s')" % (tid, tid, tid)) == "0")

    for c in (gctx, actx, sctx, ectx):
        c.close()


page_log = []


def dump():
    os.makedirs(ART, exist_ok=True)
    for i, pg in PAGES.items():
        try:
            if pg.is_closed():
                continue
            pg.screenshot(path=os.path.join(ART, "page-%d.png" % i), full_page=False)
            info = pg.evaluate("""() => ({ hash: location.hash, body: document.body.className, history: history.length,
              layers: document.getElementById('layers').innerHTML.slice(0, 1500),
              main: (document.querySelector('main') || document.body).innerText.slice(0, 600) })""")
            print("---- page %d: %s" % (i, json.dumps(info, ensure_ascii=False)[:2500]))
        except Exception as e:
            print("---- page %d: dump failed %s" % (i, e))
    for j, c in enumerate(CONTEXTS):
        try:
            c.tracing.stop(path=os.path.join(ART, "trace-%d.zip" % j))
        except Exception:
            pass
    open(os.path.join(ART, "console.log"), "w").write("\n".join(page_log))


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            run(browser)
        except Exception:
            traceback.print_exc()
            check("Ujian Supabase berjalan hingga habis", False)
            dump()
        browser.close()
    check("Tiada ralat atau amaran konsol", not console_problems, console_problems[:8])
    failed = [r for r in results if not r[1]]
    print("\n%d/%d ujian Supabase LULUS" % (len(results) - len(failed), len(results)))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
