#!/usr/bin/env python3
"""
تنظيف ما سبق حفظه من بيانات لا نجمعها بعد الآن، في الطلبات الحية وطلبات التجارب:
- audit.client (نوع الجهاز، أبعاد الشاشة، اللغة) و audit.visitId
- payload.condolencePhoneContacts (أرقام هواتف)
- أرقام الهواتف داخل audit.sourceText و audit.aiReply و history[].sourceText تُستبدل بـ[رقم محذوف]

يُشغَّل مرة واحدة في Cloud Shell:
    python3 scrub-personal-data.py            # يعرض ثم يكتب
    python3 scrub-personal-data.py --dry-run  # يعرض فقط
    python3 scrub-personal-data.py --self-test
"""
import json
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

PROJECT = "gen-lang-client-0283189537"
DATABASE = "ai-studio-wa-7d9f7365-d7d4-4e38-90c6-916d29be1465"
COLLECTIONS = ["obituary_requests", "lab_requests"]
PHONE_RE = re.compile(r"(?:\+?\s?974[\s-]?)?(?<![\d٠-٩])[3567]\d{3}[\s-]?\d{4}(?![\d٠-٩])|\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}")
MASK = "[رقم محذوف]"


def mask(value):
    return PHONE_RE.sub(MASK, value)


# ───────────── تحويل قيم Firestore ↔ Python ─────────────

def from_value(v):
    if "stringValue" in v: return v["stringValue"]
    if "booleanValue" in v: return v["booleanValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue" in v: return v["doubleValue"]
    if "nullValue" in v: return None
    if "arrayValue" in v: return [from_value(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v: return {k: from_value(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return v


def to_value(v):
    if v is None: return {"nullValue": None}
    if isinstance(v, bool): return {"booleanValue": v}
    if isinstance(v, int): return {"integerValue": str(v)}
    if isinstance(v, float): return {"doubleValue": v}
    if isinstance(v, str): return {"stringValue": v}
    if isinstance(v, list): return {"arrayValue": {"values": [to_value(x) for x in v]}}
    if isinstance(v, dict): return {"mapValue": {"fields": {k: to_value(x) for k, x in v.items()}}}
    raise TypeError(type(v))


def scrub(doc):
    """doc: {audit?, history?, payload?} بقيم Python. يعيد (الحقول المعدّلة, أسباب) أو ({}, []) إن لم يتغير شيء."""
    changed, reasons = {}, []
    audit = doc.get("audit")
    if isinstance(audit, dict):
        new = {k: v for k, v in audit.items() if k not in ("client", "visitId")}
        if len(new) != len(audit): reasons.append("جهاز/تعريف")
        for key in ("sourceText", "aiReply"):
            if isinstance(new.get(key), str) and mask(new[key]) != new[key]:
                new[key] = mask(new[key]); reasons.append("هاتف في " + key)
        if new != audit: changed["audit"] = new
    history = doc.get("history")
    if isinstance(history, list):
        new_h, touched = [], False
        for entry in history:
            if isinstance(entry, dict) and isinstance(entry.get("sourceText"), str) and mask(entry["sourceText"]) != entry["sourceText"]:
                entry = {**entry, "sourceText": mask(entry["sourceText"])}; touched = True
            new_h.append(entry)
        if touched: changed["history"] = new_h; reasons.append("هاتف في سجل")
    payload = doc.get("payload")
    if isinstance(payload, dict) and payload.get("condolencePhoneContacts"):
        changed["payload"] = {k: v for k, v in payload.items() if k != "condolencePhoneContacts"}
        reasons.append("أرقام هواتف")
    return changed, reasons


def token():
    return subprocess.check_output(["gcloud", "auth", "print-access-token"]).decode().strip()


def call(method, url, body, tok):
    headers = {"Authorization": "Bearer " + tok, "Content-Type": "application/json", "X-Goog-User-Project": PROJECT}
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    return json.load(urllib.request.urlopen(req))


def main():
    dry = "--dry-run" in sys.argv
    tok = token()
    total = 0
    for col in COLLECTIONS:
        base = "https://firestore.googleapis.com/v1/projects/%s/databases/%s/documents/%s" % (PROJECT, DATABASE, col)
        page = None
        print("المجموعة", col)
        while True:
            url = base + "?pageSize=300" + ("&pageToken=" + urllib.parse.quote(page) if page else "")
            try:
                res = call("GET", url, None, tok)
            except urllib.error.HTTPError as e:
                print("  تعذر القراءة:", e.code); break
            for d in res.get("documents", []):
                fields = {k: from_value(v) for k, v in d.get("fields", {}).items()}
                changed, reasons = scrub(fields)
                if not changed: continue
                total += 1
                print("  %s: %s" % (d["name"].split("/")[-1], "، ".join(reasons)))
                if dry: continue
                mask_q = "&".join("updateMask.fieldPaths=" + k for k in changed)
                call("PATCH", "https://firestore.googleapis.com/v1/%s?%s&currentDocument.exists=true" % (d["name"], mask_q), {"fields": {k: to_value(v) for k, v in changed.items()}}, tok)
            page = res.get("nextPageToken")
            if not page: break
    print("\n=== %s %d طلباً ===" % ("سيُنظَّف" if dry else "تم تنظيف", total))


def self_test():
    doc = {
        "audit": {"channel": "from_text", "client": {"ua": "iPhone"}, "visitId": "abc", "sourceText": "اتصل 55123456", "aiReply": "{\"p\":\"+974 6612 3456\"}", "model": "m"},
        "history": [{"at": "t", "channel": "from_text", "changes": [], "sourceText": "رقم 33123456"}, {"at": "t2", "channel": "admin_edit", "changes": ["x"]}],
        "payload": {"deceasedPeople": [], "condolencePhoneContacts": [{"phone": "5"}], "notes": "منزل رقم 9"},
    }
    changed, reasons = scrub(doc)
    assert changed["audit"] == {"channel": "from_text", "sourceText": "اتصل " + MASK, "aiReply": "{\"p\":\"" + MASK + "\"}", "model": "m"}, changed["audit"]
    assert changed["history"][0]["sourceText"] == "رقم " + MASK and changed["history"][1] == doc["history"][1]
    assert "condolencePhoneContacts" not in changed["payload"] and changed["payload"]["notes"] == "منزل رقم 9"
    assert scrub({"audit": {"channel": "form"}, "payload": {"notes": "شارع 850"}}) == ({}, [])
    assert from_value(to_value({"a": [1, "x", True, None, 2.5]})) == {"a": [1, "x", True, None, 2.5]}
    print("self-test ok")


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        try:
            main()
        except urllib.error.HTTPError as e:
            print("\n=== فشل ===", e.code, e.read().decode()[:600])
