"""Prints Lighthouse scores and fails if Performance or Accessibility is below 90."""
import json, sys
bad = False
for path in sys.argv[1:]:
    r = json.load(open(path))
    cats = r["categories"]
    scores = {k: round((v.get("score") or 0) * 100) for k, v in cats.items()}
    audits = r["audits"]
    lcp = audits.get("largest-contentful-paint", {}).get("displayValue", "")
    cls = audits.get("cumulative-layout-shift", {}).get("displayValue", "")
    print("%s: %s  (LCP %s, CLS %s)" % (path, scores, lcp, cls))
    for k in ("performance", "accessibility"):
        if scores.get(k, 0) < 90:
            bad = True
    for k, v in cats.items():
        for ref in v.get("auditRefs", []):
            a = audits.get(ref["id"], {})
            if ref.get("weight", 0) > 0 and a.get("score") is not None and a["score"] < 0.9:
                print("   - %s: %s %s" % (k, ref["id"], a.get("displayValue", "")))
print("LIGHTHOUSE " + ("FAIL" if bad else "OK (Performance and Accessibility >= 90)"))
sys.exit(1 if bad else 0)
