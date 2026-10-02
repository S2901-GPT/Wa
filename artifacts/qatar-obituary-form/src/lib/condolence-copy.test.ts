/**
 * اختبارات محتوى الصورة: محوّل القوالب (presentation-normalizer) ودوال condolence-copy
 * يجب أن تطابق صياغة المولّد الموحّد (announcement.ts).
 */
import assert from "node:assert/strict";
import type { ObituaryRequest } from "@workspace/api-client-react";
import { createCondolenceImageDraft, formatDeceasedIdentity, formatRelativePerson, makeDeathStatement } from "./condolence-copy";
import { normalizeObituaryPresentation } from "./presentation-normalizer";

function makeRequest(overrides: Partial<ObituaryRequest> = {}): ObituaryRequest {
  return {
    id: 1,
    requestNumber: "QA-TEST",
    createdAt: "2026-09-25T10:00:00.000Z",
    updatedAt: "2026-09-25T10:00:00.000Z",
    status: "ready",
    deceasedPeople: [{ fullName: "عبدالله محمد عبدالله", gender: "man" }],
    relatives: [],
    prayer: { enabled: false },
    burial: { status: "upcoming", outsideQatar: false, day: "اليوم", time: "بعد صلاة العصر", cemetery: "مقبرة مسيمير" },
    condolenceOptions: [],
    condolences: [],
    condolencePhoneContacts: [],
    ...overrides,
  } as ObituaryRequest;
}

const cases: Array<[string, () => void]> = [
  ["death statement by gender and number", () => {
    assert.equal(makeDeathStatement([{ gender: "man" }]), "انتقل إلى رحمة الله تعالى");
    assert.equal(makeDeathStatement([{ gender: "woman" }]), "انتقلت إلى رحمة الله تعالى");
    assert.equal(makeDeathStatement([{ gender: "woman" }, { gender: "girl" }]), "انتقلتا إلى رحمة الله تعالى");
    assert.equal(makeDeathStatement([{ gender: "man" }, { gender: "woman" }, { gender: "man" }]), "انتقلوا إلى رحمة الله تعالى");
  }],
  ["nameless widow on the template: the husband is never presented as her name", () => {
    const content = normalizeObituaryPresentation(makeRequest({
      deceasedPeople: [{ gender: "woman", identifyBy: "spouse", spouse: { kind: "widow", title: "الوالد", name: "سيف سعيد", deceased: true }, age: 84 }],
    }));
    assert.equal(content.statement, "انتقلت إلى رحمة الله تعالى");
    assert.equal(content.deceasedList[0].identity, "أرملة الوالد سيف سعيد رحمهم الله");
    assert.deepEqual(content.deceasedList[0].details, ["84 عاماً"]);
    assert.equal(content.closing, "الله يرحمها ويغفر لها");
  }],
  ["relatives on the template use the deceased's perspective and masculine mercy", () => {
    const content = normalizeObituaryPresentation(makeRequest({
      deceasedPeople: [{ fullName: "نورة", gender: "woman" }],
      relatives: [{ relation: "الأبناء", relationKey: "children", people: [{ name: "باسل", deceased: false }, { name: "محمد", deceased: true }] }],
    }));
    assert.deepEqual(content.relatives, [{ heading: "والدة كل من", membersList: ["باسل", "محمد رحمه الله"], membersText: "باسل ومحمد رحمه الله" }]);
  }],
  ["prayer and burial in the same place become one archive sentence", () => {
    const content = normalizeObituaryPresentation(makeRequest());
    assert.equal(content.hasCombinedPrayerBurial, true);
    assert.equal(content.prayerBurialCombined?.dayTime, "الدفن اليوم بعد صلاة العصر في مقبرة مسيمير");
    assert.doesNotMatch(JSON.stringify(content), /يوم اليوم|اليوم: /u);
  }],
  ["separate mosque prayer then burial", () => {
    const content = normalizeObituaryPresentation(makeRequest({
      prayer: { enabled: true, day: "اليوم", time: "بعد صلاة العصر", place: "مسجد حمد بن علي", mapLink: "https://example.com/prayer" },
    }));
    assert.equal(content.hasCombinedPrayerBurial, false);
    assert.equal(content.prayer?.day, "صلاة الجنازة اليوم بعد صلاة العصر في مسجد حمد بن علي");
    assert.equal(content.prayer?.qrUrl, "https://example.com/prayer");
    assert.equal(content.burial?.statusText, "والدفن في مقبرة مسيمير");
  }],
  ["condolence blocks: archive sentence, duration agreement, and extra locations", () => {
    const content = normalizeObituaryPresentation(makeRequest({
      condolenceOptions: ["men", "women"],
      condolences: [
        { audience: "men", location: "مجلس العائلة", area: "الدفنة", durationDays: 2, mapLink: "https://example.com/men" },
        { audience: "women", location: "منزل ابنها غانم" },
        { audience: "women", location: "منزل ابنها ناصر" },
      ],
    }));
    assert.equal(content.men?.location, "في مجلس العائلة بمنطقة الدفنة\nلمدة يومين");
    assert.equal(content.men?.qrUrl, "https://example.com/men");
    assert.equal(content.women?.location, "الموقع الأول:\nفي منزل ابنها غانم\nالموقع الثاني:\nفي منزل ابنها ناصر");
  }],
  ["children get «شفيعاً لوالديه يارب», never the adult prayer", () => {
    const content = normalizeObituaryPresentation(makeRequest({ deceasedPeople: [{ fullName: "يوسف", gender: "boy" }] }));
    assert.equal(content.closing, "شفيعاً لوالديه يارب");
    assert.equal(content.deceasedList[0].identity, "الطفل يوسف");
  }],
  ["image editor overrides (names, notes, closing) are applied", () => {
    const content = normalizeObituaryPresentation(makeRequest(), {
      deceasedNames: ["عبدالله محمد"],
      deceasedTitles: ["الوالد"],
      notes: "ملاحظة",
      closing: "رحمه الله",
    });
    assert.equal(content.deceasedList[0].identity, "الوالد عبدالله محمد");
    assert.equal(content.notes, "ملاحظة");
    assert.equal(content.closing, "رحمه الله");
  }],
  ["relative wording helper is masculine and keeps the job in parentheses", () => {
    assert.equal(formatRelativePerson({ name: "مريم", deceased: true }, "والدة"), "مريم رحمه الله");
    assert.equal(formatRelativePerson({ name: "أحمد", occupation: "جامعة قطر", deceased: false }), "أحمد (جامعة قطر)");
  }],
  ["identity helper puts the husband after her name", () => {
    assert.equal(formatDeceasedIdentity("حرم الشيخ عبدالله", "عائشة محمد"), "عائشة محمد، حرم الشيخ عبدالله");
  }],
  ["image draft starts from the generator's sentences", () => {
    const draft = createCondolenceImageDraft(makeRequest({
      deceasedPeople: [{ gender: "woman", identifyBy: "spouse", spouse: { kind: "harem", name: "خالد", deceased: false } }],
    }));
    assert.deepEqual(draft.deceasedNames, [""]);
    assert.equal(draft.burialText, "الدفن اليوم بعد صلاة العصر في مقبرة مسيمير");
    assert.equal(draft.closing, "الله يرحمها ويغفر لها");
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
  console.error(`${failed} of ${cases.length} condolence-content cases failed.`);
  process.exit(1);
}
console.log(`Passed ${cases.length} condolence-content cases.`);
