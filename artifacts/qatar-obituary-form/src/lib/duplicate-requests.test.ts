/**
 * اختبارات كشف الطلب المكرر: مطابقة الاسم (اختصاره، واختلاف العائلة، والهمزات)، والنافذة الزمنية.
 */
import assert from "node:assert/strict";
import type { ObituaryRequest } from "@workspace/api-client-react";
import { DUPLICATE_WINDOW_HOURS, findRecentDuplicates, nameTokens, sameDeceasedName } from "./duplicate-requests";

const NOW = new Date("2026-10-07T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();

function saved(requestNumber: string, fullName: string, hours: number, overrides: Partial<ObituaryRequest> = {}): ObituaryRequest {
  return {
    id: Number(requestNumber),
    requestNumber,
    createdAt: hoursAgo(hours),
    updatedAt: hoursAgo(hours),
    status: "new",
    deceasedPeople: [{ fullName, gender: "man" }],
    relatives: [],
    prayer: { enabled: false },
    burial: { status: "upcoming", outsideQatar: false },
    condolenceOptions: [],
    condolences: [],
    ...overrides,
  } as ObituaryRequest;
}

const candidate = (fullName: string) => ({ deceasedPeople: [{ fullName, gender: "man" as const }] });

const cases: Array<[string, () => void]> = [
  ["كلمات الاسم: بلا «بن» و«آل»، وبتوحيد الهمزات والتاء المربوطة", () => {
    assert.deepEqual(nameTokens("محمد بن عبدالله آل ثاني"), ["محمد", "عبدالله", "ثاني"]);
    assert.deepEqual(nameTokens("أحمد إبراهيم فاطمة"), nameTokens("احمد ابراهيم فاطمه"));
    assert.deepEqual(nameTokens("   "), []);
  }],
  ["الاسم المختصر جزء من الكامل ← الشخص نفسه", () => {
    assert.equal(sameDeceasedName("عبدالله حمد هادي", "عبدالله حمد هادي دخيل الودعاني الدوسري"), true);
    assert.equal(sameDeceasedName("عبدالله حمد هادي دخيل الودعاني الدوسري", "عبدالله حمد هادي"), true);
    // ويطابق رغم اختلاف الهمزات
    assert.equal(sameDeceasedName("احمد ابراهيم العطيه", "أحمد إبراهيم العطية"), true);
  }],
  ["اسم العائلة يفرّق بين المتشابهين", () => {
    assert.equal(sameDeceasedName("جاسم محمد علي الهاجري", "جاسم محمد علي المري"), false);
    assert.equal(sameDeceasedName("محمد علي", "محمد حسن"), false);
    // واتفاق العائلة مع أغلب الكلمات يكفي
    assert.equal(sameDeceasedName("سالم محمد ناصر المهندي", "سالم محمد خالد المهندي"), true);
  }],
  ["اسم فارغ لا يطابق شيئاً", () => {
    assert.equal(sameDeceasedName("", "محمد علي"), false);
    assert.equal(sameDeceasedName("محمد علي", "  "), false);
  }],
  ["التكرار ضمن 48 ساعة فقط، والأحدث أولاً", () => {
    const requests = [
      saved("100001", "عبدالله حمد هادي دخيل الودعاني الدوسري", 40),
      saved("100002", "عبدالله حمد الدوسري", 3),
      saved("100003", "جاسم محمد علي المري", 2),
      saved("100004", "عبدالله حمد هادي الدوسري", 60), // أقدم من النافذة
    ];
    const found = findRecentDuplicates(candidate("عبدالله حمد هادي دخيل الودعاني الدوسري"), requests, NOW);
    assert.deepEqual(found.map((match) => match.request.requestNumber), ["100002", "100001"]);
    assert.equal(found[0].name, "عبدالله حمد الدوسري");
    // اسم آخر لا يطابق أحداً
    assert.deepEqual(findRecentDuplicates(candidate("خالد ناصر العطية"), requests, NOW), []);
  }],
  ["النافذة قابلة للضبط، والطلب نفسه يُستثنى، والتواريخ غير الصالحة تُتجاهل", () => {
    const requests = [saved("100001", "عبدالله حمد الدوسري", 40), saved("100002", "عبدالله حمد الدوسري", 2)];
    assert.deepEqual(
      findRecentDuplicates(candidate("عبدالله حمد الدوسري"), requests, NOW, { windowHours: 6 }).map((m) => m.request.requestNumber),
      ["100002"],
    );
    assert.deepEqual(
      findRecentDuplicates(candidate("عبدالله حمد الدوسري"), requests, NOW, { excludeRequestNumber: "100002" }).map((m) => m.request.requestNumber),
      ["100001"],
    );
    const broken = [{ ...saved("100003", "عبدالله حمد الدوسري", 1), createdAt: "ليس تاريخاً" } as ObituaryRequest];
    assert.deepEqual(findRecentDuplicates(candidate("عبدالله حمد الدوسري"), broken, NOW), []);
  }],
  ["يطابق الكنية واسم الزوج أيضاً، ولا يطابق طلباً بلا متوفى", () => {
    const byKunya = saved("100005", "", 2, { deceasedPeople: [{ gender: "woman", kunya: "أم ناصر" }] } as Partial<ObituaryRequest>);
    const found = findRecentDuplicates({ deceasedPeople: [{ gender: "woman", kunya: "ام ناصر" }] }, [byKunya], NOW);
    assert.deepEqual(found.map((match) => match.request.requestNumber), ["100005"]);
    assert.deepEqual(findRecentDuplicates({ deceasedPeople: [] }, [byKunya], NOW), []);
  }],
  ["النافذة الافتراضية 48 ساعة", () => {
    assert.equal(DUPLICATE_WINDOW_HOURS, 48);
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
  console.error(`${failed} of ${cases.length} duplicate request cases failed.`);
  process.exit(1);
}
console.log(`Passed ${cases.length} duplicate request cases.`);
