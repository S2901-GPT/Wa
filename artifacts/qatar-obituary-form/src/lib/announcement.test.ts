/**
 * اختبارات قبول مأخوذة من أرشيف «وفيات قطر» (٤٢٤٨ إعلاناً). كل حالة تتحقق من النص الناتج فعلياً.
 * التشغيل: npm run test --workspace=@workspace/qatar-obituary-form
 */
import assert from "node:assert/strict";
import type { ObituaryRequestInput } from "@workspace/api-client-react";
import { buildAnnouncement, countNoun, describeDeceased, formatAge } from "./announcement";

function request(overrides: Partial<ObituaryRequestInput>): ObituaryRequestInput {
  return {
    deceasedPeople: [{ fullName: "محمد علي", gender: "man" }],
    relatives: [],
    prayer: { enabled: false },
    burial: { status: "upcoming", outsideQatar: false, day: "اليوم", time: "بعد صلاة العصر", cemetery: "مقبرة مسيمير" },
    condolenceOptions: [],
    condolences: [],
    condolencePhoneContacts: [],
    ...overrides,
  };
}

const text = (overrides: Partial<ObituaryRequestInput>) => buildAnnouncement(request(overrides)).text;

function includesInOrder(haystack: string, needles: string[]) {
  let from = 0;
  for (const needle of needles) {
    const at = haystack.indexOf(needle, from);
    assert.ok(at >= 0, `expected to find «${needle}» after position ${from} in:\n${haystack}`);
    from = at + needle.length;
  }
}

const cases: Array<[string, () => void]> = [
  ["1 أرملة بلا اسم وزوجها متوفى وابنان", () => {
    const result = buildAnnouncement(request({
      deceasedPeople: [{
        gender: "woman",
        identifyBy: "spouse",
        spouse: { kind: "widow", title: "الوالد", name: "سيف سعيد", deceased: true },
      }],
      relatives: [{ relation: "", relationKey: "children", people: [{ name: "غانم", deceased: false }, { name: "ناصر", deceased: false }] }],
    }));
    assert.ok(result.text.startsWith("توفيت أرملة الوالد / سيف سعيد رحمهم الله\nوالدة كل من\nغانم وناصر"), result.text);
    assert.ok(result.text.endsWith("الله يرحمها ويغفر لها"));
    // لا يُسجَّل الزوج كأنه المتوفى.
    assert.match(describeDeceased(request({}).deceasedPeople[0]), /محمد علي/u);
    assert.equal(
      describeDeceased({ gender: "woman", identifyBy: "spouse", spouse: { kind: "widow", title: "الوالد", name: "سيف", deceased: true } }),
      "أرملة الوالد سيف رحمهم الله",
    );
  }],
  ["2 أم بلا اسم تُعرَّف بأبنائها ووظائفهم والزوج المتوفى عبر «أبناء الوالد /»", () => {
    const result = text({
      deceasedPeople: [{
        gender: "woman",
        identifyBy: "children",
        spouse: { kind: "widow", title: "الوالد", name: "عبدالله يوسف", deceased: true },
      }],
      relatives: [{
        relation: "",
        relationKey: "children",
        people: [{ name: "أحمد", occupation: "جامعة قطر", deceased: false }, { name: "داوود", occupation: "كهرماء", deceased: false }],
      }],
    });
    assert.ok(result.startsWith("توفيت والدة كل من\nأحمد (جامعة قطر)\nوداوود (كهرماء)\nأبناء الوالد / عبدالله يوسف رحمه الله"), result);
    assert.doesNotMatch(result, /أرملة/u);
  }],
  ["3 الأب يُعرف عبر الإخوة: «شقيقة كل من / أبناء الوالد /»", () => {
    const result = text({
      deceasedPeople: [{
        fullName: "مريم",
        gender: "woman",
        father: { title: "الوالد", name: "جاسم بن درويش فخرو", deceased: true },
      }],
      relatives: [{ relation: "", relationKey: "full_siblings", people: [{ name: "خالد", deceased: false }, { name: "عبدالله", deceased: false }] }],
    });
    includesInOrder(result, ["توفيت / مريم", "شقيقة كل من", "خالد", "وعبدالله", "أبناء الوالد / جاسم بن درويش فخرو رحمه الله"]);
    assert.doesNotMatch(result, /ابنة الوالد/u, "الأب لا يُكرر في سطر مستقل بعد أن صار مرجع الإخوة");
  }],
  ["4 شيخة بنسب «بنت … بن …» وزوج حاكم سابق: الاسم أولاً ثم «حرم»", () => {
    const result = text({
      deceasedPeople: [{
        title: "الشيخة",
        fullName: "مريم بنت عبدالله",
        gender: "woman",
        spouse: { kind: "harem", title: "الشيخ", name: "خليفة بن حمد", deceased: true },
      }],
    });
    assert.ok(result.startsWith("توفيت الشيخة / مريم بنت عبدالله\nحرم الشيخ / خليفة بن حمد رحمه الله"), result);
  }],
  ["5 «حرم» وزوجها متوفى", () => {
    const people = [{
      gender: "woman" as const,
      identifyBy: "spouse" as const,
      spouse: { kind: "harem" as const, title: "الوالد", name: "فضل سعيد", deceased: true },
    }];
    const result = buildAnnouncement(request({ deceasedPeople: people }));
    assert.ok(result.text.startsWith("توفيت حرم الوالد / فضل سعيد رحمه الله\n"), result.text);
    assert.equal(result.posterNames, "حرم الوالد فضل سعيد رحمه الله");
    assert.doesNotMatch(result.text, /،\s*فضل/u, "لا فاصلة تجعل اسم الزوج يُقرأ اسماً لها");
  }],
  ["6 متوفاة تُعرف بكنيتها فقط", () => {
    const result = text({ deceasedPeople: [{ gender: "woman", identifyBy: "kunya", title: "الوالدة", kunya: "أم باسل" }] });
    assert.ok(result.startsWith("توفيت الوالدة / أم باسل\n"), result);
  }],
  ["7 شقيقان بنسب مشترك وعزاء نساء منفصل لكل منهما", () => {
    const result = text({
      announcementMode: "siblings",
      sharedParent: { name: "فهد محمد جاسم", deceased: false },
      deceasedPeople: [
        { fullName: "سعود", gender: "man", age: 22 },
        { fullName: "جاسم", gender: "man", age: 21 },
      ],
      relatives: [
        { relation: "", relationKey: "siblings", deceasedIndex: null, people: [{ name: "ناصر", deceased: false }, { name: "علي", deceased: false }] },
        { relation: "", relationKey: "grandfather", deceasedIndex: null, people: [{ name: "محمد جاسم", deceased: true }] },
        { relation: "", relationKey: "paternal_uncles", deceasedIndex: null, people: [{ name: "خالد", deceased: false }, { name: "حمد", deceased: false }] },
      ],
      condolenceOptions: ["men", "women"],
      condolences: [
        { audience: "men", location: "مجلس العائلة", area: "الدفنة" },
        { audience: "women", location: "منزل رقم ٥", area: "الوكرة", deceasedIndex: 0 },
        { audience: "women", location: "منزل رقم ٩", area: "الخور", deceasedIndex: 1 },
      ],
    });
    includesInOrder(result, [
      "توفي كل من", "سعود — 22 عاماً", "جاسم — 21 عاماً", "أبناء / فهد محمد جاسم",
      "إخوتهم كل من", "ناصر", "وعلي", "جدهم / محمد جاسم رحمه الله", "أعمامهم كل من",
      "عزاء الرجال في مجلس العائلة بمنطقة الدفنة",
      "عزاء النساء لـسعود رحمه الله في منزل رقم ٥ بمنطقة الوكرة",
      "عزاء النساء لـجاسم رحمه الله في منزل رقم ٩ بمنطقة الخور",
      "الله يرحمهما ويغفر لهما",
    ]);
  }],
  ["8 الأب أولاً وأربعة أبناء من الجنسين والدفن في عُمان", () => {
    const result = text({
      announcementMode: "father_first",
      sharedParent: { title: "الوالد", name: "سالم حمد", deceased: false },
      deceasedPeople: [
        { fullName: "سعد", gender: "man" }, { fullName: "غانم", gender: "man" },
        { fullName: "إيمان", gender: "woman" }, { fullName: "فاطمة", gender: "woman" },
      ],
      prayer: { enabled: true, day: "اليوم", time: "بعد صلاة العصر", place: "جامع الإمام محمد بن عبدالوهاب" },
      burial: { status: "upcoming", outsideQatar: true, outsideLocation: "سلطنة عُمان" },
    });
    includesInOrder(result, [
      "توفي أبناء الوالد / سالم حمد\nسعد وغانم وإيمان وفاطمة",
      "صلاة الجنازة اليوم بعد صلاة العصر في جامع الإمام محمد بن عبدالوهاب",
      "والدفن في سلطنة عُمان",
      "الله يرحمهم ويغفر لهم",
    ]);
  }],
  ["9 أم وطفلتها: الختام بالجمع", () => {
    const result = text({
      announcementMode: "mother_child",
      deceasedPeople: [
        { gender: "woman", identifyBy: "spouse", spouse: { kind: "harem", name: "خالد سعيد", deceased: false } },
        { fullName: "آمنة", gender: "girl" },
      ],
    });
    assert.ok(result.startsWith("توفيت حرم / خالد سعيد\nوابنتها الطفلة / آمنة"), result);
    assert.ok(result.endsWith("الله يرحمهم ويغفر لهم"), result);
  }],
  ["10 ستة إخوة أحياء واثنان متوفيان: «رحمه الله» بجانب كل اسم", () => {
    const living = ["راشد", "حمد", "سعد", "فهد", "ناصر", "خليفة"].map((name) => ({ name, deceased: false }));
    const result = text({
      relatives: [{ relation: "", relationKey: "siblings", people: [...living, { name: "عبدالله", deceased: true }, { name: "أمين", deceased: true }] }],
    });
    includesInOrder(result, ["أخ كل من", "راشد", "وخليفة", "وعبدالله رحمه الله", "وأمين رحمه الله"]);
    assert.doesNotMatch(result, /رحمهما/u);
    const grouped = text({
      relatives: [{ relation: "", relationKey: "siblings", deceasedPlacement: "grouped", people: [...living, { name: "عبدالله", deceased: true }, { name: "أمين", deceased: true }] }],
    });
    assert.match(grouped, /وعبدالله وأمين رحمهما الله/u);
  }],
  ["جهة العمل ثم «متقاعد» داخل القوسين نفسيهما: (وزارة الداخلية - متقاعد)", () => {
    const result = text({
      relatives: [{ relation: "", relationKey: "children", people: [
        { name: "أحمد", deceased: false, occupation: "وزارة الداخلية (متقاعد)" },
        { name: "خالد", deceased: false, occupation: "(متقاعد)" },
        { name: "سعد", deceased: false, occupation: "قطر للطاقة" },
      ] }],
    });
    includesInOrder(result, ["أحمد (وزارة الداخلية - متقاعد) وخالد (متقاعد) وسعد (قطر للطاقة)"]);
    assert.doesNotMatch(result, /\) \(متقاعد\)/u);
    assert.doesNotMatch(result, /\(\(|\)\)/u);
  }],
  ["11 قريب اسمه «رحمة الله» حيّ لا يُعامل كمتوفى", () => {
    const result = text({
      relatives: [{ relation: "", relationKey: "children", people: [{ name: "رحمة الله شفيق الرحمن", deceased: false }, { name: "عبدالحميد", deceased: false }] }],
    });
    includesInOrder(result, ["والد كل من", "رحمة الله شفيق الرحمن", "وعبدالحميد"]);
    assert.doesNotMatch(result, /الرحمن رحمه الله|رحمهما/u);
  }],
  ["12 وفاة في ألمانيا ودفن غداً في مسيمير", () => {
    const result = text({
      deceasedPeople: [{ title: "الوالد", fullName: "محمد علي", gender: "man", deathPlace: "ألمانيا" }],
      burial: { status: "upcoming", outsideQatar: false, day: "غداً", weekday: "الأحد", time: "بعد صلاة الظهر", cemetery: "مقبرة مسيمير" },
    });
    includesInOrder(result, ["توفي الوالد / محمد علي في ألمانيا", "الدفن غداً الأحد بعد صلاة الظهر في مقبرة مسيمير"]);
  }],
  ["13 صلاة في مسيمير ودفن في مصر دون يوم أو وقت للدفن", () => {
    const result = buildAnnouncement(request({
      deceasedPeople: [{ title: "الوالد", fullName: "أحمد محمود", gender: "man", nationality: "مصري", age: 70 }],
      prayer: { enabled: true, day: "اليوم", time: "بعد صلاة العصر", place: "مصلى مقبرة مسيمير" },
      burial: { status: "upcoming", outsideQatar: true, outsideLocation: "مصر" },
    }));
    includesInOrder(result.text, ["70 عاماً — مصري", "صلاة الجنازة اليوم بعد صلاة العصر في مصلى مقبرة مسيمير\nوالدفن في مصر"]);
    assert.doesNotMatch(result.text, /يوم\s+خارج|يوم\s*$/mu);
    assert.deepEqual(result.warnings, []);
  }],
  ["14 دفن تم في البحرين والعزاء في قطر من الغد لمدة ٣ أيام", () => {
    const result = text({
      burial: { status: "completed", outsideQatar: true, outsideLocation: "البحرين", day: "اليوم", weekday: "السبت" },
      condolenceOptions: ["men"],
      condolences: [{ audience: "men", start: "غداً", durationDays: 3, location: "مجلس العائلة", area: "الدفنة" }],
    });
    includesInOrder(result, ["تم الدفن اليوم السبت في البحرين", "عزاء الرجال من الغد في مجلس العائلة بمنطقة الدفنة", "لمدة 3 أيام"]);
  }],
  ["15 تأجيل الدفن حتى إشعار آخر ثم رسالة تعديل بموعد جديد", () => {
    const deceased = [{ gender: "woman" as const, identifyBy: "spouse" as const, spouse: { kind: "harem" as const, name: "علي حسن", deceased: false } }];
    const postponed = buildAnnouncement(request({ messageType: "postponement", deceasedPeople: deceased }));
    assert.equal(postponed.text, "تأجيل دفن حرم / علي حسن رحمها الله حتى إشعار آخر");
    const amended = text({
      messageType: "amendment",
      relatedRequestNumber: "QTR-1",
      deceasedPeople: deceased,
      burial: { status: "upcoming", outsideQatar: false, day: "اليوم", weekday: "الخميس", time: "بعد صلاة العشاء", cemetery: "مقبرة مسيمير" },
    });
    includesInOrder(amended, ["تعديل /", "توفيت حرم / علي حسن", "الدفن اليوم الخميس بعد صلاة العشاء في مقبرة مسيمير"]);
  }],
  ["16 عزاء رمضاني بجدول: يوم بعد العشاء ويومان بعد العصر", () => {
    const result = text({
      condolenceOptions: ["men"],
      condolences: [{
        audience: "men",
        location: "مجلس العائلة",
        schedule: [
          { days: "الخميس", time: "من بعد صلاة العشاء" },
          { days: "الجمعة والسبت", time: "من بعد صلاة العصر" },
        ],
      }],
    });
    includesInOrder(result, ["عزاء الرجال في مجلس العائلة", "الخميس من بعد صلاة العشاء", "الجمعة والسبت من بعد صلاة العصر"]);
  }],
  ["17 رضيعة والعزاء عن طريق هاتف والدها", () => {
    const result = text({
      deceasedPeople: [{ title: "الرضيعة", fullName: "ريم خالد", gender: "girl", age: 3, ageUnit: "months" }],
      condolenceOptions: ["phone"],
      phoneAudience: "all",
      condolencePhoneContacts: [{ name: "والدها", phone: "55555555" }],
    });
    includesInOrder(result, ["انتقلت إلى رحمة الله تعالى الرضيعة / ريم خالد", "3 أشهر", "العزاء عن طريق هاتف والدها: 55555555", "شفيعاً لوالديها يارب"]);
    assert.doesNotMatch(result, /غفر لها/u, "لا يُستعمل دعاء البالغين للرضيعة");
  }],
  ["18 موقعان لعزاء النساء ومجلس للرجال", () => {
    const result = text({
      condolenceOptions: ["men", "women"],
      condolences: [
        { audience: "men", location: "مجلس العائلة", area: "الريان", mapLink: "https://maps.example/men" },
        { audience: "women", location: "منزل ابنته", area: "الدحيل", houseNumber: "١٥" },
        { audience: "women", location: "منزل أخته", area: "الوعب" },
      ],
    });
    includesInOrder(result, [
      "عزاء الرجال في مجلس العائلة بمنطقة الريان", "https://maps.example/men",
      "عزاء النساء الأول في منزل ابنته بمنطقة الدحيل، منزل رقم ١٥",
      "عزاء النساء الثاني في منزل أخته بمنطقة الوعب",
    ]);
  }],
  ["19 «توفي الوالد اللواء متقاعد /» مع أبناء بوظائف موحّدة الفاصل", () => {
    const result = text({
      deceasedPeople: [{ title: "الوالد اللواء متقاعد", fullName: "سالم راشد", gender: "man", nationality: "قطري", age: 81 }],
      relatives: [{
        relation: "",
        relationKey: "children",
        people: [
          { name: "أحمد", occupation: "جامعة قطر", deceased: false },
          { name: "داوود", occupation: "كهرماء", deceased: false },
          { name: "مبارك", occupation: "وزارة البلدية", deceased: false },
          { name: "خالد", occupation: "متقاعد", deceased: false },
        ],
      }],
    });
    includesInOrder(result, ["توفي الوالد اللواء متقاعد / سالم راشد", "81 عاماً", "والد كل من", "أحمد (جامعة قطر)", "وداوود (كهرماء)", "ومبارك (وزارة البلدية)", "وخالد (متقاعد)"]);
    assert.doesNotMatch(result, /قطري|العمل:/u);
  }],
  ["20 «طالب مسعود سالم» اسم لا وظيفة", () => {
    const result = text({
      relatives: [{ relation: "", relationKey: "children", people: [{ name: "طالب مسعود سالم", deceased: false }] }],
    });
    assert.match(result, /والد \/ طالب مسعود سالم/u);
  }],

  // ───── قواعد إضافية من التقرير ─────
  ["الصلة القديمة «ابن» تُحوَّل إلى «والد كل من» واللقب القديم «حرم …» يأتي بعد الاسم", () => {
    const result = text({
      deceasedPeople: [{ title: "حرم الشيخ عبدالله", fullName: "عائشة محمد", gender: "woman" }],
      relatives: [{ relation: "ابن", familyReference: "", people: [{ name: "ناصر", deceased: false }, { name: "محمد", deceased: true }] }],
    });
    includesInOrder(result, ["توفيت / عائشة محمد", "حرم الشيخ عبدالله", "والدة كل من", "ناصر", "ومحمد رحمه الله"]);
  }],
  ["ترحّم القريب بالمذكر دائماً حتى مع عنوان حر بصيغة الأرشيف", () => {
    const result = text({
      deceasedPeople: [{ fullName: "نورة", gender: "woman" }],
      relatives: [{ relation: "والدة كل من", relationKey: "other", people: [{ name: "باسل", deceased: false }, { name: "محمد", deceased: true }] }],
    });
    assert.match(result, /ومحمد رحمه الله/u);
    assert.doesNotMatch(result, /رحمها الله تعالى|متوفى/u);
  }],
  ["الجنس غير المحدد يُنتج تنبيهاً ولا يُختلق دعاء", () => {
    const result = buildAnnouncement(request({ deceasedPeople: [{ fullName: "مجهول", gender: "other" }] }));
    assert.ok(result.warnings.some((warning) => warning.includes("جنس")));
    assert.equal(result.closing, "");
  }],
  ["تعذر التعريف يُنتج تنبيهاً", () => {
    const result = buildAnnouncement(request({ deceasedPeople: [{ gender: "woman" }] }));
    assert.ok(result.warnings.some((warning) => warning.includes("تعذر التعريف")));
  }],
  ["«لا يوجد عزاء» يظهر صراحة، والمقبرة فقط مع سببها", () => {
    assert.match(text({ condolenceOptions: [] }), /لا يوجد عزاء/u);
    const cemetery = text({ condolenceOptions: ["men_cemetery", "phone"], phoneAudience: "women", condolenceNote: "اتباعاً للسنة" });
    includesInOrder(cemetery, ["عزاء الرجال في المقبرة فقط اتباعاً للسنة", "عزاء النساء عبر الهاتف"]);
    assert.match(text({ condolenceOptions: ["tbd"] }), /سيُحدَّد لاحقاً/u);
  }],
  ["«لا يوجد عزاء / والنساء عبر الهاتف»", () => {
    const result = text({ condolenceOptions: ["phone"], phoneAudience: "women", condolencePhoneContacts: [{ name: "أم خالد", phone: "5000" }] });
    includesInOrder(result, ["لا يوجد عزاء للرجال", "وعزاء النساء عن طريق هاتف أم خالد: 5000"]);
  }],
  ["إلغاء عزاء لاحق بقرار رسمي مع الاكتفاء بالهاتف", () => {
    const result = text({
      messageType: "condolence_cancellation",
      deceasedPeople: [{ title: "الوالد", fullName: "محمد علي", gender: "man" }],
      cancellation: { audience: "men", from: "لليوم الثالث", reason: "وفقاً لقرار وزارة الداخلية", phoneOnly: true },
    });
    assert.equal(result, "وفقاً لقرار وزارة الداخلية، تقرر إلغاء عزاء الرجال لليوم الثالث في عزاء الوالد / محمد علي رحمه الله\nويُكتفى بتلقي العزاء عبر الهاتف");
  }],
  ["لا «يوم اليوم» ولا «يوم» معلّقة", () => {
    const result = text({ burial: { status: "upcoming", outsideQatar: false, day: "اليوم", time: "بعد صلاة المغرب", cemetery: "الخور" } });
    assert.match(result, /الدفن اليوم بعد صلاة المغرب في مقبرة الخور/u);
    assert.doesNotMatch(result, /يوم اليوم|يوم غداً/u);
    const empty = buildAnnouncement(request({ burial: { status: "upcoming", outsideQatar: false, cemetery: "مقبرة مسيمير" } }));
    assert.match(empty.text, /^الدفن في مقبرة مسيمير$/mu);
    assert.ok(empty.warnings.includes("يوم الدفن غير محدد."));
  }],
  ["تمييز العدد", () => {
    assert.equal(countNoun(1, { singular: "عام", dual: "عامان", plural: "أعوام", accusative: "عاماً" }), "عام واحد");
    assert.equal(formatAge(2), "عامان");
    assert.equal(formatAge(3), "3 أعوام");
    assert.equal(formatAge(10), "10 أعوام");
    assert.equal(formatAge(11), "11 عاماً");
    assert.equal(formatAge(100), "100 عام");
    assert.equal(formatAge(1, "months"), "شهر واحد");
    assert.match(text({ condolenceOptions: ["men"], condolences: [{ audience: "men", location: "مجلس", durationDays: 2 }] }), /لمدة يومين/u);
  }],
  ["الطفل: «انتقل إلى رحمة الله تعالى الطفل /» و«شفيعاً لوالديه يارب»", () => {
    const result = text({ deceasedPeople: [{ fullName: "يوسف", gender: "boy" }] });
    assert.ok(result.startsWith("انتقل إلى رحمة الله تعالى الطفل / يوسف"), result);
    assert.ok(result.endsWith("شفيعاً لوالديه يارب"));
  }],
  ["ثلاث نساء بأزواج مختلفين: «توفيت كل من» وسطر «حرم» لكل منهن", () => {
    const result = text({
      announcementMode: "unrelated",
      deceasedPeople: [
        { gender: "woman", identifyBy: "spouse", spouse: { kind: "harem", name: "علي", deceased: false } },
        { gender: "woman", identifyBy: "spouse", spouse: { kind: "harem", name: "حسن", deceased: false } },
        { gender: "woman", fullName: "سارة", spouse: { kind: "widow", name: "حمد", deceased: true } },
      ],
    });
    includesInOrder(result, ["توفيت كل من", "حرم / علي", "حرم / حسن", "/ سارة", "أرملة / حمد رحمهم الله", "الله يرحمهن ويغفر لهن"]);
  }],
  ["قائمة النموذج الأصلية: «أبناء عمومته» بضمير المتوفى، و«أخرى» لا تُطبع", () => {
    const cousins = (gender: "man" | "woman", names: string[]) => text({
      deceasedPeople: [{ fullName: "نورة", gender }],
      relatives: [{ relation: "أبناء عمومته", relationKey: "other", people: names.map((name) => ({ name, deceased: false })) }],
    });
    includesInOrder(cousins("woman", ["خالد", "سعد"]), ["أبناء عمومتها كل من", "خالد", "وسعد"]);
    includesInOrder(cousins("man", ["خالد", "سعد"]), ["أبناء عمومته كل من"]);
    assert.match(cousins("woman", ["خالد"]), /ابن عمها \/ خالد/u);

    const blank = buildAnnouncement(request({ relatives: [{ relation: "أخرى", people: [{ name: "خالد", deceased: false }] }] }));
    assert.match(blank.text, /الأقارب \/ خالد/u);
    assert.doesNotMatch(blank.text, /أخرى/u);
    assert.ok(blank.warnings.some((warning) => warning.includes("صلة القرابة")));
  }],
  ["عنوان حر مكتوب كاملاً لا يكرر «كل من»", () => {
    const result = text({
      deceasedPeople: [{ fullName: "نورة", gender: "woman" }],
      relatives: [{ relation: "والدة كل من", relationKey: "other", people: [{ name: "باسل", deceased: false }, { name: "محمد", deceased: false }] }],
    });
    includesInOrder(result, ["والدة كل من", "باسل", "ومحمد"]);
    assert.doesNotMatch(result, /كل من كل من/u);
  }],
  ["«مقابل جامع…» لا تسبقه «في»", () => {
    const text = buildAnnouncement({
      deceasedPeople: [{ fullName: "محمد بن سالم", title: "الوالد", gender: "man" }],
      relatives: [],
      prayer: { enabled: false },
      burial: { status: "upcoming", outsideQatar: false, day: "اليوم", time: "بعد صلاة المغرب", cemetery: "مقبرة مسيمير" },
      condolenceOptions: ["men", "women"],
      condolences: [
        { audience: "men", location: "مقابل جامع جاسم درويش فخرو", area: "أبوهامور" },
        { audience: "women", location: "منزل الفقيد رقم ٢٥", area: "بوهامور" },
      ],
    } as never).text;
    assert.match(text, /عزاء الرجال مقابل جامع جاسم درويش فخرو بمنطقة أبوهامور/u);
    assert.match(text, /والنساء في منزل الفقيد رقم ٢٥ بمنطقة بوهامور/u);
    assert.doesNotMatch(text, /في مقابل/u);
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
  console.error(`${failed} of ${cases.length} announcement cases failed.`);
  process.exit(1);
}
console.log(`Passed ${cases.length} announcement cases.`);
