"""Fails if the BM and EN dictionaries differ, if any key used in the code is missing,
or if any dictionary entry is empty. Run: python3 tests/check_i18n.py"""
import json, os, re, sys

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web")
ms = json.load(open(os.path.join(root, "i18n", "ms.json"), encoding="utf-8"))
en = json.load(open(os.path.join(root, "i18n", "en.json"), encoding="utf-8"))
problems = []

for k in sorted(set(ms) ^ set(en)):
    problems.append("only in %s: %s" % ("ms" if k in ms else "en", k))
for name, d in (("ms", ms), ("en", en)):
    for k, v in d.items():
        if not isinstance(v, str) or not v.strip():
            problems.append("empty %s: %s" % (name, k))
for k in ms:
    if k in en and set(re.findall(r"\{(\w+)\}", ms[k])) != set(re.findall(r"\{(\w+)\}", en[k])):
        problems.append("placeholders differ: %s" % k)

code = ""
for f in os.listdir(os.path.join(root, "js")):
    if f.endswith(".js"):
        code += open(os.path.join(root, "js", f), encoding="utf-8").read()

prefixes = sorted({k.split(".")[0] for k in ms})
pat = re.compile(r"'((?:%s)\.[A-Za-z0-9][A-Za-z0-9.-]*)'" % "|".join(map(re.escape, prefixes)))
used = set(m for m in pat.findall(code) if not m.endswith("."))
# Keys built at run time
used |= {"err." + c for c in ["network", "permission", "invalid", "notfound", "unknown", "auth-wrong", "auth-exists",
                               "auth-unconfirmed", "auth-weak", "auth-rate", "auth-email", "auth-closed", "image-size",
                               "image-decode", "image-type", "image-encode", "last-admin", "config", "backendLoad"]}
used |= {"role." + r for r in ["admin", "editor", "staf", "tetamu"]}
used |= {"status." + s for s in ["draf", "terbit", "baru", "selesai", "ditolak"]}
used |= {"report.k." + k for k in ["video", "gambar", "langkah", "lain"]}
used |= {"inbox." + k for k in ["soalan", "cadangan", "laporan"]}
used |= {"welcome.%d.%s" % (i, p) for i in (1, 2, 3) for p in ("title", "body")}
used |= {k + ".one" for k in list(used) if k + ".one" in ms}
for k in sorted(used):
    if k not in ms:
        problems.append("used in code but missing: %s" % k)
unused = sorted(set(ms) - used)

if problems:
    print("\n".join(problems))
    print("FAIL: %d i18n problems" % len(problems))
    sys.exit(1)
print("i18n OK: %d keys in both languages, %d used in code%s" % (len(ms), len(used), (", unused: " + ", ".join(unused)) if unused else ""))
