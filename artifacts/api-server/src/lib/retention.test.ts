/** الاحتفاظ 48 ساعة: التجهيل لا يُبقي اسماً ولا نصاً، وأسطر التغيير تصير أسماء حقول، والمهلة من متغير البيئة. */
import assert from "node:assert/strict";
import { anonymizeRequest, changeField, expiredDoc, isExpired, readExpired, retentionHours } from "../../../../lib/db/src/retention";

const doc = {
  id: 7,
  requestNumber: "261234",
  deceasedName: "بندر كليفيخ العتيبي",
  status: "ready",
  payload: { deceasedPeople: [{ fullName: "بندر كليفيخ العتيبي" }], condolences: [{ location: "منزل أم محمد" }] },
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
  audit: { channel: "from_text", sourceText: "توفي بندر 55123456", aiReply: "{\"name\":\"بندر\"}", model: "gemini-flash-latest", aiWarnings: ["لم يُذكر مقر عزاء النساء"] },
  history: [
    { at: "2026-10-01T10:00:00.000Z", channel: "from_text", changes: ["أُنشئ الطلب"], sourceText: "توفي بندر" },
    { at: "2026-10-01T12:00:00.000Z", channel: "admin_edit", changes: ["الحالة: جديد ← جاهز", "مقر عزاء النساء: منزل الفقيد ← منزل أم محمد", "أُضيف إلى «الأبناء»: فهد", "حُذف عزاء النساء 2"] },
  ],
};

const cases: Array<[string, () => void]> = [
  ["سطر التغيير يصير اسم الحقل فقط", () => {
    assert.equal(changeField("مقر عزاء النساء: منزل الفقيد ← منزل أم محمد"), "مقر عزاء النساء");
    assert.equal(changeField("أُضيف إلى «الأبناء»: فهد"), "أُضيف إلى «الأبناء»");
    assert.equal(changeField("أُنشئ الطلب"), "أُنشئ الطلب");
    assert.equal(changeField("حُذف عزاء النساء 2"), "حُذف عزاء النساء 2");
  }],
  ["التجهيل: القناة والعدد وأسماء الحقول والتحذيرات تبقى، ولا يبقى اسم ولا نص ولا رقم", () => {
    const now = new Date("2026-10-03T10:00:00.000Z");
    const stat = anonymizeRequest(doc, now);
    assert.deepEqual(stat, {
      requestNumber: "261234",
      status: "ready",
      createdAt: "2026-10-01T10:00:00.000Z",
      expiredAt: "2026-10-03T10:00:00.000Z",
      channel: "from_text",
      model: "gemini-flash-latest",
      aiWarnings: ["لم يُذكر مقر عزاء النساء"],
      edits: 1,
      history: [
        { at: "2026-10-01T10:00:00.000Z", channel: "from_text", fields: ["أُنشئ الطلب"] },
        { at: "2026-10-01T12:00:00.000Z", channel: "admin_edit", fields: ["الحالة", "مقر عزاء النساء", "أُضيف إلى «الأبناء»", "حُذف عزاء النساء 2"] },
      ],
    });
    const text = JSON.stringify(expiredDoc(stat, 7));
    for (const secret of ["بندر", "العتيبي", "أم محمد", "فهد", "55123456", "sourceText", "aiReply"]) assert.ok(!text.includes(secret), secret);
    assert.deepEqual(readExpired(expiredDoc(stat, 7)), stat);
    assert.equal(readExpired(doc), null);
  }],
  ["المستند المجهَّل يحقق قواعد Firestore (الرقم والاسم والحالة وخريطة)", () => {
    const written = expiredDoc(anonymizeRequest(doc, new Date()), 7) as Record<string, unknown>;
    assert.equal(written.requestNumber, "261234");
    assert.equal(written.deceasedName, "");
    assert.equal(written.status, "ready");
    assert.deepEqual(written.payload, {});
    assert.ok(typeof written.expiredAt === "string");
  }],
  ["طلب بلا سجل (قديم) يُجهَّل أيضاً", () => {
    const stat = anonymizeRequest({ requestNumber: "250001", status: "completed", createdAt: "2026-01-01T00:00:00.000Z", payload: { x: 1 } }, new Date("2026-10-03T00:00:00.000Z"));
    assert.deepEqual(stat, { requestNumber: "250001", status: "completed", createdAt: "2026-01-01T00:00:00.000Z", expiredAt: "2026-10-03T00:00:00.000Z", edits: 0, history: [] });
  }],
  ["المهلة: 48 ساعة افتراضاً، وتُقرأ من RETENTION_HOURS، وتُحسب من الإنشاء", () => {
    assert.equal(retentionHours({}), 48);
    assert.equal(retentionHours({ RETENTION_HOURS: "0.5" }), 0.5);
    assert.equal(retentionHours({ RETENTION_HOURS: "abc" }), 48);
    const created = new Date("2026-10-01T10:00:00.000Z");
    assert.equal(isExpired(created, new Date("2026-10-03T09:59:59.000Z"), 48), false);
    assert.equal(isExpired(created, new Date("2026-10-03T10:00:00.000Z"), 48), true);
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
  console.error(`${failed} of ${cases.length} retention cases failed.`);
  process.exit(1);
}
console.log(`Passed ${cases.length} retention cases.`);
