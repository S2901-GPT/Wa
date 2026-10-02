/**
 * اختبارات الجسر بين شكل بيانات النموذج (deceasedList…) وعقد الـ API (deceasedPeople…).
 * أهمها: ما يرسله النموذج يقبله الخادم فعلاً (كان يُرفض بخطأ 400 قبل هذا الجسر).
 */
import assert from "node:assert/strict";
import type { ObituaryRequest } from "@workspace/api-client-react";
import { CreateObituaryRequestBody } from "@workspace/api-zod";
import { buildAnnouncement } from "./announcement";
import { OTHER_RELATION, mapFormToPayload, mapPayloadToForm, relationSelectValue } from "./mapper";
import { ObituaryFormSchema, emptyDeceased, emptyFormValues, type ObituaryFormValues } from "./schema";

const NOW = new Date(2026, 9, 2); // الجمعة 2 أكتوبر 2026

function form(edit: (values: ObituaryFormValues) => void): ObituaryFormValues {
  const values = emptyFormValues();
  values.deceasedList[0] = { ...emptyDeceased(), gender: "ذكر", title: "الوالد", fullName: "محمد علي" };
  values.burial = { ...values.burial!, status: "scheduled", locationName: "مقبرة مسيمير", dateDescription: "2026-10-02", timeDescription: "بعد صلاة العصر" };
  values.condolences = { ...values.condolences!, type: "none" };
  edit(values);
  return values;
}

const issues = (values: ObituaryFormValues) => {
  const result = ObituaryFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
};

const text = (values: ObituaryFormValues) => buildAnnouncement(mapFormToPayload(values), { now: NOW }).text;

function serverAccepts(values: ObituaryFormValues) {
  const result = CreateObituaryRequestBody.safeParse(mapFormToPayload(values));
  assert.ok(result.success, result.success ? "" : JSON.stringify(result.error.issues.slice(0, 5)));
}

const asRequest = (values: ObituaryFormValues): ObituaryRequest => ({
  ...mapFormToPayload(values),
  id: 1,
  requestNumber: "QTR-TEST",
  createdAt: "2026-10-02T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
  status: "new",
});

const cases: Array<[string, () => void]> = [
  ["الجنس لا يُفترض: النموذج الفارغ يطلب اختياره", () => {
    const values = emptyFormValues();
    values.deceasedList[0].fullName = "محمد علي";
    assert.ok(issues(values).some((issue) => issue.startsWith("deceasedList.0.gender")));
  }],
  ["ما يرسله النموذج يقبله الخادم، والنص بصيغة الأرشيف", () => {
    const values = form(() => {});
    assert.deepEqual(issues(values), []);
    serverAccepts(values);
    assert.equal(text(values), "توفي الوالد / محمد علي\n\nالدفن اليوم الجمعة بعد صلاة العصر في مقبرة مسيمير\n\nلا يوجد عزاء\n\nالله يرحمه ويغفر له");
  }],
  ["أرملة بلا اسم (معرّف القرابة) ← «أرملة الوالد / … رحمهم الله»", () => {
    const values = form((draft) => {
      draft.deceasedList[0] = {
        ...emptyDeceased(),
        gender: "أنثى",
        femaleRelations: [{ relationType: "أرملة", relatedTitle: "الوالد", relatedName: "سيف سعيد", isHusbandDeceased: true }],
      };
      draft.relatives = [{
        relationType: "الأبناء", relationKey: "children", deceasedPlacement: "auto", deceasedTarget: "all",
        persons: [{ name: "غانم", isDeceased: false, workplace: "", jobStatus: "none" }, { name: "ناصر", isDeceased: false, workplace: "", jobStatus: "none" }],
      }];
    });
    assert.deepEqual(issues(values), []);
    serverAccepts(values);
    assert.ok(text(values).startsWith("توفيت أرملة الوالد / سيف سعيد رحمهم الله\nوالدة كل من\nغانم\nوناصر"), text(values));
    assert.ok(text(values).endsWith("الله يرحمها ويغفر لها"));
  }],
  ["الطفل يُعرف من اللقب، ووحدة العمر من اللقب: الرضيع بالأشهر والطفل بالسنوات", () => {
    const infant = text(form((draft) => {
      draft.deceasedList[0] = { ...emptyDeceased(), gender: "ذكر", title: "الرضيع", fullName: "يوسف", age: 8 };
    }));
    assert.ok(infant.startsWith("انتقل إلى رحمة الله تعالى الرضيع / يوسف\n8 أشهر"), infant);
    assert.ok(infant.endsWith("شفيعاً لوالديه يارب"));
    const child = text(form((draft) => {
      draft.deceasedList[0] = { ...emptyDeceased(), gender: "ذكر", title: "الطفل", fullName: "يوسف", age: 8 };
    }));
    assert.ok(child.startsWith("انتقل إلى رحمة الله تعالى الطفل / يوسف\n8 أعوام"), child);
  }],
  ["الأقارب: «أبناؤه»، جهة العمل ثم (متقاعد)، و«رحمه الله» بجانب كل اسم", () => {
    const values = form((draft) => {
      draft.relatives = [{
        relationType: "أبناؤه", deceasedPlacement: "auto", deceasedTarget: "all",
        persons: [
          { name: "أحمد", isDeceased: false, workplace: "وزارة الداخلية", jobStatus: "retired" },
          { name: "خالد", isDeceased: false, workplace: "قطر للطاقة", jobStatus: "none" },
          { name: "سالم", isDeceased: true, workplace: "", jobStatus: "none" },
          { name: "حمد", isDeceased: true, workplace: "", jobStatus: "none" },
        ],
      }];
    });
    assert.match(text(values), /والد كل من\nأحمد \(وزارة الداخلية\) \(متقاعد\)\nوخالد \(قطر للطاقة\)\nوسالم رحمه الله\nوحمد رحمه الله/u);
    const back = mapPayloadToForm(asRequest(values));
    assert.deepEqual(back.relatives[0].persons.slice(0, 2).map((p) => [p.workplace, p.jobStatus]), [["وزارة الداخلية", "retired"], ["قطر للطاقة", "none"]]);
  }],
  ["«تم الدفن» بملاحظة، و«مؤجل» حتى إشعار آخر", () => {
    const done = form((draft) => { draft.burial = { ...draft.burial!, status: "done", locationName: "", dateDescription: "", timeDescription: "", notes: "تم الدفن في مكة المكرمة" }; });
    assert.match(text(done), /^تم الدفن في مكة المكرمة$/mu);
    const postponed = form((draft) => { draft.burial = { ...draft.burial!, status: "pending", notes: "لحين وصول الجثمان" }; });
    assert.match(text(postponed), /تأجيل الدفن حتى إشعار آخر\nلحين وصول الجثمان/u);
  }],
  ["الصلاة في جامع منفصل بموعد الدفن ثم «والدفن في …»", () => {
    const values = form((draft) => { draft.prayer = { ...draft.prayer!, enabled: true, locationName: "جامع الإمام محمد بن عبدالوهاب" }; });
    assert.match(text(values), /صلاة الجنازة اليوم الجمعة بعد صلاة العصر في جامع الإمام محمد بن عبدالوهاب\nوالدفن في مقبرة مسيمير/u);
  }],
  ["أنواع العزاء: المقبرة فقط، الهاتف، سيُحدَّد لاحقاً، ومواقع إضافية", () => {
    const cemetery = form((draft) => { draft.condolences = { ...draft.condolences!, type: "cemetery_only", cancellationOrRestrictionReason: "اتباعاً للسنة" }; });
    assert.match(text(cemetery), /عزاء الرجال في المقبرة فقط اتباعاً للسنة/u);
    const phone = form((draft) => { draft.condolences = { ...draft.condolences!, type: "phone_only", phones: ["ناصر (الأبناء): 55551234"] }; });
    assert.match(text(phone), /العزاء عن طريق هاتف ناصر: 55551234/u);
    serverAccepts(phone);
    const tbd = form((draft) => { draft.condolences = { ...draft.condolences!, type: "tbd" }; });
    assert.match(text(tbd), /سيُحدَّد لاحقاً/u);
    const extra = form((draft) => {
      draft.condolences = {
        ...draft.condolences!,
        type: "full",
        men: { ...draft.condolences!.men!, locationName: "مجلس العائلة في الدفنة", durationDays: 3 },
        women: { ...draft.condolences!.women!, locationName: "منزل ابنته في الوعب" },
        extraVenues: [{ ...draft.condolences!.women!, audience: "women", locationName: "منزل ابنته في الخور" }],
      };
      draft.condolenceStartDate = "2026-10-03";
      draft.condolenceStartTime = "بعد صلاة العصر";
    });
    assert.deepEqual(issues(extra), []);
    serverAccepts(extra);
    const result = text(extra);
    assert.match(result, /عزاء الرجال من غداً السبت بعد صلاة العصر في مجلس العائلة في الدفنة\nلمدة 3 أيام/u);
    assert.match(result, /عزاء النساء الأول من غداً السبت بعد صلاة العصر في منزل ابنته في الوعب/u);
    assert.match(result, /عزاء النساء الثاني من غداً السبت بعد صلاة العصر في منزل ابنته في الخور/u);
  }],
  ["أوقات العزاء الصباحية والمسائية بصيغة 12 ساعة", () => {
    const values = form((draft) => {
      draft.condolences = {
        ...draft.condolences!,
        type: "men_only",
        men: {
          ...draft.condolences!.men!,
          locationName: "مجلس العائلة",
          schedule: { enabled: true, morningFrom: "", morningTo: "", eveningFrom: "16:00", eveningTo: "21:00", fridayNote: "بعد صلاة العصر" },
        },
      };
    });
    assert.match(text(values), /الفترة المسائية من 4:00 مساءً إلى 9:00 مساءً\nيوم الجمعة بعد صلاة العصر/u);
  }],
  ["ذهاباً وإياباً: النموذج ← الطلب ← النموذج (صفحة التعديل)", () => {
    const values = form((draft) => {
      draft.messageType = "amendment";
      draft.relatedRequestNumber = "QTR-1";
      draft.announcementMode = "siblings";
      draft.sharedParent = { title: "", name: "فهد", isDeceased: true };
      draft.deceasedList = [
        { ...emptyDeceased(), gender: "ذكر", fullName: "سعود", age: 22 },
        { ...emptyDeceased(), gender: "ذكر", title: "الرضيع", fullName: "جاسم", age: 8 },
      ];
      draft.relatives = [{
        relationType: "الأعمام", relationKey: "paternal_uncles", deceasedPlacement: "grouped", deceasedTarget: "all",
        persons: [{ name: "خالد", isDeceased: true, workplace: "", jobStatus: "none" }, { name: "حمد", isDeceased: true, workplace: "", jobStatus: "none" }],
      }];
      draft.condolences = {
        ...draft.condolences!,
        type: "women_only",
        women: {
          ...draft.condolences!.women!,
          locationName: "منزل رقم ٥",
          deceasedTarget: "0",
          schedule: { enabled: true, morningFrom: "09:00", morningTo: "12:00", eveningFrom: "", eveningTo: "", fridayNote: "" },
        },
        extraVenues: [{ ...draft.condolences!.women!, audience: "women", locationName: "منزل رقم ٩", deceasedTarget: "1" }],
      };
      draft.condolenceStartDate = "2026-10-02";
    });
    assert.deepEqual(issues(values), []);
    const back = mapPayloadToForm(asRequest(values));
    assert.equal(back.messageType, "amendment");
    assert.equal(back.announcementMode, "siblings");
    assert.equal(back.sharedParent?.name, "فهد");
    assert.equal(back.deceasedList[1].gender, "ذكر");
    assert.equal(back.deceasedList[1].title, "الرضيع");
    assert.equal(back.deceasedList[1].ageUnit, "months");
    assert.equal(back.relatives[0].relationKey, "paternal_uncles");
    assert.equal(back.relatives[0].deceasedPlacement, "grouped");
    assert.equal(back.burial?.dateDescription, "2026-10-02");
    assert.equal(back.condolences?.type, "women_only");
    assert.equal(back.condolences?.women?.deceasedTarget, "0");
    assert.equal(back.condolences?.women?.schedule?.morningFrom, "09:00");
    assert.equal(back.condolences?.women?.schedule?.morningTo, "12:00");
    assert.equal(back.condolences?.extraVenues?.[0]?.deceasedTarget, "1");
    assert.equal(back.condolenceStartDate, "2026-10-02");
    assert.equal(text(back), text(values));
    assert.match(text(values), /^تعديل \/\nتوفي كل من\nسعود — 22 عاماً\nالرضيع جاسم — 8 أشهر\nأبناء \/ فهد رحمه الله\nأعمامهم كل من\nخالد وحمد رحمهما الله/u);
  }],
  ["طلب قديم: «other» لا يصبح «ذكر»، واللقب الحر لا يضيع", () => {
    const legacy = {
      id: 9, requestNumber: "QTR-OLD", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", status: "new",
      deceasedPeople: [{ fullName: "فلان", gender: "other", title: "الوالد اللواء متقاعد" }],
      relatives: [{ relation: "أخ", familyReference: "", people: [{ name: "علي", deceased: false }] }],
      prayer: { enabled: false },
      burial: { status: "upcoming", outsideQatar: false, day: "اليوم", time: "الساعة 9", cemetery: "مقبرة الدحيل" },
      condolenceOptions: [], condolences: [], condolencePhoneContacts: [],
    } as ObituaryRequest;
    const values = mapPayloadToForm(legacy);
    assert.equal(values.deceasedList[0].gender, undefined);
    assert.equal(values.deceasedList[0].notes, "الوالد اللواء متقاعد");
    assert.equal(values.relatives[0].relationKey, "siblings");
    assert.equal(values.burial?.locationName, "مقبرة الدحيل");
  }],
  ["قائمة الصلة الأصلية: «أبناؤه» يبقى ظاهراً بعد الحفظ، وما لا مقابل له تحت «أخرى»", () => {
    const options = ["أبناؤه", "أخوانه", "أعمامه", "أخواله", "أبناء عمومته", "أصهاره", "أحفاده", OTHER_RELATION];
    const values = form((draft) => {
      draft.deceasedList[0] = { ...emptyDeceased(), gender: "أنثى", fullName: "نورة" };
      draft.relatives = [
        { relationType: "أبناؤه", relationKey: "children", deceasedPlacement: "auto", deceasedTarget: "all", persons: [{ name: "غانم", isDeceased: false }, { name: "ناصر", isDeceased: false }] },
        { relationType: "أبناء عمومته", relationKey: "other", deceasedPlacement: "auto", deceasedTarget: "all", persons: [{ name: "خالد", isDeceased: false }] },
      ];
    });
    serverAccepts(values);
    assert.match(text(values), /والدة كل من\nغانم\nوناصر\nابن عمها \/ خالد/u);

    const back = mapPayloadToForm(asRequest(values));
    assert.equal(relationSelectValue(back.relatives[0].relationType, back.relatives[0].relationKey, options), "أبناؤه");
    assert.equal(relationSelectValue(back.relatives[1].relationType, back.relatives[1].relationKey, options), "أبناء عمومته");
    assert.equal(relationSelectValue("الأشقاء", "full_siblings", options), OTHER_RELATION);
    assert.equal(relationSelectValue("", "other", options), OTHER_RELATION);
    assert.equal(relationSelectValue(undefined, undefined, options), "");
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
