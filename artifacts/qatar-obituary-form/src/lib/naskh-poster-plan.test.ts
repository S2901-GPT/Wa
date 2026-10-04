/**
 * اختبارات مخطّط قالب «النسخ الرسمي» بدالة قياس وهمية (بلا Canvas):
 * الترتيب، والعناوين العريضة، وعدم كسر «رحمه الله» والأوقات، والضبط التلقائي (الاسم ثم التصغير ثم الإطالة).
 */
import assert from "node:assert/strict";
import type { ObituaryRequest } from "@workspace/api-client-react";
import { normalizeObituaryPresentation } from "./presentation-normalizer";
import {
  NASKH_LAYOUTS,
  NASKH_METRICS,
  buildNaskhSections,
  planNaskhLayout,
  posterQrUrls,
  splitLeadingLabel,
  tokenizeArabic,
  wrapAtoms,
  type MeasureFn,
  type NaskhPlanOptions,
  toArabicIndicDigits,
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
  ["poster digits: Latin digits become Arabic-Indic, existing ones stay", () => {
    assert.equal(toArabicIndicDigits("الساعة 9:30 مساءً، منزل رقم 86، لمدة 3 أيام"), "الساعة ٩:٣٠ مساءً، منزل رقم ٨٦، لمدة ٣ أيام");
    assert.equal(toArabicIndicDigits("منزل رقم ٨٦"), "منزل رقم ٨٦");
    assert.equal(toArabicIndicDigits("بلا أرقام"), "بلا أرقام");
  }],
  ["tokenizer keeps a number with its word: رقم، لمدة، الساعة", () => {
    const atoms = tokenizeArabic("في منزل الفقيد بمنطقة النصر، منزل رقم 86 لمدة 3 أيام الساعة 9:30 مساءً");
    assert.ok(atoms.includes("رقم\u00A086"), JSON.stringify(atoms));
    assert.ok(atoms.includes("لمدة\u00A03"), JSON.stringify(atoms));
    assert.ok(atoms.includes("الساعة\u00A09:30\u00A0مساءً"), JSON.stringify(atoms));
  }],
  ["tokenizer keeps mercy phrases, times and isolates together", () => {
    assert.deepEqual(tokenizeArabic("ناصر وبدر رحمه الله وسمير"), ["ناصر", "وبدر رحمه الله", "وسمير"]);
    assert.deepEqual(tokenizeArabic("بدر (رحمه الله) وخالد"), ["بدر (رحمه الله)", "وخالد"]);
    assert.deepEqual(tokenizeArabic("الفترة المسائية من 4:00 مساءً إلى 9:00 مساءً"), ["الفترة", "المسائية", "من 4:00 مساءً", "إلى 9:00 مساءً"]);
    assert.deepEqual(tokenizeArabic("والدها: ⁦55 123 456⁩"), ["والدها:", "⁦55 123 456⁩"]);
    assert.deepEqual(tokenizeArabic("مبارك (وزارة الداخلية - متقاعد) وعبدالله"), ["مبارك\u00A0(وزارة\u00A0الداخلية\u00A0-\u00A0متقاعد)", "وعبدالله"]);
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
  ["women-only venue keeps «عزاء النساء»; several venues become separate sections, each with its own title", () => {
    const sections = buildNaskhSections(normalizeObituaryPresentation(makeRequest({
      condolenceOptions: ["women"],
      condolences: [{ audience: "women", location: "منزل ابنها أحمد" }, { audience: "women", location: "منزل ابنها محمد" }],
    })));
    const women = sections.filter((section) => section.id === "women" || section.id === "women-2");
    assert.deepEqual(women.map((section) => [section.id, section.title]), [["women", "عزاء النساء الأول"], ["women-2", "عزاء النساء الثاني"]]);
    assert.deepEqual(women[0].rows, [{ style: "body", label: "عزاء النساء الأول", text: "في منزل ابنها أحمد" }]);
    assert.deepEqual(women[1].rows, [{ style: "body", label: "عزاء النساء الثاني", text: "في منزل ابنها محمد" }]);
    assert.ok(!sections.some((section) => section.id === "men"));
  }],
  ["every venue with a map link gets its own QR code beside its own text", () => {
    const request = makeRequest({
      condolences: [
        { audience: "men", location: "مجلس العائلة", mapLink: "https://maps.google.com/?q=men" },
        { audience: "women", location: "منزل الفقيد", area: "أم قرن", durationDays: 3, mapLink: "https://maps.google.com/?q=w1" },
        { audience: "women", location: "منزل عائلة الانصاري", area: "المعمورة", mapLink: "https://maps.google.com/?q=w2" },
      ],
    });
    const content = normalizeObituaryPresentation(request);
    assert.deepEqual(posterQrUrls(content), {
      prayer: undefined, burial: undefined, prayerBurialCombined: undefined,
      men: "https://maps.google.com/?q=men", women: "https://maps.google.com/?q=w1", "women-2": "https://maps.google.com/?q=w2",
    });
    const sections = buildNaskhSections(content);
    assert.deepEqual(sections.filter((section) => section.qrKey).map((section) => section.qrKey), ["men", "women", "women-2"]);
    const all = { men: true, women: true, "women-2": true } as const;
    for (const layout of NASKH_LAYOUTS) {
      const p = plan(request, { layout: layout.id, qrAvailable: all });
      assert.deepEqual(p.items.filter((item) => item.kind === "qr").map((item) => item.key).sort(), ["men", "women", "women-2"], `${layout.id}: three QR codes`);
      assert.equal(p.overflow, false, layout.id);
      // كل رمز على مستوى نص موقعه
      for (const qr of p.items.filter((item): item is Extract<typeof item, { kind: "qr" }> => item.kind === "qr")) {
        const own = lineItems(p).filter((item) => item.section === qr.key);
        assert.ok(own.length > 0, `${layout.id}: text for ${qr.key}`);
        const top = Math.min(...own.map((item) => item.y));
        const bottom = Math.max(...own.map((item) => item.y + item.h));
        assert.ok(qr.y < bottom && qr.y + qr.size > top, `${layout.id}: ${qr.key} QR next to its text`);
      }
    }
    // عمودان لا يُستعملان إلا حين يكون لكل جمهور موقع واحد
    assert.ok(!plan(request, { layout: "cols", qrAvailable: all }).items.some((item) => item.kind === "vline"), "stacked rows with several venues");
  }],
  ["a venue without a map link has no QR key, and a single venue keeps «men»/«women»", () => {
    const content = normalizeObituaryPresentation(makeRequest({
      condolences: [
        { audience: "men", location: "مجلس العائلة" },
        { audience: "women", location: "منزل العائلة", mapLink: "https://maps.google.com/?q=w" },
      ],
    }));
    const urls = posterQrUrls(content);
    assert.equal(urls.men, undefined);
    assert.equal(urls.women, "https://maps.google.com/?q=w");
    assert.ok(!("women-2" in urls));
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
    const phone = sections.find((section) => section.id === "phone")!;
    assert.equal(phone.rows[0].text, "العزاء عبر الهاتف");
    assert.ok(!JSON.stringify(phone.rows).includes("55555555"), "لا تُنشر أرقام الهواتف في الصورة");
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
  ["every layout fits the common announcement without overflow and keeps every item inside the image", () => {
    for (const layout of NASKH_LAYOUTS) {
      const p = plan(makeRequest(), { layout: layout.id });
      assert.equal(p.layout, layout.id);
      assert.equal(p.overflow, false, layout.id);
      assert.equal(p.height, 1350, layout.id);
      assert.ok(p.minTextPx >= 32, `${layout.id}: min text ${p.minTextPx}`);
      for (const item of lineItems(p)) {
        assert.ok(item.y >= 0 && item.y + item.h <= p.height, `${layout.id}: line outside the image`);
        assert.ok(item.xRight <= NASKH_METRICS.width && item.runs.every((run) => run.text !== undefined), layout.id);
      }
      assert.ok(lineItems(p).some((item) => item.runs.map((run) => run.text).join(" ").includes("نبيل") === false), layout.id);
      assert.equal(p.items.filter((item) => item.kind === "qr").length, 2, `${layout.id}: both venue QR codes`);
    }
  }],
  ["centered layouts centre the name and box the relatives on the right edge of the widest line", () => {
    const p = plan(makeRequest(), { layout: "center" });
    const name = lineItems(p).find((item) => item.section === "head" && item.runs[0]?.weight === 700)!;
    assert.equal(name.align, "center");
    assert.ok(name.xRight < NASKH_METRICS.width - NASKH_METRICS.inset && name.xRight > NASKH_METRICS.width / 2, `name xRight ${name.xRight}`);
    const relatives = lineItems(p).filter((item) => item.section === "relatives");
    assert.ok(relatives.length >= 2 && relatives.every((item) => item.align === "right" && item.xRight === relatives[0].xRight), "relatives share one right edge");
    const separators = p.items.filter((item): item is Extract<typeof item, { kind: "separator" }> => item.kind === "separator");
    assert.ok(separators.every((item) => item.width === NASKH_METRICS.shortSeparator && item.x === (NASKH_METRICS.width - NASKH_METRICS.shortSeparator) / 2), "short centred separators");
    // العزاء موسّط بين فراغين متساويين ورمزه في اليسار
    const men = lineItems(p).find((item) => item.section === "men")!;
    assert.equal(men.align, "center");
    assert.ok(p.items.some((item) => item.kind === "qr" && item.key === "men" && item.x === NASKH_METRICS.inset));
  }],
  ["the table layout puts each group, the burial and each venue in a bordered row with a bold key column", () => {
    const p = plan(makeRequest(), { layout: "table" });
    const separators = p.items.filter((item) => item.kind === "separator");
    // صف الأقارب (مجموعة واحدة) + الدفن + عزاءان = 4 صفوف لها 4 حدود علوية وحد سفلي
    assert.equal(separators.length, 5);
    const keys = lineItems(p).filter((item) => item.xRight === NASKH_METRICS.width - NASKH_METRICS.inset && item.runs[0]?.weight === 700 && item.section !== "head");
    // قد يلتف العنوان الطويل في عمود المفاتيح على سطرين، فنقارن النص المتصل
    assert.equal(keys.map(lineText).join(" "), "والد كل من الدفن عزاء الرجال عزاء النساء");
    const values = lineItems(p).filter((item) => item.section === "women" && item.runs[0]?.weight === 400);
    assert.ok(values.every((item) => item.xRight === NASKH_METRICS.width - NASKH_METRICS.inset - Math.round(NASKH_METRICS.tableKeyWidth * p.scale) - NASKH_METRICS.tableGap));
    assert.ok(lineItems(p).some((item) => item.section === "head" && item.align === "center"));
  }],
  ["the two-column layout places the venues side by side with a vertical rule and the QR codes underneath", () => {
    const p = plan(makeRequest(), { layout: "cols" });
    const vline = p.items.find((item): item is Extract<typeof item, { kind: "vline" }> => item.kind === "vline")!;
    assert.ok(vline && vline.x === NASKH_METRICS.width / 2);
    const men = lineItems(p).filter((item) => item.section === "men");
    const women = lineItems(p).filter((item) => item.section === "women");
    assert.ok(men.every((item) => item.xRight > NASKH_METRICS.width / 2) && women.every((item) => item.xRight < NASKH_METRICS.width / 2), "men right, women left");
    assert.deepEqual([lineText(men[0]), lineText(women[0])], ["عزاء الرجال", "عزاء النساء"]);
    const qrs = p.items.filter((item): item is Extract<typeof item, { kind: "qr" }> => item.kind === "qr");
    assert.ok(qrs.every((qr) => [...men, ...women].filter((item) => item.section === qr.key).every((item) => item.y + item.h <= qr.y + 0.5)), "QR below the column text");
    // عزاء واحد: لا أعمدة
    const single = plan(makeRequest({ condolenceOptions: ["men"], condolences: [{ audience: "men", location: "مجلس العائلة", mapLink: "https://maps.google.com/?q=men" }] }), { layout: "cols" });
    assert.ok(!single.items.some((item) => item.kind === "vline"));
  }],
  ["the newspaper layout frames the image, insets the content and joins the verb to the name", () => {
    const p = plan(makeRequest(), { layout: "paper" });
    const frame = p.items.find((item): item is Extract<typeof item, { kind: "frame" }> => item.kind === "frame")!;
    assert.deepEqual([frame.x, frame.y, frame.width, frame.height], [30, 30, 1020, 1290]);
    const nameLines = lineItems(p).filter((item) => item.section === "head" && Math.abs(item.px - p.namePx * p.scale) < 0.01);
    assert.equal(nameLines.map(lineText).join(" "), "توفي الوالد / محمد بن عبدالله بن سالم");
    assert.ok(!lineItems(p).some((item) => lineText(item) === "توفي"), "no separate statement line");
    assert.ok(p.namePx <= 56 && p.namePx >= 54, `name px ${p.namePx}`);
    const band = p.items.find((item): item is Extract<typeof item, { kind: "band" }> => item.kind === "band")!;
    assert.deepEqual([band.position, band.y, band.x], ["bottom", 1350 - 52 - 96, 92]);
    assert.ok(lineItems(p).every((item) => item.xRight <= NASKH_METRICS.width - 92));
  }],
  ["the headings layout writes a bold title line above the burial and each venue", () => {
    const p = plan(makeRequest(), { layout: "headings" });
    const headings = lineItems(p).filter((item) => item.runs.length === 1 && item.runs[0].weight === 700 && item.section !== "head" && item.section !== "closing" && item.px > NASKH_METRICS.bodyPx * p.scale + 1);
    assert.deepEqual(headings.map(lineText), ["الدفن", "عزاء الرجال", "عزاء النساء"]);
    assert.ok(!lineItems(p).some((item) => lineText(item).startsWith("والنساء")), "no inline «والنساء»");
  }],
  ["the letterhead layout moves the opening and the band to the top and starts the text below the double rule", () => {
    const p = plan(makeRequest(), { layout: "letterhead" });
    assert.ok(!p.items.some((item) => item.kind === "opening"));
    const band = p.items.find((item): item is Extract<typeof item, { kind: "band" }> => item.kind === "band")!;
    assert.deepEqual([band.position, band.y, band.h], ["top", 36, 96]);
    assert.ok(lineItems(p).every((item) => item.y >= NASKH_METRICS.letterheadTop && item.y + item.h <= 1350 - NASKH_METRICS.letterheadBottom));
    const rules = p.items.filter((item): item is Extract<typeof item, { kind: "separator" }> => item.kind === "separator" && item.y < NASKH_METRICS.letterheadTop);
    assert.deepEqual(rules.map((item) => item.y), [148, 152]);
    assert.ok(lineItems(p).find((item) => item.section === "head")!.align === "center");
    assert.ok(lineItems(p).find((item) => item.section === "men")!.align === "right");
  }],
  ["the hybrid layout centres only the head and the closing", () => {
    const p = plan(makeRequest(), { layout: "hybrid" });
    const byAlign = (section: string) => lineItems(p).filter((item) => item.section === section).map((item) => item.align);
    assert.ok(byAlign("head").every((align) => align === "center") && byAlign("closing").every((align) => align === "center"));
    assert.ok(byAlign("relatives").every((align) => align === "right") && byAlign("women").every((align) => align === "right"));
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
