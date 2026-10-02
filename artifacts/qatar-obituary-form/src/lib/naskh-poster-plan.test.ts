/**
 * اختبارات مخطّط قالب «النسخ الرسمي» بدالة قياس وهمية (بلا Canvas):
 * الترتيب، والعناوين العريضة، وعدم كسر «رحمه الله» والأوقات، والضبط التلقائي (الاسم ثم التصغير ثم الإطالة).
 */
import assert from "node:assert/strict";
import type { ObituaryRequest } from "@workspace/api-client-react";
import { normalizeObituaryPresentation } from "./presentation-normalizer";
import {
  NASKH_METRICS,
  buildNaskhSections,
  planNaskhLayout,
  splitLeadingLabel,
  tokenizeArabic,
  wrapAtoms,
  type MeasureFn,
  type NaskhPlanOptions,
} from "./naskh-poster-plan";

function makeRequest(overrides: Partial<ObituaryRequest> = {}): ObituaryRequest {
  return {
    id: 1,
    requestNumber: "QA-TEST",
    createdAt: "2026-09-25T10:00:00.000Z",
    updatedAt: "2026-09-25T10:00:00.000Z",
    status: "ready",
    deceasedPeople: [{ fullName: "محمد بن عبدالله بن سالم", title: "الوالد", gender: "man" }],
    relatives: [{ relation: "الأبناء", relationKey: "children", people: [{ name: "أحمد", deceased: false }, { name: "محمد", deceased: false }] }],
    prayer: { enabled: false },
    burial: { status: "upcoming", outsideQatar: false, day: "اليوم", time: "بعد صلاة المغرب", cemetery: "مقبرة مسيمير" },
    condolenceOptions: ["men", "women"],
    condolences: [
      { audience: "men", location: "مجلس العائلة", area: "الدفنة", mapLink: "https://maps.google.com/?q=men" },
      { audience: "women", location: "منزل العائلة", area: "الدفنة", mapLink: "https://maps.google.com/?q=women", schedule: [{ days: "الفترة الصباحية", time: "من 9:00 صباحاً إلى 12:00 ظهراً" }, { days: "الفترة المسائية", time: "من 4:00 مساءً إلى 9:00 مساءً" }] },
    ],
    condolencePhoneContacts: [],
    ...overrides,
  } as ObituaryRequest;
}

// قياس وهمي ثابت: كل حرف يساوي 0.55 من حجم الخط (أعرض من الواقع قليلاً ليُجبر الالتفاف في الحالات الطويلة)
const measure: MeasureFn = (text, font) => text.length * font.px * 0.55;
const options: NaskhPlanOptions = { openingIsImage: true, qrAvailable: { men: true, women: true, prayerBurialCombined: true, burial: true, prayer: true } };
const plan = (request: ObituaryRequest, extra: Partial<NaskhPlanOptions> = {}) => planNaskhLayout(normalizeObituaryPresentation(request), measure, { ...options, ...extra });
const lineItems = (p: ReturnType<typeof plan>) => p.items.filter((item): item is Extract<typeof item, { kind: "line" }> => item.kind === "line");
const lineText = (item: Extract<ReturnType<typeof plan>["items"][number], { kind: "line" }>) => item.runs.map((run) => run.text).join(" ");

const cases: Array<[string, () => void]> = [
  ["tokenizer keeps mercy phrases, times and isolates together", () => {
    assert.deepEqual(tokenizeArabic("ناصر وبدر رحمه الله وسمير"), ["ناصر", "وبدر رحمه الله", "وسمير"]);
    assert.deepEqual(tokenizeArabic("بدر (رحمه الله) وخالد"), ["بدر (رحمه الله)", "وخالد"]);
    assert.deepEqual(tokenizeArabic("الفترة المسائية من 4:00 مساءً إلى 9:00 مساءً"), ["الفترة", "المسائية", "من 4:00 مساءً", "إلى 9:00 مساءً"]);
    assert.deepEqual(tokenizeArabic("والدها: ⁦55 123 456⁩"), ["والدها:", "⁦55 123 456⁩"]);
    assert.deepEqual(tokenizeArabic("   "), []);
  }],
  ["wrapping never splits an atom and respects the width", () => {
    const width = (text: string) => text.length * 10;
    const lines = wrapAtoms(["كلمة", "ثانية", "ثالثة", "رابعة"], 110, width);
    assert.deepEqual(lines, ["كلمة ثانية", "ثالثة رابعة"]);
    assert.ok(lines.every((line) => width(line) <= 110));
    assert.deepEqual(wrapAtoms(["كلمةطويلةجداًجداً"], 40, width), ["كلمةطويلةجداًجداً"]);
    assert.deepEqual(wrapAtoms([], 100, width), []);
  }],
  ["leading labels: the longest known label wins", () => {
    assert.deepEqual(splitLeadingLabel("الدفن اليوم بعد صلاة العصر في مقبرة مسيمير"), { label: "الدفن", rest: "اليوم بعد صلاة العصر في مقبرة مسيمير" });
    assert.deepEqual(splitLeadingLabel("تم الدفن في مكة المكرمة"), { label: "تم الدفن", rest: "في مكة المكرمة" });
    assert.deepEqual(splitLeadingLabel("والدفن في مقبرة مسيمير"), { label: "والدفن", rest: "في مقبرة مسيمير" });
    assert.deepEqual(splitLeadingLabel("عزاء الرجال في المقبرة فقط", ["عزاء الرجال"]), { label: "عزاء الرجال", rest: "في المقبرة فقط" });
    assert.equal(splitLeadingLabel("في مجلس العائلة"), null);
  }],
  ["sections follow the archive order with archive labels", () => {
    const sections = buildNaskhSections(normalizeObituaryPresentation(makeRequest()));
    assert.deepEqual(sections.map((section) => section.id), ["head", "relatives", "burial", "men", "women", "closing"]);
    const [head, relatives, burial, men, women] = sections;
    assert.deepEqual(head.rows.slice(0, 2), [{ style: "statement", text: "توفي" }, { style: "name", text: "الوالد / محمد بن عبدالله بن سالم" }]);
    assert.deepEqual(relatives.rows, [{ style: "heading", text: "والد كل من:" }, { style: "body", text: "أحمد ومحمد" }]);
    assert.deepEqual(burial.rows[0], { style: "body", label: "الدفن", text: "اليوم بعد صلاة المغرب في مقبرة مسيمير" });
    assert.equal(burial.qrKey, undefined, "مسيمير بلا رمز موقع");
    assert.deepEqual(men.rows, [{ style: "body", label: "عزاء الرجال", text: "في مجلس العائلة بمنطقة الدفنة" }]);
    assert.equal(men.qrKey, "men");
    assert.deepEqual(women.rows, [
      { style: "body", label: "والنساء", text: "في منزل العائلة بمنطقة الدفنة" },
      { style: "body", text: "الفترة الصباحية من 9:00 صباحاً إلى 12:00 ظهراً" },
      { style: "body", text: "الفترة المسائية من 4:00 مساءً إلى 9:00 مساءً" },
    ]);
  }],
  ["women-only venue keeps «عزاء النساء»; numbered venues get a heading", () => {
    const sections = buildNaskhSections(normalizeObituaryPresentation(makeRequest({
      condolenceOptions: ["women"],
      condolences: [{ audience: "women", location: "منزل ابنها أحمد" }, { audience: "women", location: "منزل ابنها محمد" }],
    })));
    const women = sections.find((section) => section.id === "women");
    assert.ok(women);
    assert.deepEqual(women.rows, [
      { style: "heading", text: "عزاء النساء" },
      { style: "body", label: "الموقع الأول:", text: "في منزل ابنها أحمد" },
      { style: "body", label: "الموقع الثاني:", text: "في منزل ابنها محمد" },
    ]);
    assert.ok(!sections.some((section) => section.id === "men"));
  }],
  ["separate mosque prayer, phones and notes appear in order", () => {
    const sections = buildNaskhSections(normalizeObituaryPresentation(makeRequest({
      prayer: { enabled: true, day: "اليوم", time: "بعد صلاة العصر", place: "مسجد حمد بن علي", mapLink: "https://example.com/prayer" },
      condolenceOptions: ["phone"],
      condolences: [],
      condolencePhoneContacts: [{ name: "ابنه أحمد", phone: "55555555" }],
      notes: "يرجى عدم الحضور بالأطفال",
    })));
    assert.deepEqual(sections.map((section) => section.id), ["head", "relatives", "prayer", "burial", "phone", "notes", "closing"]);
    const prayer = sections.find((section) => section.id === "prayer")!;
    assert.deepEqual(prayer.rows[0], { style: "body", label: "صلاة الجنازة", text: "اليوم بعد صلاة العصر في مسجد حمد بن علي" });
    assert.equal(prayer.qrKey, "prayer");
    assert.equal(sections.find((section) => section.id === "phone")!.rows[0].text, "للتعزية عبر الهاتف");
  }],
  ["a shared start is its own row before the venues, and «no relatives» fills the relatives slot", () => {
    const sections = buildNaskhSections(normalizeObituaryPresentation(makeRequest({
      relatives: [],
      noRelatives: true,
      condolences: [
        { audience: "men", location: "خيمة بجانب الجامع", start: "غداً", mapLink: "https://maps.google.com/?q=men" },
        { audience: "women", location: "منزل الفقيد رقم 50", start: "غداً" },
      ],
    } as never)));
    assert.deepEqual(sections.map((section) => section.id), ["head", "relatives", "burial", "condolenceStart", "men", "women", "closing"]);
    assert.deepEqual(sections[1].rows, [{ style: "body", text: "ليس لديه أقارب" }]);
    assert.deepEqual(sections[3].rows, [{ style: "body", label: "العزاء", text: "من الغد" }]);
    assert.deepEqual(sections[4].rows, [{ style: "body", label: "عزاء الرجال", text: "في خيمة بجانب الجامع" }]);
    assert.deepEqual(sections[5].rows, [{ style: "body", label: "والنساء", text: "في منزل الفقيد رقم 50" }]);
  }],
  ["a common announcement fits the base height at full size", () => {
    const p = plan(makeRequest());
    assert.equal(p.height, 1350);
    assert.equal(p.overflow, false);
    assert.equal(p.namePx, 62);
    assert.ok(p.scale >= 1, `scale ${p.scale}`);
    assert.ok(p.gap >= NASKH_METRICS.minGap && p.gap <= NASKH_METRICS.maxGap);
    const band = p.items.find((item) => item.kind === "band")!;
    assert.equal(band.y, 1350 - 36 - 96);
    const qrs = p.items.filter((item) => item.kind === "qr");
    assert.deepEqual(qrs.map((item) => item.key), ["men", "women"]);
    assert.ok(qrs.every((item) => item.size >= 150 && item.x === NASKH_METRICS.inset));
    assert.ok(lineItems(p).every((item) => item.y >= NASKH_METRICS.top && item.y + item.h <= band.y));
    assert.ok(lineItems(p).some((item) => item.runs[0]?.weight === 700 && item.runs[0]?.text === "والنساء"));
  }],
  ["no QR item when the venue has no map", () => {
    const p = plan(makeRequest(), { qrAvailable: {} });
    assert.ok(!p.items.some((item) => item.kind === "qr"));
  }],
  ["a long name shrinks to two lines before anything else", () => {
    const p = plan(makeRequest({ deceasedPeople: [{ fullName: "محمد بن عبدالله بن سالم بن ناصر بن خليفة بن حمد", title: "الوالد", gender: "man" }] }));
    const nameLines = lineItems(p).filter((item) => item.section === "head" && Math.abs(item.px - p.namePx * p.scale) < 0.01);
    assert.ok(nameLines.length <= 2, `name lines ${nameLines.length}`);
    assert.ok(p.namePx <= 62);
  }],
  ["a heavy announcement grows the image instead of shrinking the text below 32px", () => {
    const many = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => ({ name: `${prefix}${index + 1}`, deceased: index % 5 === 4 }));
    const heavy = makeRequest({
      deceasedPeople: [{ fullName: "نورة بنت محمد بن ناصر", title: "الوالدة", gender: "woman", age: 82 }],
      relatives: [
        { relation: "الأبناء", relationKey: "children", people: many("عبدالله", 9) },
        { relation: "الإخوة", relationKey: "siblings", people: many("ناصر", 12) },
        { relation: "أخرى", relationKey: "other", relationType: "خالة", people: many("أحمد", 6) },
      ],
      condolences: [
        { audience: "men", location: "مجلس العائلة", area: "الدفنة", start: "غداً", durationDays: 3, mapLink: "https://maps.google.com/?q=men" },
        { audience: "women", location: "منزل ابنها عبدالله", area: "الوعب", start: "غداً", durationDays: 3, mapLink: "https://maps.google.com/?q=women", schedule: [{ days: "الفترة الصباحية", time: "من 9:00 صباحاً إلى 12:00 ظهراً" }, { days: "الفترة المسائية", time: "من 4:00 مساءً إلى 9:00 مساءً" }] },
      ],
      notes: "يرجى الاكتفاء بالعزاء في المجلس",
    });
    const p = plan(heavy);
    assert.ok(p.height > 1350 && p.height <= 1800 && p.height % 90 === 0, `height ${p.height}`);
    assert.ok(p.scale >= 0.9, `scale ${p.scale}`);
    assert.ok(p.minTextPx >= 32, `min text ${p.minTextPx}`);
    assert.equal(p.overflow, false);
    const band = p.items.find((item) => item.kind === "band")!;
    assert.ok(lineItems(p).every((item) => item.y + item.h <= band.y + 0.5));
    // الحد الأقصى 1350 يجعل الإعلان نفسه يفيض بدل أن يصغر تحت 32
    const capped = plan(heavy, { maxHeight: 1350 });
    assert.equal(capped.height, 1350);
    assert.equal(capped.overflow, true);
    assert.ok(capped.minTextPx >= 32);
  }],
  ["an edited opening phrase is drawn as text", () => {
    const content = normalizeObituaryPresentation(makeRequest(), { opening: "بسم الله الرحمن الرحيم" });
    const p = planNaskhLayout(content, measure, { ...options, openingIsImage: false });
    const opening = p.items.find((item) => item.kind === "opening")!;
    assert.equal(opening.text, "بسم الله الرحمن الرحيم");
    assert.ok(lineText(lineItems(p)[0]) === "توفي");
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
  console.error(`${failed} of ${cases.length} naskh plan cases failed.`);
  process.exit(1);
}
console.log(`Passed ${cases.length} naskh plan cases.`);
