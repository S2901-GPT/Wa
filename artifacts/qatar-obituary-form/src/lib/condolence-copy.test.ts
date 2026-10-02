import assert from "node:assert/strict";
import type { ObituaryRequest } from "@workspace/api-client-react";
import {
  applyImageDraft,
  buildCondolencePosterContent,
  createCondolenceImageDraft,
  draftQrLinks,
} from "./condolence-copy";
import { makeDeathStatement } from "./announcement";

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

function build(request: ObituaryRequest) {
  const draft = createCondolenceImageDraft(request);
  return { draft, poster: buildCondolencePosterContent(request, draft, draftQrLinks(draft)) };
}

const sectionById = (poster: ReturnType<typeof build>["poster"], id: string) => {
  const item = poster.items.find((entry) => entry.kind === "section" && entry.id === id);
  return item?.kind === "section" ? item : undefined;
};

const cases: Array<[string, () => void]> = [
  ["death statement by gender and number", () => {
    assert.equal(makeDeathStatement([{ gender: "man" }]), "انتقل إلى رحمة الله تعالى");
    assert.equal(makeDeathStatement([{ gender: "woman" }]), "انتقلت إلى رحمة الله تعالى");
    assert.equal(makeDeathStatement([{ gender: "man" }, { gender: "man" }]), "انتقلا إلى رحمة الله تعالى");
    assert.equal(makeDeathStatement([{ gender: "woman" }, { gender: "girl" }]), "انتقلتا إلى رحمة الله تعالى");
    assert.equal(makeDeathStatement([{ gender: "man" }, { gender: "woman" }, { gender: "man" }]), "انتقلوا إلى رحمة الله تعالى");
  }],
  ["nameless widow: poster names never present the husband as the deceased's own name", () => {
    const { poster } = build(makeRequest({
      deceasedPeople: [{ gender: "woman", identifyBy: "spouse", spouse: { kind: "widow", title: "الوالد", name: "سيف سعيد", deceased: true } }],
    }));
    assert.equal(poster.names, "أرملة الوالد سيف سعيد رحمهم الله");
    assert.equal(poster.statement, "انتقلت إلى رحمة الله تعالى");
    assert.doesNotMatch(poster.names, /،/u);
  }],
  ["relatives on the poster use the deceased's perspective and masculine mercy", () => {
    const { poster } = build(makeRequest({
      deceasedPeople: [{ fullName: "نورة", gender: "woman" }],
      relatives: [{ relation: "", relationKey: "children", people: [{ name: "باسل", deceased: false }, { name: "محمد", deceased: true }] }],
    }));
    const relatives = sectionById(poster, "relatives");
    assert.equal(relatives?.text, "والدة كل من\nباسل\nومحمد رحمه الله");
  }],
  ["men-only condolence module", () => {
    const { poster } = build(makeRequest({ condolenceOptions: ["men"], condolences: [{ audience: "men", location: "مجلس العائلة" }] }));
    assert.ok(sectionById(poster, "men"));
    assert.ok(!sectionById(poster, "women"));
  }],
  ["men and women modules keep labeled QR codes", () => {
    const { poster } = build(makeRequest({
      condolenceOptions: ["men", "women"],
      condolences: [
        { audience: "men", location: "مجلس العائلة", mapLink: "https://example.com/men" },
        { audience: "women", location: "منزل العائلة", mapLink: "https://example.com/women" },
      ],
    }));
    const men = sectionById(poster, "men");
    const women = sectionById(poster, "women");
    assert.equal(men?.label, "عزاء الرجال");
    assert.equal(men?.qr?.label, "موقع الرجال");
    assert.equal(men?.qr?.url, "https://example.com/men");
    assert.equal(men?.text, "في مجلس العائلة");
    assert.equal(women?.label, "عزاء النساء");
    assert.equal(women?.qr?.label, "موقع النساء");
  }],
  ["a second women location gets its own section and QR", () => {
    const { poster } = build(makeRequest({
      condolenceOptions: ["women"],
      condolences: [
        { audience: "women", location: "منزل ابنتها", mapLink: "https://example.com/w1" },
        { audience: "women", location: "منزل أختها", mapLink: "https://example.com/w2" },
      ],
    }));
    assert.equal(sectionById(poster, "women-2")?.qr?.url, "https://example.com/w2");
    assert.equal(sectionById(poster, "women-2")?.qr?.label, "موقع النساء 2");
  }],
  ["phone-only condolence", () => {
    const { poster } = build(makeRequest({
      condolenceOptions: ["phone"],
      phoneAudience: "all",
      condolencePhoneContacts: [{ name: "ناصر", phone: "55551234" }],
    }));
    assert.match(sectionById(poster, "phone")?.text ?? "", /العزاء عن طريق هاتف ناصر: 55551234/u);
  }],
  ["short request remains complete", () => {
    const { poster } = build(makeRequest());
    assert.equal(poster.names, "عبدالله محمد عبدالله");
    assert.ok(sectionById(poster, "closing"));
    assert.equal(sectionById(poster, "closing")?.text, "الله يرحمه ويغفر له");
    assert.ok(!poster.items.some((item) => item.id === "relatives" || item.id === "notes"));
  }],
  ["map link alone keeps its audience card visible", () => {
    const { poster } = build(makeRequest({ condolenceOptions: ["men"], condolences: [{ audience: "men", mapLink: "https://example.com/men" }] }));
    const men = sectionById(poster, "men");
    assert.equal(men?.text, "");
    assert.equal(men?.qr?.url, "https://example.com/men");
  }],
  ["image editor edits flow back into the saved request", () => {
    const request = makeRequest({
      condolenceOptions: ["men"],
      condolences: [{ audience: "men", location: "مجلس", area: "الدفنة" }],
    });
    const draft = createCondolenceImageDraft(request);
    draft.cards[0].location = "مجلس العائلة";
    draft.cards[0].durationDays = "3";
    const edited = applyImageDraft(request, draft);
    assert.equal(edited.condolences[0].location, "مجلس العائلة");
    assert.equal(edited.condolences[0].durationDays, 3);
    assert.equal(edited.condolences[0].area, "الدفنة");
  }],
  ["long request preserves every populated value in order", () => {
    const request = makeRequest({
      deceasedPeople: [{
        title: "الوالد",
        fullName: "عبدالله محمد عبدالله",
        gender: "man",
        age: 72,
        nationality: "مصري",
        deathPlace: "لندن",
        occupation: "مهندس متقاعد",
        note: "كان محباً للخير",
      }],
      relatives: [
        { relation: "", relationKey: "children", people: [{ name: "ناصر", occupation: "طبيب", deceased: false }] },
      ],
      prayer: { enabled: true, day: "الخميس", time: "بعد صلاة العصر", place: "مسجد الإمام", mapLink: "https://example.com/prayer" },
      burial: { status: "upcoming", outsideQatar: false, day: "الخميس", time: "بعد صلاة المغرب", cemetery: "مقبرة مسيمير", mapLink: "https://example.com/burial" },
      condolenceOptions: ["men", "women", "phone"],
      condolences: [
        { audience: "men", start: "الخميس", durationDays: 3, time: "بعد العصر", location: "مجلس العائلة", area: "الدفنة", houseNumber: "١٢", mapLink: "https://example.com/men" },
        { audience: "women", start: "الخميس", durationDays: 3, location: "منزل العائلة", area: "الهلال", mapLink: "https://example.com/women" },
      ],
      condolencePhoneContacts: [{ name: "ناصر عبدالله", phone: "55551234" }],
      notes: "ملاحظة طويلة للاختبار: ".concat("تفاصيل إضافية ".repeat(80)),
    });
    const { poster } = build(request);
    assert.deepEqual(
      poster.items.map((item) => item.id),
      ["deceased-details", "relatives", "prayer", "burial", "men", "women", "phone", "notes", "closing"],
    );
    const text = JSON.stringify(poster);
    for (const value of [
      "الوالد عبدالله محمد عبدالله", "وكانت الوفاة في لندن", "72 عاماً — مصري", "مهندس متقاعد", "ناصر (طبيب)",
      "صلاة الجنازة يوم الخميس بعد صلاة العصر في مسجد الإمام", "والدفن يوم الخميس بعد صلاة المغرب في مقبرة مسيمير",
      "لمدة 3 أيام", "منزل رقم ١٢", "ملاحظة طويلة للاختبار:",
      "https://example.com/men", "https://example.com/women", "https://example.com/prayer", "https://example.com/burial",
    ]) {
      assert.ok(text.includes(value), `expected poster data to include: ${value}`);
    }
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
