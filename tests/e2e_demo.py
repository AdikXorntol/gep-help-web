"""End-to-end browser tests for GEP Help in demo mode (no Supabase needed).

Usage:  python3 tests/e2e_demo.py http://127.0.0.1:8090/
Needs:  pip install playwright && playwright install chromium
Every check prints PASS/FAIL; the script exits 1 if anything fails.
"""
import json, os, re, sys, tempfile, traceback
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8090/"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web")
MS = json.load(open(os.path.join(ROOT, "i18n", "ms.json"), encoding="utf-8"))
EN = json.load(open(os.path.join(ROOT, "i18n", "en.json"), encoding="utf-8"))
results = []
console_problems = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond or not detail else "  -> " + str(detail)))


def make_image(path, w=600, h=1000):
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (w, h), "#ffffff")
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w, 80], fill="#2563B8")
    d.rounded_rectangle([100, 600, 500, 680], 20, fill="#17803D")
    im.save(path)


def new_page(browser, width=390, height=844, locale="ms-MY", welcome_seen=True, lang="ms", sw=False):
    ctx = browser.new_context(viewport={"width": width, "height": height}, locale=locale,
                              service_workers="allow" if sw else "block")
    script = ""
    if welcome_seen:
        script += "try{if(!localStorage.getItem('gep_welcome_seen'))localStorage.setItem('gep_welcome_seen','1')}catch(e){}"
    if lang:
        script += "try{if(!localStorage.getItem('gep_lang'))localStorage.setItem('gep_lang',JSON.stringify('%s'))}catch(e){}" % lang
    if script:
        ctx.add_init_script(script)
    page = ctx.new_page()

    def on_console(m):
        if m.type in ("error", "warning"):
            console_problems.append("%s: %s" % (m.type, m.text))
    page.on("console", on_console)
    page.on("pageerror", lambda e: console_problems.append("pageerror: %s" % e))
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_selector("#app main, #app .page, #app .mast")
    page.wait_for_function("!document.querySelector('.skel')")
    return ctx, page


def go(page, hash_):
    page.evaluate("h => { location.hash = h; }", hash_)
    page.wait_for_timeout(150)


def wait_until(page, js, arg=None, timeout=5000):
    try:
        page.wait_for_function(js, arg=arg, timeout=timeout)
        return True
    except Exception:
        return False


def toast(page):
    page.wait_for_selector("#toast.show", timeout=5000)
    return page.inner_text("#toast")


def wait_toast_gone(page):
    page.evaluate("() => { const t = document.getElementById('toast'); t.className = 'toast'; }")


def login(page, role):
    page.click(".signin, [data-act=login] >> nth=0")
    page.wait_for_selector(".demo-pick")
    page.click("[data-act=demo-as][data-role=%s]" % role)
    page.wait_for_selector(".avatar")
    page.wait_for_function("!document.querySelector('.skel') && GEPApp.st.refreshing === 0")
    wait_toast_gone(page)


def logout(page):
    go(page, "#/akaun")
    page.click("[data-act=logout]")
    page.wait_for_selector(".signin")
    page.wait_for_function("GEPApp.st.refreshing === 0")
    wait_toast_gone(page)


def no_overflow(page):
    return page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1")


def small_targets(page):
    # Interactive elements smaller than 44x44 (inline links inside sentences are exempt).
    return page.evaluate("""() => {
      const out = [];
      document.querySelectorAll('button, a[href], input:not([type=hidden]):not(.vh), select, textarea, [role=tab]').forEach(el => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || el.closest('[hidden],[inert]')) return;
        if (el.tagName === 'A' && el.closest('p, .inbox li > p')) return;
        if (el.type === 'radio' || el.type === 'checkbox') return;
        if (r.height < 43.5 || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT' && r.width < 43.5))
          out.push((el.className || el.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30));
      });
      return out;
    }""")


def unnamed_controls(page):
    return page.evaluate("""() => {
      const out = [];
      document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea').forEach(el => {
        if (el.closest('[hidden]') || el.type === 'radio') return;
        const name = (el.getAttribute('aria-label') || el.textContent || el.title || '').trim();
        const lab = el.id && document.querySelector('label[for="' + el.id + '"]');
        const wrap = el.closest('label');
        if (!name && !lab && !wrap) out.push(el.outerHTML.slice(0, 80));
      });
      document.querySelectorAll('img').forEach(img => { if (!img.hasAttribute('alt')) out.push('img without alt ' + img.src.slice(-30)); });
      return out;
    }""")


def leftover_ms(page):
    """BM interface strings still visible after switching to English."""
    text = page.evaluate("() => document.body.innerText")
    left = []
    for k, v in MS.items():
        if len(v) < 14 or v == EN.get(k) or "{" in v:
            continue
        if v in text:
            left.append(v)
    return left


def run(browser):
    tmp = tempfile.mkdtemp()
    img = os.path.join(tmp, "langkah.png")
    make_image(img)

    # ---------------- welcome ----------------
    ctx, page = new_page(browser, welcome_seen=False, lang=None, locale="ms-MY")
    check("Skrin aluan muncul pada lawatan pertama", page.is_visible(".welcome"))
    check("Bahasa pertama ikut pelayar (ms → BM)", page.evaluate("document.documentElement.lang") == "ms")
    page.click(".welcome [data-act=lang][data-lang=en]")
    check("Tukar bahasa dalam skrin aluan", "Welcome to GEP Help" in page.inner_text(".welcome") and page.evaluate("document.documentElement.lang") == "en")
    page.click(".welcome [data-act=lang][data-lang=ms]")
    page.click("[data-act=w-next]")
    page.wait_for_timeout(350)
    check("Slaid 2 aluan", page.evaluate("document.querySelector('.w-slide[aria-hidden=false] h2').textContent") == MS["welcome.2.title"])
    page.click("[data-act=w-next]")
    page.wait_for_timeout(350)
    page.click(".w-next[data-act=w-done]")
    page.wait_for_timeout(200)
    check("Aluan ditutup selepas Mula", not page.is_visible(".welcome"))
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(500)
    check("Aluan tidak muncul lagi selepas dimuat semula", not page.is_visible(".welcome"))
    page.click("[data-act=welcome]")
    check("Aluan boleh dilihat semula", page.is_visible(".welcome"))
    page.keyboard.press("Escape")
    page.wait_for_timeout(150)
    check("Aluan boleh ditutup dengan Escape", not page.is_visible(".welcome"))
    ctx.close()

    ctx, page = new_page(browser, welcome_seen=False, lang=None, locale="en-US")
    check("Bahasa pertama ikut pelayar (en → English)", page.evaluate("document.documentElement.lang") == "en" and "Welcome to GEP Help" in page.inner_text(".welcome"))
    ctx.close()

    # ---------------- language on every main screen ----------------
    ctx, page = new_page(browser)
    login(page, "admin")
    screens = ["#/", "#/p/a0000000-0000-4000-8000-000000000001", "#/t/b0000000-0000-4000-8000-000000000001",
               "#/t/b0000000-0000-4000-8000-000000000001/s/2", "#/akaun", "#/admin", "#/admin/kotak", "#/admin/pengguna",
               "#/admin/tetapan", "#/admin/t/b0000000-0000-4000-8000-000000000001"]
    for h in screens:
        go(page, h)
        page.wait_for_timeout(250)
        page.click("[data-act=lang][data-lang=en] >> nth=0")
        page.wait_for_timeout(200)
        left = leftover_ms(page)
        check("EN tanpa teks BM tertinggal: " + h, page.evaluate("document.documentElement.lang") == "en" and not left, left[:3])
        page.click("[data-act=lang][data-lang=ms] >> nth=0")
        page.wait_for_timeout(200)
        check("Kembali ke BM: " + h, page.evaluate("document.documentElement.lang") == "ms" and MS["lang.label"] in page.evaluate("document.querySelector('.lang').getAttribute('aria-label')"))
    go(page, "#/")
    page.click("[data-act=lang][data-lang=en] >> nth=0")
    page.reload(wait_until="networkidle")
    page.wait_for_function("!document.querySelector('.skel')")
    check("Pilihan bahasa kekal selepas muat semula", page.evaluate("document.documentElement.lang") == "en")
    page.click("[data-act=lang][data-lang=ms] >> nth=0")
    ctx.close()

    # Fallback when English content is missing
    ctx, page = new_page(browser, lang="en")
    go(page, "#/t/b0000000-0000-4000-8000-000000000012")
    page.wait_for_timeout(200)
    body = page.inner_text("main")
    check("Fallback ke BM dengan label 'Not translated yet'", "Hantar laporan insiden" in body and EN["i18n.notTranslated"] in body)
    ctx.close()

    # ---------------- guest browsing, step mode, zoom, video ----------------
    ctx, page = new_page(browser)
    check("Laman utama memaparkan 3 produk", page.locator("a.product").count() == 3)
    page.fill("#q", "laporan")
    page.wait_for_timeout(300)
    check("Carian menjumpai tutorial", page.locator("#results a.lesson").count() >= 1 and "Hantar laporan insiden" in page.inner_text("#results"))
    page.fill("#q", "zzzzqqq")
    page.wait_for_timeout(300)
    check("Carian tiada hasil memaparkan keadaan kosong", MS["search.none"] in page.inner_text("#results"))
    page.fill("#q", "")
    page.wait_for_timeout(300)
    page.click("a.product >> nth=0")
    page.wait_for_selector(".p-head")
    check("Halaman produk", page.locator("ol.log a.lesson").count() == 3)
    page.click("ol.log a.lesson >> nth=0")
    page.wait_for_selector(".steps")
    check("Halaman tutorial: 3 langkah bergambar", page.locator(".steps .step").count() == 3 and page.locator(".steps .shot img").count() == 3)
    check("Penanda bulatan dan anak panah dipaparkan", page.locator(".steps .mk-o").count() == 1 and page.locator(".steps .mk-a").count() == 1)
    page.click(".steps .shot >> nth=0")
    page.wait_for_selector(".lightbox")
    check("Zoom gambar dibuka", page.is_visible(".lightbox img"))
    w1 = page.evaluate("document.querySelector('.lb-img').getBoundingClientRect().width")
    page.click("[data-act=lb-zoom]")
    w2 = page.evaluate("document.querySelector('.lb-img').getBoundingClientRect().width")
    check("Butang zum membesarkan gambar", w2 > w1 * 1.8, (w1, w2))
    page.go_back()
    page.wait_for_timeout(250)
    check("Butang Back menutup zoom tanpa meninggalkan halaman", not page.is_visible(".lightbox") and "/t/b0000000-0000-4000-8000-000000000001" in page.url)
    page.click("[data-act=video]")
    page.wait_for_selector(".videobox iframe")
    src = page.get_attribute(".videobox iframe", "src")
    check("Video YouTube dibenamkan (nocookie)", src.startswith("https://www.youtube-nocookie.com/embed/M7lc1UVf-VE"), src)
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)
    check("Escape menutup video", not page.is_visible(".videobox"))
    page.click("a.cta[href$='/s/1']")
    page.wait_for_selector(".stepmode")
    check("Mod langkah: Langkah 1 daripada 3", page.inner_text(".sm-count") == "Langkah 1 daripada 3")
    page.click("[data-act=step-go][data-n='2']")
    page.wait_for_timeout(150)
    check("Seterusnya → langkah 2", page.inner_text(".sm-count") == "Langkah 2 daripada 3")
    page.keyboard.press("ArrowRight")
    page.wait_for_timeout(150)
    check("Kekunci → ke langkah 3", page.inner_text(".sm-count") == "Langkah 3 daripada 3")
    page.keyboard.press("ArrowLeft")
    page.wait_for_timeout(150)
    check("Kekunci ← ke langkah 2", page.inner_text(".sm-count") == "Langkah 2 daripada 3")
    check("Bar kemajuan", page.get_attribute(".sm-bar", "aria-valuenow") == "2")
    go(page, "#/")
    page.wait_for_timeout(200)
    check("Kad 'Teruskan' di laman utama", page.locator("a.cont").count() == 1 and "Langkah 2 daripada 3" in page.inner_text("a.cont"))
    page.click("a.cont")
    page.wait_for_selector(".stepmode")
    page.click("[data-act=step-go][data-n='3']")
    page.wait_for_timeout(150)
    page.click("[data-act=step-finish]")
    page.wait_for_selector(".t-title")
    check("Selesai menandakan tutorial faham (tetamu)", page.is_visible(".done-ok"))
    page.click("[data-act=fav]")
    page.wait_for_selector(".sheet")
    check("Tetamu diminta log masuk untuk kegemaran", page.is_visible("[data-form=auth]"))
    page.keyboard.press("Escape")
    ctx.close()

    # ---------------- staff: notes, favourites, questions, suggestions, reports ----------------
    ctx, page = new_page(browser)
    login(page, "staf")
    go(page, "#/t/b0000000-0000-4000-8000-000000000003")
    page.wait_for_selector(".t-title")
    page.fill("textarea[name=teks] >> nth=0", "Nota ujian saya")
    page.click("[data-form=note] [type=submit]")
    check("Nota disimpan", toast(page) == MS["note.saved"])
    wait_toast_gone(page)
    check("Nota kekal dalam borang", page.input_value("[data-form=note] textarea") == "Nota ujian saya")
    page.fill("[data-form=note] textarea", "Nota diubah")
    page.click("[data-form=note] [type=submit]")
    toast(page); wait_toast_gone(page)
    page.click("[data-act=note-del]")
    page.click("[data-act=confirm-yes]")
    check("Nota dipadam", toast(page) == MS["note.deleted"])
    wait_toast_gone(page)
    check("Borang nota kosong selepas padam", page.input_value("[data-form=note] textarea") == "")
    page.click("[data-act=fav]")
    check("Kegemaran sedia ada dibuang", toast(page) == MS["fav.removed"])
    wait_toast_gone(page)
    page.click("[data-act=fav]")
    check("Kegemaran ditambah", toast(page) == MS["fav.added"])
    wait_toast_gone(page)
    check("Butang kegemaran aria-pressed", page.get_attribute("[data-act=fav]", "aria-pressed") == "true")
    page.wait_for_selector(".qa-list")
    check("Soalan sedia ada dimuatkan", "Boleh guna GEP LITE tanpa internet?" in page.inner_text("#qa"))
    page.fill("[data-form=ask] textarea", "Soalan ujian automatik?")
    page.click("[data-form=ask] [type=submit]")
    check("Soalan dihantar", toast(page) == MS["qa.sent"])
    wait_toast_gone(page)
    check("Soalan baharu dipaparkan", "Soalan ujian automatik?" in page.inner_text("#qa"))
    page.click(".qa:has-text('Soalan ujian automatik?') [data-act=qa-edit]")
    page.fill("#qa-t", "Soalan ujian automatik (diubah)?")
    page.click("[data-form=qa-text] [type=submit]")
    toast(page); wait_toast_gone(page)
    check("Soalan sendiri boleh diubah", "Soalan ujian automatik (diubah)?" in page.inner_text("#qa"))
    check("Staf tiada butang Jawab", page.locator("#qa [data-act=qa-answer]").count() == 0)
    page.click("[data-act=understood]")
    toast(page); wait_toast_gone(page)
    check("Dah faham ditanda", page.is_visible(".done-ok"))
    page.click("[data-act=report]")
    page.check("input[name=jenis][value=gambar]")
    page.fill("#rp-b", "Gambar kabur")
    page.click("[data-form=report] [type=submit]")
    check("Laporan dihantar", toast(page) == MS["report.thanks"])
    wait_toast_gone(page)
    go(page, "#/")
    page.wait_for_timeout(200)
    check("Kegemaran dipaparkan di laman utama", "Pasang & log masuk GEP LITE" in page.inner_text("main") and MS["home.favourites"] in page.inner_text("main"))
    page.click(".foot-card [data-act=suggest]")
    page.click("[data-form=suggest] [type=submit]")
    check("Cadangan tanpa topik ditolak", page.inner_text("[data-form=suggest] .err") == MS["suggest.needTopic"])
    page.fill("#sg-t", "Cara tukar kata laluan")
    page.select_option("#sg-p", "a0000000-0000-4000-8000-000000000002")
    page.click("[data-form=suggest] [type=submit]")
    check("Cadangan dihantar", toast(page) == MS["suggest.thanks"])
    wait_toast_gone(page)
    go(page, "#/akaun")
    page.wait_for_selector("#my-sugg ul")
    check("Cadangan saya disenaraikan", "Cara tukar kata laluan" in page.inner_text("#my-sugg"))
    page.fill("#acct-nama", "Kumar Baru")
    page.click("[data-form=profile] [type=submit]")
    toast(page); wait_toast_gone(page)
    check("Nama profil dikemas kini", page.input_value("#acct-nama") == "Kumar Baru")
    go(page, "#/admin")
    page.wait_for_timeout(200)
    check("Staf tidak boleh masuk panel admin", MS["admin.noAccess"] in page.inner_text("main") and page.locator(".tabs").count() == 0)
    err = page.evaluate("() => GEPApp.S.saveProduk({kod:'X', nama_ms:'Hack', warna:'#FFFFFF'}).then(() => 'ok', e => e.code)")
    check("Staf disekat menulis produk melalui API", err == "permission", err)
    err = page.evaluate("() => GEPApp.S.answerSoalan('x', 'y').then(() => 'ok', e => e.code)")
    check("Staf disekat menjawab soalan melalui API", err == "permission", err)
    check("Laman staf: tiada kawalan tanpa nama", not unnamed_controls(page), unnamed_controls(page)[:3])
    ctx.close()

    # ---------------- admin: full content CRUD ----------------
    ctx, page = new_page(browser)
    login(page, "admin")
    go(page, "#/admin")
    page.wait_for_selector(".adm-prod")
    check("Panel admin: 4 tab", page.locator(".tabs a").count() == 4)
    page.click("button.add-btn.strong[data-act=adm-prod-edit]")
    page.fill("#pr-kod", "")
    page.click("[data-form=adm-prod] [type=submit]")
    check("Produk: kod wajib", page.inner_text("[data-form=adm-prod] .err") == MS["admin.codeHint"])
    page.fill("#pr-kod", "hr")
    page.click("[data-form=adm-prod] [type=submit]")
    check("Produk: nama BM wajib", page.inner_text("[data-form=adm-prod] .err") == MS["admin.needNameMs"])
    page.fill("#pr-nama-ms", "GEP HR")
    page.click("[data-form=adm-prod] [data-act=ltab][data-l=en]")
    page.fill("#pr-nama-en", "GEP HR")
    page.fill("#pr-ket-en", "Staff records")
    page.click("[data-form=adm-prod] .sw.custom")
    page.fill("#pr-hex", "#12")
    page.click("[data-form=adm-prod] [type=submit]")
    check("Produk: warna tidak sah ditolak", page.inner_text("[data-form=adm-prod] .err") == MS["admin.badColour"])
    page.fill("#pr-hex", "#7A4FC4")
    page.click("[data-form=adm-prod] [type=submit]")
    toast(page); wait_toast_gone(page)
    check("Produk baharu ditambah (kod huruf besar)", wait_until(page, "() => document.querySelectorAll('.adm-prod').length === 4 && document.querySelectorAll('.adm-prod')[3].textContent.includes('GEP HR')") and page.evaluate("GEPApp.st.cat.produk[3].kod") == "HR")
    page.click(".adm-prod >> nth=3 >> [data-act=adm-prod-move][data-dir='-1']")
    toast(page); wait_toast_gone(page)
    check("Susun produk ke atas", wait_until(page, "() => document.querySelectorAll('.adm-prod')[2].textContent.includes('GEP HR')"))
    page.click(".adm-prod >> nth=2 >> [data-act=adm-prod-edit]")
    page.fill("#pr-nama-ms", "GEP HR Baru")
    page.click("[data-form=adm-prod] [type=submit]")
    toast(page); wait_toast_gone(page)
    check("Produk diedit", wait_until(page, "() => document.querySelectorAll('.adm-prod')[2].textContent.includes('GEP HR Baru')"))
    page.click(".adm-prod >> nth=2 >> a.add-btn")
    page.wait_for_selector("[data-form=adm-tut]")
    check("Tutorial baharu: produk dipilih", page.input_value("#ed-produk") == page.evaluate("GEPApp.st.cat.produk[2].id"))
    page.click("[data-form=adm-tut] [data-intent=save]")
    check("Tutorial: tajuk BM wajib", page.inner_text("[data-form=adm-tut] .err") == MS["admin.needTitleMs"])
    page.fill("#ed-tajuk-ms", "Daftar cuti")
    page.fill("#ed-vid-ms", "https://example.com/video")
    page.wait_for_timeout(50)
    check("Petunjuk pautan video tidak sah", "bad" in page.get_attribute("#ed-vid-ms-hint", "class"))
    page.click("[data-form=adm-tut] [data-intent=save]")
    check("Tutorial: pautan video tidak sah ditolak", page.inner_text("[data-form=adm-tut] .err") == MS["video.invalid"])
    page.fill("#ed-vid-ms", "https://youtu.be/M7lc1UVf-VE?si=abc")
    page.wait_for_timeout(50)
    check("Petunjuk pautan video sah", "ok" in page.get_attribute("#ed-vid-ms-hint", "class"))
    page.fill("#ed-ring-ms", "Cara mohon cuti dalam app.")
    page.click("[data-form=adm-tut] [data-intent=save]")
    toast(page); wait_toast_gone(page)
    page.wait_for_selector("[data-act=adm-step-edit].add-btn")
    tid = page.evaluate("location.hash.split('/')[3]")
    check("Tutorial disimpan sebagai draf, pautan dinormalkan", page.evaluate("t => GEPApp.st.tut[t].status", tid) == "draf" and page.evaluate("t => GEPApp.st.tut[t].video_url_ms", tid) == "https://www.youtube.com/watch?v=M7lc1UVf-VE")
    # step 1 with picture and markers
    page.click("[data-act=adm-step-edit].add-btn")
    page.wait_for_selector(".sheet .drop")
    page.set_input_files(".sheet input[type=file]", img)
    page.wait_for_selector(".sheet .mk-stage img")
    page.wait_for_function("document.querySelector('.sheet .mk-stage img').complete")
    box = page.locator(".sheet .mk-stage").bounding_box()
    page.mouse.click(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.64)
    check("Bulatan diletak pada gambar", page.locator(".sheet .mk-stage .mk-o").count() == 1)
    page.click("[data-act=mk-size][data-d='2']")
    page.click("[data-act=mk-tool][data-tool=a]")
    page.mouse.click(box["x"] + box["width"] * 0.3, box["y"] + box["height"] * 0.3)
    check("Anak panah diletak", page.locator(".sheet .mk-stage .mk-a").count() == 1)
    page.click("[data-act=mk-rotate]")
    rot = page.get_attribute(".sheet .mk-stage .mk-a", "style")
    check("Anak panah diputar", "rotate(180deg)" in rot, rot)
    page.click("[data-form=adm-step] [type=submit]")
    check("Langkah: arahan BM wajib", page.inner_text("[data-form=adm-step] .err") == MS["admin.needStepMs"])
    page.fill("#st-teks-ms", "Buka menu Cuti.")
    page.click("[data-form=adm-step] [data-act=ltab][data-l=en]")
    page.fill("#st-teks-en", "Open the Leave menu.")
    page.click("[data-form=adm-step] [type=submit]")
    toast(page); wait_toast_gone(page)
    page.wait_for_selector(".adm-steps li")
    saved = page.evaluate("t => GEPApp.st.steps[t][0]", tid)
    check("Langkah bergambar disimpan dengan 2 penanda", saved["gambar_path"].startswith("blob:") and len(saved["penanda"]) == 2 and saved["teks_en"] == "Open the Leave menu.")
    o = [m for m in saved["penanda"] if m["t"] == "o"][0]
    check("Kedudukan bulatan tepat (±2%)", abs(o["x"] - 50) < 2 and abs(o["y"] - 64) < 2 and o["r"] == 14, o)
    # step 2 text only, then reorder and edit
    page.click("[data-act=adm-step-edit].add-btn")
    page.fill("#st-teks-ms", "Pilih tarikh dan hantar.")
    page.click("[data-form=adm-step] [type=submit]")
    toast(page); wait_toast_gone(page)
    page.wait_for_function("document.querySelectorAll('.adm-steps li').length === 2")
    page.click(".adm-steps li >> nth=1 >> [data-act=adm-step-move][data-dir='-1']")
    toast(page); wait_toast_gone(page)
    check("Susun langkah", page.evaluate("t => GEPApp.st.steps[t][0].teks_ms", tid) == "Pilih tarikh dan hantar.")
    page.click(".adm-steps li >> nth=1 >> [data-act=adm-step-edit]")
    page.wait_for_selector(".sheet .mk-stage")
    page.click("[data-act=mk-noimg]")
    check("Gambar boleh dibuang dari langkah", page.locator(".sheet .drop").count() == 1)
    page.click(".sheet [data-act=close]")
    check("Statistik terjemahan EN belum lengkap", "EN ✗" in page.inner_text(".muted >> nth=0"))
    # drag to reorder
    page.locator(".adm-steps").scroll_into_view_if_needed()
    page.evaluate("window.scrollBy(0, 120)")
    g = page.locator(".adm-steps li >> nth=0 >> .grip").bounding_box()
    page.mouse.move(g["x"] + g["width"] / 2, g["y"] + g["height"] / 2)
    page.mouse.down()
    second = page.locator(".adm-steps li >> nth=1").bounding_box()
    page.mouse.move(g["x"] + g["width"] / 2, g["y"] + g["height"] / 2 + 60, steps=6)
    page.mouse.move(g["x"] + g["width"] / 2, second["y"] + second["height"] * 0.75, steps=8)
    page.mouse.up()
    toast(page); wait_toast_gone(page)
    check("Seret untuk susun langkah", page.evaluate("t => GEPApp.st.steps[t][0].teks_ms", tid) == "Buka menu Cuti.")
    page.click("[data-form=adm-tut] [data-intent=terbit]")
    toast(page); wait_toast_gone(page)
    check("Admin menerbitkan tutorial", page.evaluate("t => GEPApp.st.tut[t].status", tid) == "terbit")
    go(page, "#/t/" + tid)
    page.wait_for_selector(".t-title")
    check("Tutorial terbit dipaparkan dengan video dan 2 langkah", page.locator(".steps .step").count() == 2 and page.locator("[data-act=video]").count() == 1)
    go(page, "#/admin/t/" + tid)
    page.wait_for_selector(".adm-steps li")
    page.click(".adm-steps li >> nth=1 >> [data-act=adm-step-del]")
    page.click("[data-act=confirm-yes]")
    toast(page); wait_toast_gone(page)
    check("Langkah dipadam", page.locator(".adm-steps li").count() == 1)
    page.click("[data-act=adm-tut-del]")
    page.click("[data-act=confirm-no]")
    check("Batal padam tutorial", page.evaluate("t => !!GEPApp.st.tut[t]", tid))
    page.click("[data-act=adm-tut-del]")
    page.click("[data-act=confirm-yes]")
    toast(page); wait_toast_gone(page)
    page.wait_for_selector(".adm-prod")
    check("Tutorial dipadam", page.evaluate("t => !GEPApp.st.tut[t]", tid))
    page.click(".adm-prod >> nth=2 >> [data-act=adm-prod-del]")
    page.click("[data-act=confirm-yes]")
    toast(page); wait_toast_gone(page)
    check("Produk dipadam", page.locator(".adm-prod").count() == 3)
    page.click("[data-act=adm-filter][data-f=draf]")
    check("Tapis draf", page.locator(".adm-list li").count() == 1)
    page.click("[data-act=adm-filter][data-f=en]")
    check("Tapis belum ada EN", page.locator(".adm-list li").count() == 1 and "Hantar laporan insiden" in page.inner_text(".adm-list"))
    page.click("[data-act=adm-filter][data-f=semua]")
    # tutorial reorder by buttons inside a product
    first = page.evaluate("GEPApp.st.tutsOf['a0000000-0000-4000-8000-000000000001'][0].id")
    page.click(".adm-prod >> nth=0 >> .adm-list li >> nth=0 >> [data-act=adm-tut-move][data-dir='1']")
    toast(page); wait_toast_gone(page)
    check("Susun tutorial", page.evaluate("GEPApp.st.tutsOf['a0000000-0000-4000-8000-000000000001'][1].id") == first)
    # inbox
    go(page, "#/admin/kotak")
    page.wait_for_selector(".inbox")
    check("Kotak masuk: soalan belum dijawab di atas", MS["qa.unanswered"] in page.inner_text(".inbox li >> nth=0"))
    page.click(".inbox li >> nth=0 >> [data-act=qa-answer]")
    page.fill("#qa-t", "Ya, boleh. Data dihantar bila talian kembali.")
    page.click("[data-form=qa-text] [type=submit]")
    toast(page); wait_toast_gone(page)
    check("Admin menjawab soalan", "Ya, boleh." in page.inner_text(".inbox"))
    page.click("[data-act=inbox-tab][data-k=cadangan]")
    page.click(".inbox li >> nth=0 >> [data-act=inbox-status][data-s=selesai]")
    toast(page); wait_toast_gone(page)
    check("Status cadangan ditukar", MS["status.selesai"] in page.inner_text(".inbox li >> nth=0") or MS["status.selesai"] in page.inner_text(".inbox"))
    page.click("[data-act=inbox-tab][data-k=laporan]")
    page.click(".inbox li >> nth=0 >> [data-act=inbox-status][data-s=selesai]")
    toast(page); wait_toast_gone(page)
    page.click(".inbox li >> nth=0 >> [data-act=inbox-del]")
    page.click("[data-act=confirm-yes]")
    toast(page); wait_toast_gone(page)
    check("Laporan dipadam", page.locator(".inbox li").count() == 0)
    # users
    go(page, "#/admin/pengguna")
    page.wait_for_selector(".users li")
    staf_id = "d0000000-0000-4000-8000-00000000000s"
    page.select_option("select[data-role-for='%s']" % staf_id, "editor")
    check("Peranan pengguna ditukar", toast(page) == MS["users.saved"])
    wait_toast_gone(page)
    page.select_option("select[data-role-for='%s']" % staf_id, "staf")
    toast(page); wait_toast_gone(page)
    page.select_option("select[data-role-for='d0000000-0000-4000-8000-00000000000a']", "staf")
    check("Admin terakhir tidak boleh diturunkan", toast(page) == MS["err.last-admin"])
    wait_toast_gone(page)
    check("Pilihan peranan dikembalikan", page.input_value("select[data-role-for='d0000000-0000-4000-8000-00000000000a']") == "admin")
    # settings
    go(page, "#/admin/tetapan")
    page.wait_for_selector("[data-form=adm-settings]")
    page.fill("#set-wa", "abc")
    page.click("[data-form=adm-settings] [type=submit]")
    check("Nombor WhatsApp tidak sah ditolak", page.inner_text("[data-form=adm-settings] .err") == MS["settings.whatsappBad"])
    page.fill("#set-wa", "+60 12-999 8888")
    page.check("#set-wajib", force=True)
    page.click("[data-form=adm-settings] [type=submit]")
    toast(page); wait_toast_gone(page)
    check("Tetapan disimpan (nombor dibersihkan)", page.evaluate("GEPApp.st.settings.whatsapp") == "60129998888" and page.evaluate("GEPApp.st.settings.wajib_log_masuk") is True)
    page.click("[data-act=orphans-find]")
    page.wait_for_selector("text=" + MS["settings.orphansFound"].replace("{n}", "0"))
    check("Cari gambar tidak digunakan", True)
    check("Panel admin: tiada kawalan tanpa nama", not unnamed_controls(page), unnamed_controls(page)[:3])
    go(page, "#/t/b0000000-0000-4000-8000-000000000003")
    page.wait_for_selector(".t-title")
    wa = page.get_attribute(".help a[href^='https://wa.me/']", "href")
    check("Pautan WhatsApp guna nombor baharu", wa and wa.startswith("https://wa.me/60129998888?text="), wa)
    logout(page)
    go(page, "#/")
    page.wait_for_timeout(250)
    check("Wajib log masuk: tetamu nampak dinding log masuk", MS["wall.title"] in page.inner_text("main") and page.locator("a.product").count() == 0)
    ctx.close()

    # ---------------- editor: drafts need approval ----------------
    ctx, page = new_page(browser)
    login(page, "editor")
    go(page, "#/admin")
    page.wait_for_selector(".adm-prod")
    check("Editor hanya nampak tab Kandungan", page.locator(".tabs a").count() == 1 and page.locator("[data-act=adm-prod-del]").count() == 0)
    go(page, "#/admin/pengguna")
    page.wait_for_timeout(200)
    check("Editor disekat dari halaman pengguna", MS["admin.adminOnly"] in page.inner_text("main"))
    go(page, "#/admin/t/b0000000-0000-4000-8000-000000000003")
    page.wait_for_selector("[data-form=adm-tut]")
    check("Editor tiada butang Terbitkan", page.locator("[data-intent=terbit]").count() == 0)
    page.fill("#ed-tajuk-ms", "Pasang & log masuk GEP LITE (dikemas kini)")
    page.click("[data-form=adm-tut] [data-intent=save]")
    check("Suntingan editor: kembali ke draf", toast(page) == MS["admin.editorBackToDraft"])
    wait_toast_gone(page)
    check("Status tutorial menjadi draf", page.evaluate("GEPApp.st.tut['b0000000-0000-4000-8000-000000000003'].status") == "draf")
    err = page.evaluate("() => GEPApp.S.deleteProduk('a0000000-0000-4000-8000-000000000001').then(() => 'ok', e => e.code)")
    check("Editor disekat memadam produk melalui API", err == "permission", err)
    logout(page)
    login(page, "staf")
    go(page, "#/p/a0000000-0000-4000-8000-000000000003")
    page.wait_for_selector(".p-head")
    check("Staf tidak nampak draf editor", "dikemas kini" not in page.inner_text("main"))
    logout(page)
    login(page, "admin")
    go(page, "#/admin")
    page.click("[data-act=adm-filter][data-f=draf]")
    check("Admin nampak draf menunggu kelulusan", "dikemas kini" in page.inner_text("main"))
    go(page, "#/admin/t/b0000000-0000-4000-8000-000000000003")
    page.wait_for_selector("[data-intent=terbit]")
    page.click("[data-intent=terbit]")
    toast(page); wait_toast_gone(page)
    check("Admin meluluskan draf editor", page.evaluate("GEPApp.st.tut['b0000000-0000-4000-8000-000000000003'].status") == "terbit")
    ctx.close()

    # ---------------- sign up / sign in validation ----------------
    ctx, page = new_page(browser)
    page.click(".signin")
    page.click("[data-act=auth-mode][data-mode=up]")
    page.fill("#au-emel", "bukan-emel")
    page.fill("#au-pw", "123456")
    page.click("[data-form=auth] [type=submit]")
    check("Daftar: e-mel tidak sah", page.inner_text("[data-form=auth] .err") == MS["err.auth-email"])
    page.fill("#au-emel", "baru@contoh.com")
    page.fill("#au-pw", "123")
    page.click("[data-form=auth] [type=submit]")
    check("Daftar: kata laluan pendek", page.inner_text("[data-form=auth] .err") == MS["err.auth-weak"])
    page.click(".sheet [data-act=lang][data-lang=en]")
    check("Skrin log masuk boleh tukar bahasa, input kekal", page.input_value("#au-emel") == "baru@contoh.com" and EN["auth.signUp"] in page.inner_text(".sheet-title"))
    page.click(".sheet [data-act=lang][data-lang=ms]")
    page.fill("#au-nama", "Siti")
    page.fill("#au-pw", "rahsia123")
    page.click("[data-form=auth] [type=submit]")
    page.wait_for_selector(".avatar")
    check("Daftar berjaya dan log masuk", toast(page) == MS["auth.welcomeNew"])
    wait_toast_gone(page)
    logout(page)
    page.click(".signin")
    page.click("[data-act=auth-mode][data-mode=up]")
    page.fill("#au-emel", "baru@contoh.com")
    page.fill("#au-pw", "rahsia123")
    page.click("[data-form=auth] [type=submit]")
    page.wait_for_selector("[data-form=auth] .err:not(:empty)")
    check("Daftar: e-mel sudah wujud", page.inner_text("[data-form=auth] .err") == MS["err.auth-exists"])
    page.click("[data-act=auth-mode][data-mode=in]")
    page.click("[data-act=auth-mode][data-mode=reset]")
    page.fill("#au-emel", "baru@contoh.com")
    page.click("[data-form=auth] [type=submit]")
    check("Lupa kata laluan menghantar pautan", toast(page) == MS["auth.resetSent"].replace("{email}", "baru@contoh.com"))
    ctx.close()

    # ---------------- layout, tap targets and accessibility at phone widths ----------------
    for w in (360, 412):
        ctx, page = new_page(browser, width=w, height=800)
        login(page, "admin")
        bad = []
        small = []
        for h in screens + ["#/akaun"]:
            go(page, h)
            page.wait_for_timeout(300)
            if not no_overflow(page):
                bad.append(h)
            small += [h + " " + s for s in small_targets(page)]
            page.click("[data-act=lang][data-lang=en] >> nth=0")
            page.wait_for_timeout(150)
            if not no_overflow(page):
                bad.append(h + " (EN)")
            small += [h + " (EN) " + s for s in small_targets(page)]
            page.click("[data-act=lang][data-lang=ms] >> nth=0")
        check("Tiada skrol mendatar pada %dpx (BM & EN)" % w, not bad, bad)
        check("Sasaran sentuh ≥ 44px pada %dpx" % w, not small, small[:6])
        ctx.close()

    # ---------------- offline (service worker) ----------------
    ctx, page = new_page(browser, sw=True)
    page.evaluate("() => navigator.serviceWorker.ready")
    page.reload(wait_until="networkidle")
    page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=15000)
    ctx.set_offline(True)
    page.reload(wait_until="load")
    page.wait_for_selector("a.product", timeout=15000)
    check("Luar talian: website masih dibuka dari cache", page.locator("a.product").count() == 3)
    go(page, "#/t/b0000000-0000-4000-8000-000000000001")
    page.wait_for_selector(".steps img")
    page.wait_for_function("[...document.querySelectorAll('.steps img')].every(i => i.complete && i.naturalWidth > 0)", timeout=10000)
    check("Luar talian: gambar langkah contoh dimuatkan", True)
    ctx.set_offline(False)
    ctx.close()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            run(browser)
        except Exception:
            traceback.print_exc()
            check("Ujian berjalan hingga habis", False)
        browser.close()
    real = [c for c in console_problems if "favicon" not in c and "Service Worker registration blocked by Playwright" not in c]
    check("Tiada ralat atau amaran konsol", not real, real[:5])
    failed = [r for r in results if not r[1]]
    print("\n%d/%d ujian LULUS" % (len(results) - len(failed), len(results)))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
