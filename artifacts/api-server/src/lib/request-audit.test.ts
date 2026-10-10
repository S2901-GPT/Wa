/** سجل سلوك الطلب: تنقية ما يرسله العميل، والفروق بالعربية، وحد طول السجل. */
import assert from "node:assert/strict";
import { appendHistory, diffRequests, maskPhones, sanitizeAudit } from "./request-audit";

const base = {
  messageType: "announcement",
  deceasedPeople: [{ fullName: "بندر كليفيخ العتيبي", gender: "man" }],
  relatives: [{ relation: "الأبناء", people: [{ name: "سعد" }, { name: "محمد" }] }],
  prayer: { enabled: false },
  burial: { status: "upcoming", day: "اليوم", time: "بعد صلاة المغرب", cemetery: "مقبرة مسيمير" },
  condolences: [
    { audience: "men", location: "مجلس سعد بندر كليفيخ العتيبي", area: "الناصرية" },
    { audience: "women", location: "منزل الفقيد", area: "الناصرية" },
  ],
  notes: "",
};
const clone = () => JSON.parse(JSON.stringify(base));

const cases: Array<[string, () => void]> = [
  ["الجمهور: القناة form فقط، ولا يُحفظ عنه شيء (لا جهاز ولا تعريف ولا نص)", () => {
    const audit = sanitizeAudit({ channel: "from_text", sourceText: "نص", aiReply: "{}", visitId: "abcDEF_123-x", client: { ua: "Safari", viewport: "414x896" } }, { admin: false });
    assert.deepEqual(audit, { channel: "form" });
    assert.deepEqual(sanitizeAudit(undefined, { admin: false }), { channel: "form" });
    // «مستنتج» يكتبه سكربت الاسترجاع وحده، لا العميل
    assert.equal((sanitizeAudit({ channel: "from_text", inferred: true }, { admin: true }) as Record<string, unknown>).inferred, undefined);
  }],
  ["المسؤول: القناة والنص والتحذيرات تُحفظ مقصوصة، والجهاز والتعريف لا يُقبلان منه أيضاً", () => {
    const audit = sanitizeAudit({ channel: "from_text", sourceText: "x".repeat(9000), aiWarnings: ["تحذير", "", 5], model: "gemini-flash-latest", visitId: "abcDEF_123-x", client: { ua: "Safari" } }, { admin: true });
    assert.equal(audit?.channel, "from_text");
    assert.equal(audit?.sourceText?.length, 8000);
    assert.deepEqual(audit?.aiWarnings, ["تحذير"]);
    assert.equal((audit as Record<string, unknown>).visitId, undefined);
    assert.equal((audit as Record<string, unknown>).client, undefined);
    assert.equal(sanitizeAudit({ channel: "hacker" }, { admin: true })?.channel, "admin_edit");
  }],
  ["تغيير مقر عزاء النساء ومجلس الرجال يُكتب بالعربية قبل ← بعد", () => {
    const after = clone();
    after.condolences[0].location = "مجلس سعود كليفيخ العتيبي";
    after.condolences[1].location = "منزل أم محمد";
    after.condolences[1].area = "الفروش";
    const changes = diffRequests(base, after);
    assert.ok(changes.includes("مقر عزاء الرجال: مجلس سعد بندر كليفيخ العتيبي ← مجلس سعود كليفيخ العتيبي"), changes.join("\n"));
    assert.ok(changes.includes("مقر عزاء النساء: منزل الفقيد ← منزل أم محمد"));
    assert.ok(changes.includes("منطقة عزاء النساء: الناصرية ← الفروش"));
  }],
  ["إضافة عزاء وحذفه، والحالة، والدفن", () => {
    const after = clone();
    after.condolences = [after.condolences[0]];
    after.burial.time = "بعد صلاة العشاء";
    const removed = diffRequests(base, after, "new", "ready");
    assert.ok(removed.includes("حُذف عزاء النساء"), removed.join("\n"));
    assert.ok(removed.includes("الحالة: جديد ← جاهز"));
    assert.ok(removed.includes("وقت الدفن: بعد صلاة المغرب ← بعد صلاة العشاء"));
    const added = diffRequests(after, base);
    assert.ok(added.some((line) => line.startsWith("أُضيف عزاء النساء: منزل الفقيد")), added.join("\n"));
  }],
  ["الأقارب: المضاف والمحذوف بالاسم", () => {
    const after = clone();
    after.relatives[0].people = [{ name: "سعد" }, { name: "فهد" }];
    const changes = diffRequests(base, after);
    assert.ok(changes.includes("أُضيف إلى «الأبناء»: فهد"), changes.join("\n"));
    assert.ok(changes.includes("حُذف من «الأبناء»: محمد"));
  }],
  ["بلا تغيير ← لا أسطر؛ تغيير في حقل غير معروف ← سطر عام", () => {
    assert.deepEqual(diffRequests(base, clone(), "new", "new"), []);
    const after = clone();
    after.phoneAudience = "men";
    assert.deepEqual(diffRequests(base, after), ["تعديلات أخرى في البيانات"]);
  }],
  ["أرقام الهواتف تُطمس في النص والرد قبل الحفظ، ولا تُمسّ أرقام المنازل والأعوام", () => {
    assert.equal(maskPhones("للتعزية 55123456 أو +974 6612 3456 أو 00974-33123456"), "للتعزية [رقم محذوف] أو [رقم محذوف] أو 00[رقم محذوف]");
    assert.equal(maskPhones("منزل رقم 9 شارع 850 منطقة 66 عام 2026 الساعة 9:30"), "منزل رقم 9 شارع 850 منطقة 66 عام 2026 الساعة 9:30");
    assert.equal(maskPhones("+44 20 7946 0958"), "[رقم محذوف]");
    const audit = sanitizeAudit({ channel: "from_text", sourceText: "عزاء الرجال 55123456", aiReply: "{\"phone\":\"66123456\"}" }, { admin: true });
    assert.equal(audit?.sourceText, "عزاء الرجال [رقم محذوف]");
    assert.ok(!audit?.aiReply?.includes("66123456"));
  }],
  ["السجل يحتفظ بآخر 50", () => {
    let history: unknown = undefined;
    for (let i = 0; i < 60; i += 1) history = appendHistory(history, { at: String(i), channel: "admin_edit", changes: [String(i)] });
    const list = history as Array<{ at: string }>;
    assert.equal(list.length, 50);
    assert.equal(list[0].at, "10");
    assert.equal(list[49].at, "59");
  }],
];

let failed = 0;
for (const [name, test] of cases) {
  try {
    test();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}\n${error instanceof Error ? error.message : String(error)}`);
  }
}
if (failed) {
  console.error(`${failed} of ${cases.length} request audit cases failed.`);
  process.exit(1);
}
console.log(`Passed ${cases.length} request audit cases.`);
