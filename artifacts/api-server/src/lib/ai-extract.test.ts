/**
 * اختبارات «طلب من نص»: تصحيح ناتج الذكاء الاصطناعي إلى طلب يقبله الخادم، وترجمة أخطاء الخدمة،
 * ومسار المسؤول عبر خادم HTTP حقيقي. لا اتصال فعلي بـ Gemini: الردود مصطنعة.
 */
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { ADMIN_COOKIE, createSessionToken } from "./admin-auth";
import { AiError, DEFAULT_MODEL, FALLBACK_MODEL, HOLLOW_WARNING, aiConfig, aiEnvHints, buildGeminiBody, burialFromSource, canonicalCemetery, condolenceFromSource, extractRequest, inSource, isHollow, readJson, splitBurialNote, stripCommentary, toRequest } from "./ai-extract";
import aiRouter from "../routes/ai";

/** رد نموذجي كما يُرجعه Gemini لإعلان وهمي (بقيم فارغة وnull كما يحدث فعلاً). */
const AI_OUTPUT = {
  messageType: "announcement",
  announcementMode: "siblings",
  deceasedPeople: [{ fullName: "سالم راشد المهندي", title: "الوالد", gender: "man", age: null, nationality: "", spouse: null }],
  relatives: [
    { relation: "الأبناء", relationKey: "children", people: [{ name: "ناصر", deceased: false }, { name: "خالد", deceased: true }, { name: "", deceased: false }] },
    { relation: "", relationKey: "made_up", people: [] },
  ],
  prayer: { enabled: false, place: "" },
  burial: { status: "upcoming", outsideQatar: false, day: "اليوم", weekday: "الأحد", time: "بعد صلاة العصر", cemetery: "مقبرة مسيمير" },
  condolences: [
    { audience: "men", location: "مجلس العائلة في الوكرة", start: "الاثنين", durationDays: 3, schedule: [{ days: "الفترة المسائية", time: "" }] },
    { audience: "women", location: "منزل الفقيد", area: "الوكرة", houseNumber: "23", mapLink: "https://maps.google.com/?q=25.17,51.60" },
    { audience: "children", location: "?" },
  ],
  condolenceOptions: [],
  notes: "",
  warnings: ["لم يُذكر عمر المتوفى."],
};

/** رسالة واتساب كما وصلت للمسؤول (أُرسلت صورتها مع بلاغ «لا يتعرف على الدفن»). */
const WHATSAPP_TEXT = `توفي/ عبدالله حمد هادي دخيل الودعاني الدوسري
٣٥ عام

اخ كل من
هادي /وزارة الدفاع
ومحمد /لخويا
وفهد / لخويا

الدفن اليوم الاحد بعد صلاة العصر في مقبرة مسيمير

عزاء الرجال في معيذر الجنوبي بجانب مدرسة خالد بن الوليد الاعدادية
https://maps.google.com/?q=25.248951,51.394585

عزاء النساء في منزل والده في معيذر الجنوبي
https://maps.google.com/?q=25.249846,51.391582`;

const reply = (body: unknown, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const geminiReply = (json: unknown) => reply({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] });

const cases: Array<[string, () => void | Promise<void>]> = [
  ["toRequest: يقبله عقد الخادم، ويحذف الفارغ والمجهول، ويشتق خيارات العزاء", () => {
    const { request, warnings } = toRequest(AI_OUTPUT);
    assert.equal(request.deceasedPeople.length, 1);
    assert.equal(request.deceasedPeople[0].age, undefined);
    assert.equal(request.deceasedPeople[0].spouse, undefined);
    assert.equal(request.announcementMode, undefined, "صيغة تعدد المتوفين تُهمل لمتوفى واحد");
    assert.deepEqual(request.relatives.map((group) => group.people.map((person) => person.name)), [["ناصر", "خالد"]]);
    assert.equal(request.relatives[0].people[1].deceased, true);
    assert.deepEqual(request.condolences.map((card) => card.audience), ["men", "women"]);
    assert.deepEqual(request.condolences[0].schedule, [{ days: "الفترة المسائية" }]);
    assert.deepEqual(request.condolenceOptions, ["men", "women"]);
    assert.equal(request.notes, undefined);
    assert.deepEqual(warnings, ["لم يُذكر عمر المتوفى."]);
  }],
  ["toRequest: جنس غير محدد يُستدل من اللقب مع ملاحظة، وأرملة بلا اسم مقبولة", () => {
    const { request, warnings } = toRequest({
      deceasedPeople: [{ title: "الوالدة", spouse: { kind: "widow", title: "الوالد", name: "علي حسن", deceased: true } }],
      relatives: [], prayer: { enabled: false }, burial: { status: "completed", outsideQatar: false, note: "تم الدفن" }, condolences: [], warnings: [],
    });
    assert.equal(request.deceasedPeople[0].gender, "woman");
    assert.equal(request.deceasedPeople[0].spouse?.kind, "widow");
    assert.equal(request.burial.status, "completed");
    assert.ok(warnings.some((warning) => warning.includes("جنس")));
  }],
  ["toRequest: نص بلا متوفى يُرفض برسالة واضحة (422)", () => {
    assert.throws(() => toRequest({ deceasedPeople: [{ fullName: "" }], warnings: [] }), (error: unknown) => error instanceof AiError && error.status === 422);
    assert.throws(() => toRequest("not an object"), (error: unknown) => error instanceof AiError);
  }],
  ["toRequest: أرقام التعزية تعني «phone» لكنها لا تُنقل، و«tbd» يُحذف بملاحظة، والقيم غير المعروفة تعود للافتراضي", () => {
    const { request, warnings } = toRequest({
      messageType: "weird",
      deceasedPeople: [{ fullName: "حمد", gender: "man" }],
      relatives: [], prayer: {}, burial: { status: "soon" }, condolences: [],
      condolencePhoneContacts: [{ name: "فهد", phone: "55123456" }],
      warnings: [],
    });
    assert.equal(request.messageType, "announcement");
    assert.equal(request.burial.status, "upcoming");
    assert.equal(request.burial.outsideQatar, false);
    assert.equal(request.prayer.enabled, false);
    // لا يوجد حقل أرقام في الطلب أصلاً: ما يرجعه النموذج منها يُهمل
    assert.ok(!("condolencePhoneContacts" in request));
    assert.ok(!JSON.stringify(request).includes("55123456"));
    assert.ok(!warnings.some((warning) => warning.includes("أرقام الهواتف")));
    const later = toRequest({ deceasedPeople: [{ fullName: "حمد", gender: "man" }], relatives: [], prayer: {}, burial: {}, condolences: [], condolenceOptions: ["tbd"], warnings: [] });
    assert.deepEqual(later.request.condolenceOptions, []);
    assert.ok(later.warnings.some((warning) => warning.includes("سيُحدَّد لاحقاً")));
  }],
  ["splitBurialNote: موعد الدفن والمقبرة المكدّسة في note أو time تعود إلى حقولها", () => {
    assert.deepEqual(
      splitBurialNote({ status: "upcoming", outsideQatar: false, note: "الساعة 9:30 مساءً في مقبرة مسيمير اليوم الاثنين" }),
      { status: "upcoming", outsideQatar: false, day: "اليوم", weekday: "الاثنين", time: "الساعة 9:30 مساءً", cemetery: "مقبرة مسيمير", note: undefined },
    );
    assert.deepEqual(
      splitBurialNote({ status: "upcoming", outsideQatar: false, time: "بعد صلاة العصر في مقبرة أبو هامور غداً" }),
      { status: "upcoming", outsideQatar: false, day: "غداً", weekday: undefined, time: "بعد صلاة العصر", cemetery: "مقبرة مسيمير", note: undefined },
    );
    // ما بقي بعد الفكّ يظل ملاحظة، والحقول الموجودة لا تُمحى
    const split = splitBurialNote({ status: "upcoming", outsideQatar: false, day: "اليوم", note: "بعد صلاة المغرب في مقبرة الوكرة ويُرجى الحضور مبكراً" });
    assert.equal(split.cemetery, "مقبرة الوكرة");
    assert.equal(split.time, "بعد صلاة المغرب");
    assert.equal(split.day, "اليوم");
    assert.equal(split.note, "ويُرجى الحضور مبكراً");
    // ما ليس فيه موعد ولا مقبرة يبقى كما هو، والتأجيل لا يُمسّ
    const done = { status: "completed", outsideQatar: false, note: "تم الدفن في مكة المكرمة" };
    assert.deepEqual(splitBurialNote(done), done);
    const postponed = { status: "postponed", outsideQatar: false, note: "لحين وصول الجثمان غداً" };
    assert.deepEqual(splitBurialNote(postponed), postponed);
    const intact = { status: "upcoming", outsideQatar: false, day: "اليوم", time: "بعد صلاة العصر", cemetery: "مقبرة مسيمير" };
    assert.deepEqual(splitBurialNote(intact), intact);
    // عبر toRequest كاملاً
    const { request } = toRequest({ ...AI_OUTPUT, burial: { status: "upcoming", outsideQatar: false, note: "الساعة 9:30 مساءً في مقبرة مسيمير اليوم الاثنين" } });
    assert.equal(request.burial.cemetery, "مقبرة مسيمير");
    assert.equal(request.burial.weekday, "الاثنين");
    assert.equal(request.burial.note, undefined);
  }],
  ["condolenceFromSource: مقر الرجال والنساء من نص الرسالة بصيغ مختلفة", () => {
    const whatsapp = "توفيت فلانة والدفن اليوم بعد صلاة العصر في مقبرة مسيمير والعزاء للرجال في مجلس البوحدود بالهلال https://maps.app.goo.gl/abc والنساء في منزل الفقيدة بمنطقة الهلال منزل رقم 9";
    assert.deepEqual(condolenceFromSource(whatsapp, "men"), { location: "مجلس البوحدود بالهلال", mapLink: "https://maps.app.goo.gl/abc" });
    assert.deepEqual(condolenceFromSource(whatsapp, "women"), { location: "منزل الفقيدة بمنطقة الهلال منزل رقم 9" });
    assert.deepEqual(condolenceFromSource("عزاء الرجال: مجلس سعود كليفيخ\nعزاء النساء: منزل أم محمد بمنطقة الفروش\nالدفن اليوم", "women"), { location: "منزل أم محمد بمنطقة الفروش" });
    assert.deepEqual(condolenceFromSource("وللحريم في بيت الفقيد بالوكرة", "women"), { location: "بيت الفقيد بالوكرة" });
    assert.equal(condolenceFromSource("توفي فلان والدفن اليوم", "women"), undefined);
  }],
  ["toRequest: بطاقة أسقطها النموذج تُؤخذ من النص، ولا تُضاف إن كانت موجودة، والمقر بلا وصف يبقى كما ورد", () => {
    const source = "توفيت أم محمد والدفن اليوم بعد صلاة العصر في مقبرة مسيمير والعزاء للرجال في مجلس البوحدود بالهلال والنساء في الهلال منزل رقم 9";
    const dropped = toRequest({ deceasedPeople: [{ fullName: "أم محمد", gender: "woman" }], burial: { status: "upcoming" }, condolences: [{ audience: "men", location: "مجلس البوحدود", area: "الهلال" }], condolenceOptions: ["men"] }, source);
    const women = dropped.request.condolences.find((card) => card.audience === "women");
    assert.ok(women, "women card added from source");
    assert.equal(women?.location, "الهلال منزل رقم 9");
    assert.ok(dropped.request.condolenceOptions.includes("women"));
    assert.ok(dropped.warnings.some((w) => w.includes("أُخذ عزاء النساء من نص الرسالة")));
    // بطاقة موجودة لا تتكرر
    const present = toRequest({ deceasedPeople: [{ fullName: "أم محمد", gender: "woman" }], burial: { status: "upcoming" }, condolences: [{ audience: "men", location: "مجلس" }, { audience: "women", location: "منزل الفقيدة", area: "الهلال" }] }, source);
    assert.equal(present.request.condolences.filter((card) => card.audience === "women").length, 1);
    // مقر بلا وصف يبقى كما ورد: لا يُضاف نص من عندنا
    const bare = toRequest({ deceasedPeople: [{ fullName: "أم محمد", gender: "woman" }], burial: { status: "upcoming" }, condolences: [{ audience: "women", area: "الهلال", houseNumber: "9" }] }, source);
    assert.equal(bare.request.condolences[0].location, undefined);
  }],
  ["toRequest: «حرم فلان» في خانة الاسم يُنقل إلى الزوج ولا يُكتب مرتين", () => {
    const both = toRequest({ deceasedPeople: [{ fullName: "حرم حسين هلال حسين البوحدود", gender: "woman", spouse: { kind: "harem", name: "حسين هلال حسين البوحدود" } }], burial: { status: "upcoming" } });
    assert.equal(both.request.deceasedPeople[0].fullName, undefined);
    assert.equal(both.request.deceasedPeople[0].spouse?.name, "حسين هلال حسين البوحدود");
    assert.equal(both.request.deceasedPeople[0].spouse?.kind, "harem");
    const alone = toRequest({ deceasedPeople: [{ fullName: "أرملة سيف سعيد", gender: "woman" }], burial: { status: "upcoming" } });
    assert.equal(alone.request.deceasedPeople[0].fullName, undefined);
    assert.deepEqual({ name: alone.request.deceasedPeople[0].spouse?.name, kind: alone.request.deceasedPeople[0].spouse?.kind, deceased: alone.request.deceasedPeople[0].spouse?.deceased }, { name: "سيف سعيد", kind: "widow", deceased: true });
    // اسم مختلف عن الزوج يبقى
    const other = toRequest({ deceasedPeople: [{ fullName: "حرم مريم علي", gender: "woman", spouse: { kind: "harem", name: "حسين هلال" } }], burial: { status: "upcoming" } });
    assert.equal(other.request.deceasedPeople[0].fullName, "حرم مريم علي");
  }],
  ["burialFromSource: موعد الدفن ومقبرته من جملة الدفن في الرسالة، بالعامية وبلا همزات", () => {
    assert.deepEqual(burialFromSource(WHATSAPP_TEXT), { cemetery: "مقبرة مسيمير", time: "بعد صلاة العصر", weekday: "الأحد", day: "اليوم" });
    assert.deepEqual(burialFromSource("انتقل الى رحمة الله فلان والدفن بكره عقب صلاة الظهر في مقبرة ابو هامور والعزاء للرجال في مجلسهم"), { cemetery: "مقبرة مسيمير", time: "بعد صلاة الظهر", day: "غداً" });
    assert.deepEqual(burialFromSource("توفيت فلانة وسيتم دفنها الساعة 9:30 مساءً في مقبرة الوكرة الجنوبية اليوم الاثنين"), { cemetery: "مقبرة الوكرة الجنوبية", time: "الساعة 9:30 مساءً", weekday: "الاثنين", day: "اليوم" });
    assert.deepEqual(burialFromSource("توفي فلان، يُدفن غدا الخميس بعد صلاة المغرب بمقبرة الخور"), { cemetery: "مقبرة الخور", time: "بعد صلاة المغرب", weekday: "الخميس", day: "غداً" });
    // دفن تمّ، أو تأجيل، أو «الدفن» داخل جملة العزاء: لا شيء
    assert.deepEqual(burialFromSource("توفي فلان وتم الدفن في مقبرة مسيمير والعزاء في المجلس"), {});
    assert.deepEqual(burialFromSource("تأجيل الدفن حتى إشعار آخر"), {});
    assert.deepEqual(burialFromSource("توفي فلان والعزاء بعد الدفن مباشرة في المقبرة"), {});
  }],
  ["toRequest: دفن فارغ من النموذج يُكمَّل من الرسالة دون المساس بما أرجعه، وتسقط تنبيهات نقصه", () => {
    const empty = { ...AI_OUTPUT, burial: { status: "upcoming", outsideQatar: false }, warnings: ["لم يُذكر موعد الدفن.", "لم يُذكر عمر المتوفى."] };
    const { request, warnings } = toRequest(empty, WHATSAPP_TEXT);
    assert.deepEqual(
      [request.burial.day, request.burial.weekday, request.burial.time, request.burial.cemetery],
      ["اليوم", "الأحد", "بعد صلاة العصر", "مقبرة مسيمير"],
    );
    assert.deepEqual(warnings, ["لم يُذكر عمر المتوفى."]);
    // ما أرجعه النموذج يبقى، ويُكمَّل الناقص فقط
    const partial = toRequest({ ...AI_OUTPUT, burial: { status: "upcoming", outsideQatar: false, cemetery: "مقبرة الخور" } }, WHATSAPP_TEXT).request.burial;
    assert.deepEqual([partial.cemetery, partial.time, partial.weekday], ["مقبرة الخور", "بعد صلاة العصر", "الأحد"]);
    // التأجيل والدفن خارج قطر لا يُكمَّلان
    const postponed = toRequest({ ...AI_OUTPUT, burial: { status: "postponed", outsideQatar: false } }, WHATSAPP_TEXT).request.burial;
    assert.equal(postponed.cemetery, undefined);
    const abroad = toRequest({ ...AI_OUTPUT, burial: { status: "upcoming", outsideQatar: true, outsideLocation: "الرياض" } }, WHATSAPP_TEXT).request.burial;
    assert.equal(abroad.cemetery, undefined);
  }],
  ["toRequest: ملاحظة لم ترد في الرسالة (نسخها النموذج من مثال) تُحذف بتنبيه، وما ورد فيها يبقى", () => {
    const { request, warnings } = toRequest({ ...AI_OUTPUT, burial: { status: "upcoming", outsideQatar: false, note: "تم الدفن في مكة المكرمة" }, notes: "العزاء ثلاثة أيام فقط" }, `${WHATSAPP_TEXT}\nالعزاء ثلاثة ايام فقط`);
    assert.equal(request.burial.note, undefined);
    assert.equal(request.burial.cemetery, "مقبرة مسيمير");
    assert.ok(warnings.includes("حُذف من الإعلان نص لم يرد في الرسالة: «تم الدفن في مكة المكرمة»"), JSON.stringify(warnings));
    assert.equal(request.notes, "العزاء ثلاثة أيام فقط");
    // بلا نص مصدر (استدعاء قديم) لا يُحذف شيء
    assert.equal(toRequest({ ...AI_OUTPUT, notes: "العزاء ثلاثة أيام فقط" }).request.notes, "العزاء ثلاثة أيام فقط");
  }],
  ["toRequest: «تم الدفن» في ملاحظة دفن قادم تُحذف بصمت، وملاحظة أخرى للدفن القادم تُحذف بتنبيه، والدفن المكتمل يحتفظ بوصفه", () => {
    const upcoming = (note: string) => toRequest({ ...AI_OUTPUT, burial: { status: "upcoming", outsideQatar: false, cemetery: "مقبرة مسيمير", note } }, `${WHATSAPP_TEXT}\nسينقل الجثمان من المستشفى بعد صلاة الظهر`);
    const bare = upcoming("تم الدفن");
    assert.equal(bare.request.burial.note, undefined);
    assert.equal(bare.request.burial.status, "upcoming");
    assert.ok(!bare.warnings.some((warning) => warning.includes("تم الدفن")), JSON.stringify(bare.warnings));
    const other = upcoming("سيُنقل الجثمان من المستشفى بعد صلاة الظهر");
    assert.equal(other.request.burial.note, undefined);
    assert.ok(other.warnings.some((warning) => warning.startsWith("حُذفت من الإعلان ملاحظة الدفن «سيُنقل الجثمان")), JSON.stringify(other.warnings));
    // دفن تمّ: «تم الدفن» وحدها تُحذف (الحالة تكفي)، ووصف وارد في الرسالة يبقى
    const done = (note: string, source: string) => toRequest({ ...AI_OUTPUT, burial: { status: "completed", outsideQatar: false, note } }, source).request.burial;
    assert.equal(done("وتمت الصلاة والدفن.", "توفي سالم راشد المهندي وتمت الصلاة والدفن.").note, undefined);
    // المقبرة تذهب إلى حقلها، ويبقى من الملاحظة «تم الدفن» فقط فتُحذف (الإعلان يكتب «تم الدفن في مقبرة الريان» من الحالة والمقبرة)
    const described = done("تم الدفن في مقبرة الريان", "توفي سالم راشد المهندي وتم الدفن في مقبرة الريان");
    assert.deepEqual([described.cemetery, described.note], ["مقبرة الريان", undefined]);
    assert.equal(done("تم الدفن في مكة المكرمة", "توفي سالم راشد المهندي وتم الدفن في مكة المكرمة").note, "تم الدفن في مكة المكرمة");
    // سبب التأجيل يبقى
    const postponed = toRequest({ ...AI_OUTPUT, burial: { status: "postponed", outsideQatar: false, note: "لحين وصول الجثمان" } }, "توفي سالم راشد المهندي، وتأجيل الدفن لحين وصول الجثمان").request.burial;
    assert.equal(postponed.note, "لحين وصول الجثمان");
  }],
  ["«مقبرة أبو هامور» هي مقبرة مسيمير (بأي كتابة)، ومنطقة أبو هامور لمقر العزاء تبقى", () => {
    for (const name of ["مقبرة أبو هامور", "مقبرة ابو هامور", "مقبرة بوهامور", "مقابر أبو هامور", "أبو هامور", "ابوهامور"]) assert.equal(canonicalCemetery(name), "مقبرة مسيمير", name);
    assert.equal(canonicalCemetery("مقبرة الخور"), "مقبرة الخور");
    assert.deepEqual(burialFromSource("والدفن اليوم بعد صلاة العصر في مقبرة بو هامور"), { cemetery: "مقبرة مسيمير", time: "بعد صلاة العصر", day: "اليوم" });
    const { request } = toRequest({
      ...AI_OUTPUT,
      burial: { status: "upcoming", outsideQatar: false, day: "اليوم", time: "بعد صلاة العصر", cemetery: "مقبرة أبو هامور" },
      condolences: [{ audience: "men", location: "مجلس المري", area: "أبو هامور" }],
    });
    assert.equal(request.burial.cemetery, "مقبرة مسيمير");
    assert.equal(request.condolences[0].area, "أبو هامور");
  }],
  ["inSource: يقارن الكلمات بعد توحيد الهمزات والتاء المربوطة ونزع «ال» و«و» و«ب»", () => {
    assert.equal(inSource("تأجيل الدفن لحين وصول الجثمان", "تاجيل الدفن لحين وصول الجثمان من الخارج"), true);
    assert.equal(inSource("وبالعزاء في المجلس", "العزاء بمجلس العائلة في المجلس"), true);
    assert.equal(inSource("تم الدفن في مكة المكرمة", WHATSAPP_TEXT), false);
    assert.equal(inSource("أي شيء", ""), true);
  }],
  ["stripCommentary: تعليقات النموذج تُحذف من حقول النشر وتُنقل إلى الملاحظات", () => {
    const warnings: string[] = [];
    const note = "لم تذكر صلاة جنازة منفصلة عن المقبرة في الإعلان. يرجى مراجعة إدارة المقبرة للتأكيد. تم تحديد الدفن بعد صلاة العشاء. قد يُدفن المتوفى في مقبرة مسيمير إذا تم توفير مكان له هناك. نُقلت الأسماء كما وردت في الإعلان. الله يرحمه ويغفر له. وفيات قطر.";
    assert.equal(stripCommentary(note, warnings), "تم تحديد الدفن بعد صلاة العشاء. الله يرحمه ويغفر له.");
    assert.equal(warnings.length, 5);
    assert.ok(warnings.every((warning) => warning.startsWith("حُذف من الإعلان تعليق")));
    assert.equal(stripCommentary("لحين وصول الجثمان من لندن", []), "لحين وصول الجثمان من لندن");
    assert.equal(stripCommentary("", []), undefined);
    // عبر toRequest: الملاحظة تُنظَّف ثم تُفكّ، والتعليقات تظهر في warnings لا في الطلب
    const { request, warnings: all } = toRequest({ ...AI_OUTPUT, burial: { status: "upcoming", outsideQatar: false, note }, notes: "تأكد من صحة المعلومات قبل نشرها." });
    assert.equal(request.burial.time, "بعد صلاة العشاء");
    assert.ok(!JSON.stringify(request).includes("يرجى"), JSON.stringify(request.burial));
    assert.ok(!JSON.stringify(request).includes("وفيات قطر"));
    assert.equal(request.notes, undefined);
    assert.ok(all.some((warning) => warning.includes("يرجى مراجعة إدارة المقبرة")));
  }],
  ["readJson: يقبل الرد المحاط بعلامات ```json ويرفض غير المفهوم", () => {
    assert.deepEqual(readJson('```json\n{"a":1}\n```'), { a: 1 });
    assert.throws(() => readJson("ليس JSON"), (error: unknown) => error instanceof AiError && error.status === 502);
  }],
  ["buildGeminiBody: النص داخل الطلب، مخطط مرتّب في الوضع الصارم، وبدونه في الوضع الحر، ومثال في التعليمات", () => {
    const body = buildGeminiBody("توفي فلان");
    assert.match(body.contents[0].parts[0].text, /توفي فلان/u);
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    const schema = body.generationConfig.responseSchema as { type: string; propertyOrdering: string[] };
    assert.equal(schema.type, "OBJECT");
    assert.equal(schema.propertyOrdering[0], "messageType");
    assert.equal(buildGeminiBody("x", { strict: false }).generationConfig.responseSchema, undefined);
    const prompt = body.systemInstruction.parts[0].text;
    assert.match(prompt, /"deceasedPeople"/u);
    assert.match(prompt, /مريم عبدالله الكواري/u);
  }],
  ["isHollow: اسم ناقص، أو إعلان طويل بلا دفن ولا عزاء ولا أقارب", () => {
    const full = toRequest(AI_OUTPUT);
    assert.equal(isHollow(full, 500), false);
    const bare = toRequest({ deceasedPeople: [{ fullName: "حمد", gender: "man" }], relatives: [], prayer: { enabled: false }, burial: { status: "upcoming", outsideQatar: false }, condolences: [], warnings: [] });
    assert.equal(isHollow(bare, 30), false, "نص قصير قد لا يحوي أكثر من الاسم");
    assert.equal(isHollow(bare, 500), true, "نص طويل عاد منه الاسم فقط");
    const postponed = toRequest({ messageType: "postponement", deceasedPeople: [{ fullName: "حمد", gender: "man" }], relatives: [], prayer: { enabled: false }, burial: { status: "postponed", outsideQatar: false }, condolences: [], warnings: [] });
    assert.equal(isHollow(postponed, 500), false, "رسائل التأجيل والإلغاء لا دفن فيها");
    const nameless = { ...full, request: { ...full.request, deceasedPeople: [{ gender: "man" as const, spouse: { kind: "harem" as const, name: "" } }] } };
    assert.equal(isHollow(nameless, 50), true);
  }],
  ["extractRequest: ناتج أجوف بالمخطط → محاولة بلا مخطط تنجح", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const hollow = { deceasedPeople: [{ gender: "man", title: "الوالد" }], relatives: [], prayer: { enabled: false }, burial: { status: "upcoming", outsideQatar: false }, condolences: [], warnings: [] };
    const result = await extractRequest("نص طويل ".repeat(20), {
      apiKey: "k",
      model: FALLBACK_MODEL,
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(String(init.body)) as { generationConfig: Record<string, unknown> };
        bodies.push(body.generationConfig);
        return geminiReply(bodies.length === 1 ? hollow : AI_OUTPUT);
      },
    });
    assert.equal(bodies.length, 2);
    assert.ok(bodies[0].responseSchema, "الأولى بالمخطط");
    assert.equal(bodies[1].responseSchema, undefined, "الثانية بدونه");
    assert.equal(result.request.deceasedPeople[0].fullName, "سالم راشد المهندي");
    assert.equal(result.debug, undefined);
  }],
  ["extractRequest: النموذج يُرجع الدفن فارغاً → يُكمَّل من نص الرسالة", async () => {
    const fetchImpl = async () => geminiReply({ ...AI_OUTPUT, burial: { status: "upcoming", outsideQatar: false } });
    const { request } = await extractRequest(WHATSAPP_TEXT, { apiKey: "k", model: DEFAULT_MODEL, fetchImpl });
    assert.deepEqual([request.burial.day, request.burial.weekday, request.burial.time, request.burial.cemetery], ["اليوم", "الأحد", "بعد صلاة العصر", "مقبرة مسيمير"]);
  }],
  ["extractRequest: أجوف في المحاولتين → يعود مع تحذير وردّ النموذج مختصراً", async () => {
    const hollow = { deceasedPeople: [{ gender: "man", title: "الوالد" }], relatives: [], prayer: { enabled: false }, burial: { status: "upcoming", outsideQatar: false }, condolences: [], warnings: ["x"] };
    let calls = 0;
    const result = await extractRequest("نص طويل ".repeat(20), { apiKey: "k", model: FALLBACK_MODEL, fetchImpl: async () => { calls += 1; return geminiReply(hollow); } });
    assert.equal(calls, 2);
    assert.equal(result.warnings[0], HOLLOW_WARNING);
    assert.ok(result.debug?.includes('"title":"الوالد"'), result.debug);
    assert.equal(result.request.deceasedPeople[0].title, "الوالد");
  }],
  ["extractRequest: JSON غير مفهوم بالمخطط → بلا مخطط؛ وإن فشلت كلها فالخطأ يحمل ردّ النموذج", async () => {
    let calls = 0;
    const ok = await extractRequest("نص", { apiKey: "k", model: FALLBACK_MODEL, fetchImpl: async () => { calls += 1; return calls === 1 ? geminiReply("ليس JSON") : geminiReply(AI_OUTPUT); } });
    assert.equal(calls, 2);
    assert.equal(ok.request.deceasedPeople.length, 1);
    await assert.rejects(
      extractRequest("نص", { apiKey: "k", model: FALLBACK_MODEL, fetchImpl: async () => reply({ candidates: [{ content: { parts: [{ text: "<<غير مفهوم>>" }] } }] }) }),
      (error: unknown) => error instanceof AiError && error.status === 502 && error.debug === "<<غير مفهوم>>",
    );
  }],
  ["extractRequest: 400 على المخطط (نموذج لا يدعمه) → إعادة بلا مخطط؛ ومحاولات النموذج الاحتياطي تُحسب", async () => {
    const urls: string[] = [];
    const result = await extractRequest("نص", {
      apiKey: "k",
      model: DEFAULT_MODEL,
      fetchImpl: async (url, init) => {
        urls.push(url);
        const strict = Boolean((JSON.parse(String(init.body)) as { generationConfig: { responseSchema?: unknown } }).generationConfig.responseSchema);
        return strict ? reply({ error: { message: "Invalid JSON schema" } }, 400) : geminiReply(AI_OUTPUT);
      },
    });
    assert.equal(urls.length, 2, "محاولتان على النموذج الأول تكفيان");
    assert.ok(urls.every((url) => url.includes(DEFAULT_MODEL)));
    assert.equal(result.request.condolences.length, 2);
  }],
  ["aiConfig: GEMINI_API_KEY أولاً، والنموذج الافتراضي قابل للتغيير", () => {
    assert.deepEqual(aiConfig({}), { apiKey: "", model: DEFAULT_MODEL });
    assert.deepEqual(aiConfig({ GEMINI_API_KEY: " k1 ", API_KEY: "k2", GEMINI_MODEL: "gemini-x" }), { apiKey: "k1", model: "gemini-x" });
    assert.equal(aiConfig({ API_KEY: "k2" }).apiKey, "k2");
    assert.equal(aiConfig({ GOOGLE_API_KEY: "g1", API_KEY: "k2" }).apiKey, "g1");
    assert.equal(aiConfig({ GEMINI_API_KEY: "   " }).apiKey, "");
  }],
  ["aiEnvHints: أسماء المتغيرات فقط، بلا قيم ولا متغيرات غير متعلقة", () => {
    const hints = aiEnvHints({ APPLET_ID: "secret-applet", ADMIN_PASSWORD: "x", PATH: "/bin", GOOGLE_CLOUD_PROJECT: "p", HTTPS_PROXY: "h" });
    assert.deepEqual(hints, ["APPLET_ID", "GOOGLE_CLOUD_PROJECT", "HTTPS_PROXY"]);
    assert.ok(!hints.join(" ").includes("secret-applet"));
  }],
  ["extractRequest بلا مفتاح (وسيط AI Studio): لا ترويسة مفتاح، وعنوان الوسيط المعطى", async () => {
    let seen: { url: string; headers: Record<string, string> } | undefined;
    await extractRequest("نص", {
      apiKey: "",
      model: FALLBACK_MODEL,
      endpoint: "https://example.run.app/api-proxy/v1beta/models",
      fetchImpl: async (url, init) => {
        seen = { url, headers: init.headers as Record<string, string> };
        return geminiReply(AI_OUTPUT);
      },
    });
    assert.equal(seen?.url, `https://example.run.app/api-proxy/v1beta/models/${FALLBACK_MODEL}:generateContent`);
    assert.equal(seen?.headers["x-goog-api-key"], undefined);
  }],
  ["extractRequest: يرسل المفتاح في الترويسة، ويجرّب النموذج الثابت إن كان الأول غير متاح", async () => {
    const calls: string[] = [];
    const result = await extractRequest("نص", {
      apiKey: "secret",
      model: DEFAULT_MODEL,
      fetchImpl: async (url, init) => {
        calls.push(url);
        assert.equal((init.headers as Record<string, string>)["x-goog-api-key"], "secret");
        assert.ok(!url.includes("secret"), "المفتاح لا يوضع في الرابط");
        return calls.length === 1 ? reply({ error: { message: "not found" } }, 404) : geminiReply(AI_OUTPUT);
      },
    });
    assert.equal(calls.length, 2);
    assert.match(calls[0], new RegExp(`${DEFAULT_MODEL}:generateContent$`));
    assert.match(calls[1], new RegExp(`${FALLBACK_MODEL}:generateContent$`));
    assert.equal(result.request.deceasedPeople[0].fullName, "سالم راشد المهندي");
  }],
  ["extractRequest: أخطاء الخدمة برسائل عربية وحالات مناسبة", async () => {
    const run = (response: Response) => extractRequest("نص", { apiKey: "k", model: FALLBACK_MODEL, fetchImpl: async () => response });
    await assert.rejects(run(reply({}, 429)), (error: unknown) => error instanceof AiError && error.status === 429);
    await assert.rejects(run(reply({ error: { message: "API key not valid", status: "INVALID_ARGUMENT" } }, 400)), (error: unknown) => error instanceof AiError && error.status === 503);
    await assert.rejects(run(reply({}, 500)), (error: unknown) => error instanceof AiError && error.status === 502);
    await assert.rejects(run(reply({ candidates: [] })), (error: unknown) => error instanceof AiError && error.status === 502);
    await assert.rejects(
      extractRequest("نص", { apiKey: "k", model: FALLBACK_MODEL, fetchImpl: async () => { throw new TypeError("network down"); } }),
      (error: unknown) => error instanceof AiError && error.status === 502,
    );
  }],
];

/** المسار نفسه عبر HTTP: محمي، يرفض النص الفارغ، ويُبلغ إن لم يُضبط المفتاح. */
async function httpCase() {
  const names = ["ADMIN_PASSWORD", "GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_API_KEY", "API_KEY", "GEMINI_KEY", "APPLET_ID"];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  process.env.ADMIN_PASSWORD = "correct-horse-battery";
  const app = express();
  app.use(express.json());
  app.use("/api", aiRouter);
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/parse-text`;
    const cookie = `${ADMIN_COOKIE}=${createSessionToken()}`;
    const post = (body: unknown, headers: Record<string, string> = {}) =>
      fetch(base, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    assert.equal((await post({ text: "توفي فلان" })).status, 401);
    assert.equal((await post({ text: "   " }, { cookie })).status, 400);
    const missingKey = await post({ text: "توفي فلان" }, { cookie });
    assert.equal(missingKey.status, 503);
    assert.equal(((await missingKey.json()) as { code: string }).code, "ai_not_configured");
    // خدمة من AI Studio بلا مفتاح ظاهر: يجرّب وسيطها (غير موجود هنا) ثم يذكر ما يراه التطبيق.
    process.env.APPLET_ID = "test-applet";
    const viaStudio = await post({ text: "توفي فلان" }, { cookie });
    assert.equal(viaStudio.status, 503);
    const body = (await viaStudio.json()) as { error: string; code: string };
    assert.equal(body.code, "ai_not_configured");
    assert.match(body.error, /APPLET_ID/u);
    assert.ok(!body.error.includes("test-applet"), "لا تظهر قيم المتغيرات");
  } finally {
    server.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

let failed = 0;
for (const [name, test] of [...cases, ["المسار عبر HTTP: 401 بلا جلسة، 400 لنص فارغ، 503 بلا مفتاح", httpCase] as [string, () => Promise<void>]]) {
  try {
    await test();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}\n${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  }
}
if (failed) {
  console.error(`${failed} of ${cases.length + 1} AI extraction cases failed.`);
  process.exit(1);
}
console.log(`Passed ${cases.length + 1} AI extraction cases.`);
