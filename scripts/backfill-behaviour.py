#!/usr/bin/env python3
"""
استرجاع سلوك الطلبات القديمة (قبل تفعيل السجل) من سجلات Cloud Run.

الطلبات المحفوظة قبل ١٠ أكتوبر ٢٠٢٦ ليس فيها audit ولا history. سجلات الخادم (تبقى ٣٠ يوماً) فيها
كل طلب HTTP بوقته وعنوانه وجهازه، فيُستنتج منها لكل طلب قديم:
- المصدر: «طلب من نص» إن سبقه استدعاء /api/admin/parse-text من العنوان نفسه خلال ١٥ دقيقة، وإلا «نموذج الجمهور».
- مواعيد التعديلات (PUT) — دون تفاصيلها، فهي لم تكن تُسجَّل.
النص الملصوق وردّ الذكاء الاصطناعي ليسا في سجلات الخادم، فلا يمكن استرجاعهما.

يكتب فقط في الطلبات التي ليس لها audit (لا يمسّ ما سُجّل بعد التفعيل)، ويضع inferred=true.

التشغيل في Cloud Shell:
    python3 backfill-behaviour.py            # يعرض النتيجة ثم يكتبها
    python3 backfill-behaviour.py --dry-run  # يعرض فقط
    python3 backfill-behaviour.py --self-test
"""
import json
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

PROJECT = "gen-lang-client-0283189537"
DATABASE = "ai-studio-wa-7d9f7365-d7d4-4e38-90c6-916d29be1465"
SERVICE = "qatarde"
COLLECTION = "obituary_requests"

CREATE_MATCH = timedelta(seconds=30)   # بين ردّ POST في السجل و createdAt في المستند
PARSE_BEFORE = timedelta(minutes=15)   # «طلب من نص» يسبق الحفظ بدقائق
EDIT_NOTE = "عُدِّل (تفاصيل التعديل لم تكن تُسجَّل قبل تفعيل السجل)"


def parse_time(value):
    value = value.replace("Z", "+00:00")
    # Firestore/Logging قد تعطي أجزاء ثانية بتسعة أرقام
    if "." in value:
        head, tail = value.split(".", 1)
        digits = len(tail) - len(tail.lstrip("0123456789"))
        frac, zone = tail[:digits], tail[digits:] or "+00:00"
        value = f"{head}.{frac[:6]}{zone}"
    return datetime.fromisoformat(value)


def iso(dt):
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def infer(docs, logs):
    """
    docs: [{number, createdAt (datetime)}] للطلبات بلا audit.
    logs: [{time, method, path, status, ip, ua}] من سجلات Cloud Run.
    يعيد {number: {"audit": {...}, "history": [...]}}.
    """
    parses = sorted((l for l in logs if l["method"] == "POST" and l["path"].startswith("/api/admin/parse-text") and 200 <= l["status"] < 300), key=lambda l: l["time"])
    creates = [l for l in logs if l["method"] == "POST" and l["path"].rstrip("/") == "/api/obituary-requests" and l["status"] == 201]
    puts = [l for l in logs if l["method"] == "PUT" and l["path"].startswith("/api/obituary-requests/") and 200 <= l["status"] < 300]
    used = set()

    def came_from_text(log):
        return any(p["ip"] == log["ip"] and timedelta(0) <= log["time"] - p["time"] <= PARSE_BEFORE for p in parses)

    out = {}
    for doc in docs:
        candidates = [(abs(c["time"] - doc["createdAt"]), i, c) for i, c in enumerate(creates) if i not in used and abs(c["time"] - doc["createdAt"]) <= CREATE_MATCH]
        if not candidates:
            continue
        _, index, create = min(candidates, key=lambda t: t[0])
        used.add(index)
        channel = "from_text" if came_from_text(create) else "form"
        audit = {"channel": channel, "inferred": True}
        history = [{"at": iso(doc["createdAt"]), "channel": channel, "changes": ["أُنشئ الطلب"]}]
        edits = sorted((p for p in puts if p["path"].rstrip("/").split("/")[-1] == doc["number"]), key=lambda p: p["time"])
        for edit in edits:
            history.append({"at": iso(edit["time"]), "channel": "from_text" if came_from_text(edit) else "admin_edit", "changes": [EDIT_NOTE]})
        out[doc["number"]] = {"audit": audit, "history": history[-50:]}
    return out


# ───────────────────────── Google APIs ─────────────────────────

def token():
    return subprocess.check_output(["gcloud", "auth", "print-access-token"]).decode().strip()


def call(method, url, body=None, tok=None):
    headers = {"Authorization": "Bearer " + tok, "Content-Type": "application/json", "X-Goog-User-Project": PROJECT}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    return json.load(urllib.request.urlopen(req))


def read_logs(tok, project):
    since = iso(datetime.now(timezone.utc) - timedelta(days=31))
    flt = (
        'resource.type="cloud_run_revision" AND resource.labels.service_name="%s" '
        'AND (httpRequest.requestMethod="POST" OR httpRequest.requestMethod="PUT") '
        'AND httpRequest.requestUrl:"/api/" AND timestamp>="%s"' % (SERVICE, since)
    )
    entries, page = [], None
    while True:
        body = {"resourceNames": ["projects/" + project], "filter": flt, "orderBy": "timestamp asc", "pageSize": 1000}
        if page:
            body["pageToken"] = page
        res = call("POST", "https://logging.googleapis.com/v2/entries:list", body, tok)
        for e in res.get("entries", []):
            h = e.get("httpRequest") or {}
            path = urllib.parse.urlparse(h.get("requestUrl", "")).path
            entries.append({
                "time": parse_time(e["timestamp"]),
                "method": h.get("requestMethod", ""),
                "path": path,
                "status": int(h.get("status") or 0),
                "ip": h.get("remoteIp", ""),
                "ua": h.get("userAgent", ""),
            })
        page = res.get("nextPageToken")
        if not page:
            return entries


def read_docs(tok):
    base = "https://firestore.googleapis.com/v1/projects/%s/databases/%s/documents/%s" % (PROJECT, DATABASE, COLLECTION)
    docs, page = [], None
    while True:
        url = base + "?pageSize=300" + ("&pageToken=" + urllib.parse.quote(page) if page else "")
        res = call("GET", url, None, tok)
        for d in res.get("documents", []):
            f = d.get("fields", {})
            if "audit" in f or "deletedAt" in f or "createdAt" not in f:
                continue
            docs.append({"name": d["name"], "number": d["name"].split("/")[-1], "createdAt": parse_time(f["createdAt"]["stringValue"])})
        page = res.get("nextPageToken")
        if not page:
            return docs


def to_value(v):
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, str):
        return {"stringValue": v}
    if isinstance(v, list):
        return {"arrayValue": {"values": [to_value(x) for x in v]}}
    if isinstance(v, dict):
        return {"mapValue": {"fields": {k: to_value(x) for k, x in v.items()}}}
    raise TypeError(type(v))


def write(tok, name, result):
    url = "https://firestore.googleapis.com/v1/%s?updateMask.fieldPaths=audit&updateMask.fieldPaths=history&currentDocument.exists=true" % name
    call("PATCH", url, {"fields": {"audit": to_value(result["audit"]), "history": to_value(result["history"])}}, tok)


LABEL = {"form": "نموذج الجمهور", "from_text": "طلب من نص", "admin_edit": "المسؤول"}


def main():
    dry = "--dry-run" in sys.argv
    tok = token()
    print("قراءة الطلبات بلا سجل…")
    docs = read_docs(tok)
    print("  %d طلباً بلا سجل" % len(docs))
    print("قراءة سجلات الخادم (آخر ٣٠ يوماً)…")
    logs = read_logs(tok, PROJECT)
    print("  %d طلب HTTP" % len(logs))
    if not logs:
        print("\n=== لم أجد سجلات للخدمة %s في المشروع %s. لم يُكتب شيء. أرسل صورة هذه الرسالة. ===" % (SERVICE, PROJECT))
        return
    results = infer(docs, logs)
    print("\nالنتيجة:")
    for doc in sorted(docs, key=lambda d: d["createdAt"]):
        r = results.get(doc["number"])
        if not r:
            print("  %s  —  أقدم من سجلات الخادم (لا يمكن الاستنتاج)" % doc["number"])
            continue
        print("  %s  %s  %d تعديل" % (doc["number"], LABEL[r["audit"]["channel"]], len(r["history"]) - 1))
    print("\nاستُنتج %d من %d." % (len(results), len(docs)))
    if dry:
        print("(--dry-run: لم يُكتب شيء)")
        return
    done = 0
    for doc in docs:
        r = results.get(doc["number"])
        if r:
            write(tok, doc["name"], r)
            done += 1
    print("\n=== تم: كُتب سلوك %d طلباً. حدّث صفحة «السلوك» في التطبيق. ===" % done)


def self_test():
    t0 = datetime(2026, 10, 8, 6, 0, tzinfo=timezone.utc)
    m = lambda s: t0 + timedelta(seconds=s)
    logs = [
        {"time": m(0), "method": "POST", "path": "/api/admin/parse-text", "status": 200, "ip": "1.1.1.1", "ua": "iPad"},
        {"time": m(60), "method": "POST", "path": "/api/obituary-requests", "status": 201, "ip": "1.1.1.1", "ua": "iPad"},
        {"time": m(3600), "method": "POST", "path": "/api/obituary-requests", "status": 201, "ip": "2.2.2.2", "ua": "iPhone Safari"},
        {"time": m(4000), "method": "PUT", "path": "/api/obituary-requests/264670", "status": 200, "ip": "1.1.1.1", "ua": "iPad"},
        {"time": m(5000), "method": "POST", "path": "/api/obituary-requests", "status": 400, "ip": "3.3.3.3", "ua": "x"},
    ]
    docs = [
        {"number": "266398", "createdAt": m(61)},
        {"number": "264670", "createdAt": m(3599)},
        {"number": "100000", "createdAt": m(-99999)},
    ]
    r = infer(docs, logs)
    assert r["266398"]["audit"] == {"channel": "from_text", "inferred": True}, r["266398"]
    assert r["264670"]["audit"] == {"channel": "form", "inferred": True}, r["264670"]
    assert [h["channel"] for h in r["264670"]["history"]] == ["form", "admin_edit"]
    assert r["264670"]["history"][1]["changes"] == [EDIT_NOTE]
    assert "100000" not in r
    assert parse_time("2026-10-08T06:00:01.123456789Z") == m(1) + timedelta(microseconds=123456)
    assert to_value({"a": [True, "x"]}) == {"mapValue": {"fields": {"a": {"arrayValue": {"values": [{"booleanValue": True}, {"stringValue": "x"}]}}}}}
    print("self-test ok")


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        try:
            main()
        except urllib.error.HTTPError as e:
            print("\n=== فشل ===", e.code, e.read().decode()[:600])
