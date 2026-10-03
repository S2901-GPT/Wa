/**
 * اختبارات «طلب من نص»: تصحيح ناتج الذكاء الاصطناعي إلى طلب يقبله الخادم، وترجمة أخطاء الخدمة،
 * ومسار المسؤول عبر خادم HTTP حقيقي. لا اتصال فعلي بـ Gemini: الردود مصطنعة.
 */
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { ADMIN_COOKIE, createSessionToken } from "./admin-auth";
import { AiError, DEFAULT_MODEL, FALLBACK_MODEL, aiConfig, aiEnvHints, buildGeminiBody, extractRequest, readJson, toRequest } from "./ai-extract";
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
  condolencePhoneContacts: [],
  notes: "",
  warnings: ["لم يُذكر عمر المتوفى."],
};

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
  ["toRequest: أرقام التعزية تضيف «phone»، والقيم غير المعروفة تعود للافتراضي", () => {
    const { request } = toRequest({
      messageType: "weird",
      deceasedPeople: [{ fullName: "حمد", gender: "man" }],
      relatives: [], prayer: {}, burial: { status: "soon" }, condolences: [],
      condolencePhoneContacts: [{ name: "فهد", phone: "55123456" }, { name: "بلا رقم" }],
      warnings: [],
    });
    assert.equal(request.messageType, "announcement");
    assert.equal(request.burial.status, "upcoming");
    assert.equal(request.burial.outsideQatar, false);
    assert.equal(request.prayer.enabled, false);
    assert.deepEqual(request.condolenceOptions, ["phone"]);
    assert.equal(request.condolencePhoneContacts.length, 1);
  }],
  ["readJson: يقبل الرد المحاط بعلامات ```json ويرفض غير المفهوم", () => {
    assert.deepEqual(readJson('```json\n{"a":1}\n```'), { a: 1 });
    assert.throws(() => readJson("ليس JSON"), (error: unknown) => error instanceof AiError && error.status === 502);
  }],
  ["buildGeminiBody: النص داخل الطلب، والرد JSON بمخطط ثابت", () => {
    const body = buildGeminiBody("توفي فلان");
    assert.match(body.contents[0].parts[0].text, /توفي فلان/u);
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.equal((body.generationConfig.responseSchema as { type: string }).type, "OBJECT");
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
