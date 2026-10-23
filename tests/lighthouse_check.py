"""Lighthouse summary: for each page, takes the median run (by Performance) of lh-<page>-<n>.json,
prints scores and weak audits, and fails if Performance or Accessibility is below 90."""
import glob, json, sys

bad = False
for name in sys.argv[1:]:
    runs = []
    for path in sorted(glob.glob("lh-%s-*.json" % name)):
        r = json.load(open(path))
        runs.append((round((r["categories"]["performance"].get("score") or 0) * 100), path, r))
    if not runs:
        print("%s: no Lighthouse results" % name)
        bad = True
        continue
    runs.sort(key=lambda x: x[0])
    perf_all = [x[0] for x in runs]
    _, path, r = runs[len(runs) // 2]
    cats, audits = r["categories"], r["audits"]
    scores = {k: round((v.get("score") or 0) * 100) for k, v in cats.items()}
    print("%s (median of %d, performance runs %s): %s  LCP %s, TBT %s, CLS %s" % (
        name, len(runs), perf_all, scores,
        audits.get("largest-contentful-paint", {}).get("displayValue", ""),
        audits.get("total-blocking-time", {}).get("displayValue", ""),
        audits.get("cumulative-layout-shift", {}).get("displayValue", "")))
    for k in ("performance", "accessibility"):
        if scores.get(k, 0) < 90:
            bad = True
    for k, v in cats.items():
        for ref in v.get("auditRefs", []):
            a = audits.get(ref["id"], {})
            if ref.get("weight", 0) > 0 and a.get("score") is not None and a["score"] < 0.9:
                print("   - %s: %s %s" % (k, ref["id"], a.get("displayValue", "")))
    if scores.get("performance", 0) < 95:
        for item in (audits.get("bootup-time", {}).get("details", {}) or {}).get("items", [])[:4]:
            print("     bootup: %s total %.0f ms" % (item.get("url", "")[-60:], item.get("total", 0)))
        for item in (audits.get("long-tasks", {}).get("details", {}) or {}).get("items", [])[:4]:
            print("     long task: %s %.0f ms at %.0f ms" % (item.get("url", "")[-60:], item.get("duration", 0), item.get("startTime", 0)))
print("LIGHTHOUSE " + ("FAIL" if bad else "OK (Performance and Accessibility >= 90 on every page)"))
sys.exit(1 if bad else 0)
