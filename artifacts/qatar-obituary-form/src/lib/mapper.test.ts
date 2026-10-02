import assert from "node:assert/strict";
import type { ObituaryRequest } from "@workspace/api-client-react";
import { buildAnnouncement } from "./announcement";
import { mapFormToPayload, mapPayloadToForm } from "./mapper";
import { ObituaryFormSchema, emptyCondolenceCard, emptyDeceased, emptyFormValues, type ObituaryFormValues } from "./schema";

function form(overrides: (values: ObituaryFormValues) => void): ObituaryFormValues {
  const values = emptyFormValues();
  values.deceasedPeople[0] = { ...emptyDeceased(), gender: "man", fullName: "محمد علي" };
  values.burial = { status: "upcoming", outsideQatar: false, dayType: "اليوم", timeType: "بعد صلاة العصر", cemeteryType: "مقبرة مسيمير" };
  overrides(values);
  return values;
}

const issues = (values: ObituaryFormValues) => {
  const result = ObituaryFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
};

const asRequest = (values: ObituaryFormValues): ObituaryRequest => ({
  ...mapFormToPayload(values),
  id: 1,
  requestNumber: "QTR-TEST",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  status: "new",
});

const cases: Array<[string, () => void]> = [
  ["الجنس لا يُفترض: النموذج الفارغ يرفض المتابعة دون اختياره", () => {
    const values = emptyFormValues();
    values.deceasedPeople[0].fullName = "محمد علي";
    assert.ok(issues(values).some((issue) => issue.startsWith("deceasedPeople.0.gender")));
  }],
  ["الاسم اختياري عند التعريف عبر الزوج، ومطلوب عند التعريف بالاسم", () => {
    const nameless = form((values) => {
      values.deceasedPeople[0] = {
        ...emptyDeceased(),
        gender: "woman",
        identifyBy: "spouse",
        spouse: { kind: "widow", title: "الوالد", name: "سيف سعيد", deceased: false },
      };
    });
    assert.deepEqual(issues(nameless), []);
    const payload = mapFormToPayload(nameless);
    assert.equal(payload.deceasedPeople[0].fullName, undefined);
    assert.equal(payload.deceasedPeople[0].spouse?.deceased, true, "«أرملة» تعني زوجاً متوفى");
    const missing = form((values) => { values.deceasedPeople[0].fullName = ""; });
    assert.ok(issues(missing).some((issue) => issue.startsWith("deceasedPeople.0.fullName")));
  }],
  ["التعريف عبر الأبناء يتطلب مجموعة «الأبناء»", () => {
    const values = form((draft) => {
      draft.deceasedPeople[0] = { ...emptyDeceased(), gender: "woman", identifyBy: "children" };
    });
    assert.ok(issues(values).some((issue) => issue.startsWith("relatives:")));
    values.relatives.push({
      relationKey: "children",
      relationOther: "",
      familyReference: "",
      reference: { deceased: false },
      deceasedPlacement: "auto",
      deceasedTarget: "all",
      people: [{ name: "غانم", deceased: false }],
    });
    assert.deepEqual(issues(values), []);
  }],
  ["موعد الدفن لا يُطلب للدفن خارج قطر أو بعد إتمامه أو عند التأجيل", () => {
    for (const burial of [
      { status: "upcoming" as const, outsideQatar: true, outsideLocation: "مصر" },
      { status: "completed" as const, outsideQatar: false, cemeteryType: "مقبرة مسيمير" },
      { status: "postponed" as const, outsideQatar: false },
    ]) {
      assert.deepEqual(issues(form((values) => { values.burial = burial; })), [], JSON.stringify(burial));
    }
    const missing = form((values) => { values.burial = { status: "upcoming", outsideQatar: false }; });
    assert.ok(issues(missing).some((issue) => issue.startsWith("burial.dayType")));
  }],
  ["تفاصيل العزاء تُحفظ حتى لو طُوي قسمها", () => {
    const values = form((draft) => {
      draft.condolences.none = false;
      draft.condolences.men = true;
      draft.condolences.cards = [{ ...emptyCondolenceCard("men"), location: "مجلس", expanded: false, durationDays: 3, time: "الفترة المسائية" }];
    });
    const card = mapFormToPayload(values).condolences[0];
    assert.equal(card.durationDays, 3);
    assert.equal(card.time, "الفترة المسائية");
  }],
  ["عزاء الرجال في المقبرة فقط + عزاء النساء عبر الهاتف", () => {
    const values = form((draft) => {
      draft.condolences.none = false;
      draft.condolences.men = true;
      draft.condolences.menMode = "cemetery";
      draft.condolences.phone = true;
      draft.condolences.phoneAudience = "women";
      draft.condolences.cards = [emptyCondolenceCard("men")];
    });
    const payload = mapFormToPayload(values);
    assert.deepEqual(payload.condolenceOptions, ["men_cemetery", "phone"]);
    assert.deepEqual(payload.condolences, [], "بطاقة المجلس لا تُرسل عند اختيار المقبرة فقط");
  }],
  ["ذهاباً وإياباً: النموذج ← الطلب ← النموذج يحفظ البيانات الجديدة", () => {
    const values = form((draft) => {
      draft.messageType = "amendment";
      draft.relatedRequestNumber = "QTR-1";
      draft.announcementMode = "siblings";
      draft.sharedParent = { title: "", name: "فهد الشملان", deceased: true };
      draft.deceasedPeople = [
        { ...emptyDeceased(), gender: "man", fullName: "سعود", age: 22 },
        { ...emptyDeceased(), gender: "boy", fullName: "جاسم", age: 8, ageUnit: "months" },
      ];
      draft.burial = { status: "upcoming", outsideQatar: false, dayType: "اليوم", weekday: "السبت", timeType: "بعد صلاة التراويح", cemeteryType: "مقبرة الكعبان" };
      draft.relatives = [{
        relationKey: "paternal_uncles",
        relationOther: "",
        familyReference: "",
        reference: { deceased: false },
        deceasedPlacement: "grouped",
        deceasedTarget: "all",
        people: [{ name: "خالد", deceased: true }, { name: "حمد", deceased: true }],
      }];
      draft.condolences.none = false;
      draft.condolences.women = true;
      draft.condolences.cards = [
        { ...emptyCondolenceCard("women"), deceasedTarget: "0", location: "منزل رقم ٥", schedule: [{ days: "الخميس", time: "بعد العشاء" }] },
        { ...emptyCondolenceCard("women"), deceasedTarget: "1", location: "منزل رقم ٩" },
      ];
    });
    assert.deepEqual(issues(values), []);
    const back = mapPayloadToForm(asRequest(values));
    assert.equal(back.messageType, "amendment");
    assert.equal(back.announcementMode, "siblings");
    assert.equal(back.sharedParent.name, "فهد الشملان");
    assert.equal(back.deceasedPeople[1].ageUnit, "months");
    assert.equal(back.burial.weekday, "السبت");
    assert.equal(back.burial.timeType, "بعد صلاة التراويح");
    assert.equal(back.burial.cemeteryType, "مقبرة الكعبان");
    assert.equal(back.relatives[0].relationKey, "paternal_uncles");
    assert.equal(back.relatives[0].deceasedPlacement, "grouped");
    assert.equal(back.condolences.cards[1].deceasedTarget, "1");
    assert.equal(back.condolences.cards[0].schedule[0].days, "الخميس");
    const text = buildAnnouncement(mapFormToPayload(back)).text;
    assert.match(text, /^تعديل \/\nتوفي كل من\nسعود — 22 عاماً\nالطفل جاسم — 8 أشهر\nأبناء \/ فهد الشملان رحمه الله\nأعمامهم كل من\nخالد وحمد رحمهما الله/u);
  }],
  ["طلب قديم: الصلة النصية والجنس «other» والمقبرة غير المدرجة", () => {
    const legacy = {
      id: 9,
      requestNumber: "QTR-OLD",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      status: "new",
      deceasedPeople: [{ fullName: "فلان", gender: "other" }],
      relatives: [{ relation: "أخ", familyReference: "", people: [{ name: "علي", deceased: false }] }],
      prayer: { enabled: false },
      burial: { status: "upcoming", outsideQatar: false, day: "اليوم", time: "الساعة 9", cemetery: "مقبرة الدحيل" },
      condolenceOptions: [],
      condolences: [],
      condolencePhoneContacts: [],
    } as ObituaryRequest;
    const values = mapPayloadToForm(legacy);
    assert.equal(values.deceasedPeople[0].gender, undefined, "يُطلب اختيار الجنس من جديد بدل افتراض «رجل»");
    assert.equal(values.relatives[0].relationKey, "siblings");
    assert.equal(values.burial.cemeteryType, "أخرى");
    assert.equal(values.burial.cemeteryOther, "مقبرة الدحيل");
    assert.equal(values.burial.timeType, "أخرى");
    assert.equal(values.burial.timeOther, "الساعة 9");
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
  console.error(`${failed} of ${cases.length} mapper cases failed.`);
  process.exit(1);
}
console.log(`Passed ${cases.length} mapper cases.`);
