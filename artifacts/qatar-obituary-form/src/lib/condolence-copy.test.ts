import assert from "node:assert/strict";
import type { ObituaryRequest } from "@workspace/api-client-react";
import {
  buildCondolencePosterContent,
  createCondolenceImageDraft,
  formatDeceasedIdentity,
  formatRelativePerson,
  makeDeathStatement,
} from "./condolence-copy";

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
    burial: { status: "upcoming", outsideQatar: false },
    condolenceOptions: [],
    condolences: [],
    condolencePhoneContacts: [],
    ...overrides,
  } as ObituaryRequest;
}

function build(request: ObituaryRequest) {
  const draft = createCondolenceImageDraft(request);
  const qrUrls = {
    men: draft.men?.mapLink || "",
    women: draft.women?.mapLink || "",
    prayer: draft.prayerMapLink,
    burial: draft.burialMapLink,
  };
  return {
    draft,
    poster: buildCondolencePosterContent(request, draft, qrUrls),
  };
}

function allPosterText(request: ObituaryRequest) {
  const { poster } = build(request);
  return JSON.stringify(poster);
}

const cases: Array<[string, () => void]> = [
  ["single deceased man", () => {
    assert.equal(makeDeathStatement([{ gender: "man" }]), "انتقل إلى رحمة الله تعالى");
  }],
  ["single deceased woman", () => {
    assert.equal(makeDeathStatement([{ gender: "woman" }]), "انتقلت إلى رحمة الله تعالى");
  }],
  ["two deceased people", () => {
    assert.equal(makeDeathStatement([{ gender: "man" }, { gender: "man" }]), "انتقلا إلى رحمة الله تعالى");
  }],
  ["more than two deceased people", () => {
    assert.equal(
      makeDeathStatement([{ gender: "man" }, { gender: "woman" }, { gender: "man" }]),
      "انتقلوا إلى رحمة الله تعالى",
    );
  }],
  ["harem identity", () => {
    assert.equal(
      formatDeceasedIdentity("حرم الشيخ عبدالله", "عائشة محمد"),
      "حرم الشيخ عبدالله، عائشة محمد",
    );
  }],
  ["deceased relative wording", () => {
    const text = formatRelativePerson({ name: "مريم", deceased: true }, "والدة");
    assert.match(text, /رحمها الله تعالى/u);
    assert.doesNotMatch(text, /متوفى|متوفاة/u);
  }],
  ["men-only condolence module", () => {
    const request = makeRequest({
      condolences: [{ audience: "men", location: "مجلس العائلة" }],
    });
    const { poster } = build(request);
    assert.ok(poster.items.some((item) => item.kind === "section" && item.id === "men"));
    assert.ok(!poster.items.some((item) => item.kind === "section" && item.id === "women"));
  }],
  ["women-only condolence module", () => {
    const request = makeRequest({
      condolences: [{ audience: "women", location: "منزل العائلة" }],
    });
    const { poster } = build(request);
    assert.ok(poster.items.some((item) => item.kind === "section" && item.id === "women"));
    assert.ok(!poster.items.some((item) => item.kind === "section" && item.id === "men"));
  }],
  ["men and women modules and labeled QR codes", () => {
    const request = makeRequest({
      condolences: [
        { audience: "men", location: "مجلس العائلة", mapLink: "https://example.com/men" },
        { audience: "women", location: "منزل العائلة", mapLink: "https://example.com/women" },
      ],
    });
    const { poster } = build(request);
    const men = poster.items.find((item) => item.kind === "section" && item.id === "men");
    const women = poster.items.find((item) => item.kind === "section" && item.id === "women");
    assert.ok(men?.kind === "section");
    assert.ok(women?.kind === "section");
    if (men?.kind === "section" && women?.kind === "section") {
      assert.equal(men.label, "عزاء الرجال");
      assert.equal(men.qr?.label, "موقع الرجال");
      assert.equal(men.qr?.url, "https://example.com/men");
      assert.equal(women.label, "عزاء النساء");
      assert.equal(women.qr?.label, "موقع النساء");
      assert.equal(women.qr?.url, "https://example.com/women");
    }
  }],
  ["phone-only contact details", () => {
    const request = makeRequest({
      condolenceOptions: ["phone"],
      condolencePhoneContacts: [{ name: "ناصر", phone: "55551234" }],
    });
    const { poster } = build(request);
    const phone = poster.items.find((item) => item.kind === "section" && item.id === "phone");
    assert.ok(phone?.kind === "section");
    if (phone?.kind === "section") assert.match(phone.text, /ناصر — 55551234/u);
  }],
  ["short request remains complete", () => {
    const request = makeRequest();
    const { poster } = build(request);
    assert.equal(poster.names, "عبدالله محمد عبدالله");
    assert.equal(poster.statement, "انتقل إلى رحمة الله تعالى");
    assert.ok(poster.items.some((item) => item.kind === "section" && item.id === "closing"));
    assert.ok(!poster.items.some((item) => item.id === "relatives" || item.id === "notes"));
  }],
  ["map link alone keeps its audience card visible", () => {
    const request = makeRequest({
      condolences: [{ audience: "men", mapLink: "https://example.com/men" }],
    });
    const { poster } = build(request);
    const men = poster.items.find((item) => item.kind === "section" && item.id === "men");
    assert.ok(men?.kind === "section");
    if (men?.kind === "section") {
      assert.equal(men.text, "");
      assert.equal(men.qr?.url, "https://example.com/men");
    }
  }],
  ["long request preserves every populated value", () => {
    const request = makeRequest({
      deceasedPeople: [{
        fullName: "عبدالله محمد عبدالله",
        gender: "man",
        age: 72,
        nationality: "قطري",
        deathPlace: "مستشفى حمد العام",
        occupation: "مهندس متقاعد",
        note: "كان محباً للخير وخدمة المجتمع",
      }],
      relatives: [
        {
          relation: "أبناء",
          familyReference: "آل عبدالله",
          people: [{ name: "ناصر عبدالله", occupation: "طبيب", deceased: false }],
        },
        {
          relation: "حرم فلان",
          familyReference: "الأسرة",
          people: [{ name: "مريم عبدالله", occupation: "معلمة", deceased: true }],
        },
      ],
      prayer: {
        enabled: true,
        day: "الخميس ٢٥ سبتمبر",
        time: "بعد صلاة العصر",
        place: "مسجد الإمام محمد بن عبدالوهاب",
        mapLink: "https://example.com/prayer",
      },
      burial: {
        status: "upcoming",
        day: "الخميس ٢٥ سبتمبر",
        time: "بعد صلاة المغرب",
        cemetery: "مقبرة مسيمير",
        mapLink: "https://example.com/burial",
        outsideQatar: false,
      },
      condolences: [
        {
          audience: "men",
          start: "الخميس",
          durationDays: 3,
          time: "بعد العصر",
          location: "مجلس العائلة",
          area: "الدفنة",
          street: "شارع الكورنيش",
          houseNumber: "١٢",
          buildingNumber: "٢",
          floor: "الأول",
          apartmentNumber: "٣",
          locationNotes: "المدخل الجانبي",
          mapLink: "https://example.com/men",
        },
        {
          audience: "women",
          start: "الخميس",
          durationDays: 3,
          time: "بعد العصر",
          location: "منزل العائلة",
          area: "الهلال",
          mapLink: "https://example.com/women",
        },
      ],
      condolencePhoneContacts: [{ name: "ناصر عبدالله", phone: "55551234" }],
      notes: "ملاحظة طويلة للاختبار: ".concat("تفاصيل إضافية ".repeat(80)),
    });
    const { poster } = build(request);
    const text = allPosterText(request);
    assert.deepEqual(
      poster.items.map((item) => item.id),
      ["deceased-details", "prayer", "burial", "men", "women", "relatives", "phone", "notes", "closing"],
    );
    for (const value of [
      "عبدالله محمد عبدالله",
      "العمر: 72",
      "الجنسية: قطري",
      "مكان الوفاة: مستشفى حمد العام",
      "العمل: طبيب",
      "رحمها الله تعالى",
      "آل عبدالله",
      "مسجد الإمام محمد بن عبدالوهاب",
      "حالة الدفن: سيتم الدفن",
      "مقبرة مسيمير",
      "المدة: 3 أيام",
      "رقم المنزل: ١٢",
      "رقم المبنى: ٢",
      "الطابق: الأول",
      "رقم الشقة: ٣",
      "ملاحظة طويلة للاختبار:",
      "https://example.com/men",
      "https://example.com/women",
      "https://example.com/prayer",
      "https://example.com/burial",
    ]) {
      assert.ok(text.includes(value), `expected poster data to include: ${value}`);
    }
    const qrSections = poster.items.filter((item) => item.kind === "section" && item.qr);
    assert.deepEqual(qrSections.map((item) => item.id), ["prayer", "burial", "men", "women"]);
  }],
];

for (const [name, test] of cases) {
  test();
  console.log(`✓ ${name}`);
}

console.log(`Passed ${cases.length} condolence-content cases.`);