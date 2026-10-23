"""Draws the sample step pictures used by the seed tutorials (img/contoh/*.jpg).
They are simple phone-screen illustrations labelled as samples, not real app screenshots."""
import os, sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else "web/img/contoh"
FONTS = sys.argv[2] if len(sys.argv) > 2 else "web/fonts"
W, H = 720, 1280
INK, PAPER, LINE, MUTED = "#13202D", "#EEF1F4", "#D5DCE3", "#6A7887"
COL = {"app": "#FFC20E", "ops": "#2563B8", "lite": "#2E9A63"}
ON = {"app": INK, "ops": "#FFFFFF", "lite": "#FFFFFF"}

def font(bold, size, cn=False):
    name = "heroscn-bold.woff" if cn else ("heros-bold.woff" if bold else "heros-regular.woff")
    return ImageFont.truetype(os.path.join(FONTS, name), size)

def base(prod, title):
    im = Image.new("RGB", (W, H), "#FFFFFF")
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 64], fill=INK)
    d.text((36, 18), "9:41", font=font(True, 26), fill="#FFFFFF")
    d.rounded_rectangle([W - 96, 22, W - 40, 44], 6, outline="#FFFFFF", width=3)
    d.rectangle([0, 64, W, 176], fill=COL[prod])
    d.text((40, 96), title, font=font(True, 46, cn=True), fill=ON[prod])
    # sample label
    lab = "GAMBAR CONTOH"
    f = font(True, 22)
    tw = d.textlength(lab, font=f)
    d.rounded_rectangle([24, H - 70, tw + 60, H - 26], 10, fill=INK)
    d.text((42, H - 61), lab, font=f, fill="#FFC20E")
    return im, d

def patch(d, prod, x, y, s):
    d.rounded_rectangle([x, y, x + s, y + s], s // 5, fill=COL[prod])
    d.rounded_rectangle([x + 8, y + 8, x + s - 8, y + s - 8], s // 6, outline=ON[prod], width=3)
    code = prod.upper()
    f = font(True, int(s * 0.28), cn=True)
    tw = d.textlength(code, font=f)
    d.text((x + (s - tw) / 2, y + s * 0.34), code, font=f, fill=ON[prod])

def button(d, cy, label, fill, ink, w=520):
    x0 = (W - w) // 2
    d.rounded_rectangle([x0, cy - 48, x0 + w, cy + 48], 22, fill=fill)
    f = font(True, 38)
    tw = d.textlength(label, font=f)
    d.text(((W - tw) / 2, cy - 22), label, font=f, fill=ink)

def field(d, cy, label, value=""):
    x0, x1 = 90, W - 90
    d.text((x0, cy - 92), label, font=font(True, 28), fill=INK)
    d.rounded_rectangle([x0, cy - 48, x1, cy + 48], 16, fill=PAPER, outline=LINE, width=3)
    if value:
        d.text((x0 + 28, cy - 20), value, font=font(False, 34), fill=MUTED)

def lines(d, y, n, w=520):
    for i in range(n):
        d.rounded_rectangle([100, y + i * 46, 100 + (w if i % 2 == 0 else w - 160), y + i * 46 + 18], 9, fill=LINE)

def store(prod, name):
    im, d = base(prod, "Play Store")
    patch(d, prod, 100, 300, 170)
    d.text((300, 320), name, font=font(True, 50, cn=True), fill=INK)
    d.text((300, 386), "GuardExpertPro", font=font(False, 30), fill=MUTED)
    button(d, int(H * 0.50), "Pasang", "#17803D", "#FFFFFF")
    lines(d, 760, 6)
    return im

def welcome(prod, name, btn_y):
    im, d = base(prod, name)
    patch(d, prod, (W - 220) // 2, 300, 220)
    f = font(True, 46, cn=True)
    t = "Selamat datang"
    d.text(((W - d.textlength(t, font=f)) / 2, 580), t, font=f, fill=INK)
    button(d, int(H * btn_y), "Log Masuk", INK, "#FFFFFF")
    return im

def login(prod, name, fields, btn, btn_y, first_y=0.45):
    im, d = base(prod, name)
    y = int(H * first_y)
    for lab, val in fields:
        field(d, y, lab, val)
        y += 210
    button(d, int(H * btn_y), btn, COL[prod], ON[prod])
    return im

def browser(prod):
    im, d = base(prod, "Pelayar")
    d.rounded_rectangle([40, 230, W - 40, 320], 40, fill=PAPER, outline=LINE, width=3)
    d.text((80, 256), "alamat konsol anda", font=font(False, 32), fill=INK)
    patch(d, prod, (W - 200) // 2, 460, 200)
    f = font(True, 48, cn=True)
    t = "GEP OPS"
    d.text(((W - d.textlength(t, font=f)) / 2, 700), t, font=f, fill=INK)
    lines(d, 820, 4)
    return im

def dashboard(prod):
    im, d = base(prod, "Papan pemuka")
    for i in range(2):
        for j in range(2):
            x, y = 50 + j * 320, 230 + i * 190
            d.rounded_rectangle([x, y, x + 300, y + 170], 22, fill=PAPER)
            d.text((x + 26, y + 26), ["Pengawal", "Rondaan", "Insiden", "Tapak"][i * 2 + j], font=font(True, 28), fill=MUTED)
            d.text((x + 26, y + 74), ["24", "18", "2", "6"][i * 2 + j], font=font(True, 64, cn=True), fill=INK)
    d.rounded_rectangle([50, 640, W - 50, 1130], 26, fill="#DCE8F7")
    for (x, y) in [(180, 760), (420, 860), (300, 1000), (560, 720)]:
        d.ellipse([x - 22, y - 22, x + 22, y + 22], fill=COL[prod], outline="#FFFFFF", width=6)
    return im

def home(prod, name):
    im, d = base(prod, name)
    f = font(True, 40, cn=True)
    d.text((60, 230), "Skrin utama", font=f, fill=INK)
    for i in range(4):
        y = 320 + i * 190
        d.rounded_rectangle([50, y, W - 50, y + 160], 24, fill=PAPER)
        d.rounded_rectangle([80, y + 30, 180, y + 130], 20, fill=COL[prod])
        lines(d, y + 52, 2, w=380) if False else None
        d.rounded_rectangle([210, y + 50, 560, y + 72], 11, fill=LINE)
        d.rounded_rectangle([210, y + 94, 460, y + 114], 10, fill=LINE)
    return im

os.makedirs(OUT, exist_ok=True)
imgs = {
    "app-1": store("app", "GEP APP"),
    "app-2": login("app", "GEP APP", [("E-mel", "nama@syarikat.com"), ("Kata laluan", "••••••••")], "Log Masuk", 0.78),
    "app-3": login("app", "GEP APP", [("E-mel", "nama@syarikat.com"), ("Kata laluan", "••••••••")], "Log Masuk", 0.70, 0.36),
    "ops-1": browser("ops"),
    "ops-2": login("ops", "GEP OPS", [("ID penyelia", ""), ("Kata laluan", "")], "Log Masuk", 0.80, 0.45),
    "ops-3": dashboard("ops"),
    "lite-1": store("lite", "GEP LITE"),
    "lite-2": welcome("lite", "GEP LITE", 0.60),
    "lite-3": login("lite", "GEP LITE", [("E-mel", "nama@syarikat.com"), ("Kata laluan", "••••••••")], "Teruskan", 0.78),
}
for k, im in imgs.items():
    p = os.path.join(OUT, k + ".jpg")
    im.save(p, "JPEG", quality=78, optimize=True, progressive=True)
    print(p, os.path.getsize(p))
