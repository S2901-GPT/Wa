/**
 * اختبارات «طلب من نص»: تصحيح ناتج الذكاء الاصطناعي إلى طلب يقبله الخادم، وترجمة أخطاء الخدمة،
 * ومسار المسؤول عبر خادم HTTP حقيقي. لا اتصال فعلي بـ Gemini: الردود مصطنعة.
 */
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { ADMIN_COOKIE, createSessionToken } from "./admin-auth";
import { AiError, DEFAULT_MODEL, FALLBACK_MODEL, HOLLOW_WARNING, aiConfig, aiEnvHints, buildGeminiBody, extractRequest, isHollow, readJson, splitBurialNote, stripCommentary, toRequest } from "./ai-extract";
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
  ["splitBurialNote: موعد الدفن والمقبرة المكدّسة في note أو time تعود إلى حقولها", () => {
    assert.deepEqual(
      splitBurialNote({ status: "upcoming", outsideQatar: false, note: "الساعة 9:30 مساءً في مقبرة مسيمير اليوم الاثنين" }),
      { status: "upcoming", outsideQatar: false, day: "اليوم", weekday: "الاثنين", time: "الساعة 9:30 مساءً", cemetery: "مقبرة مسيمير", note: undefined },
    );
    assert.deepEqual(
      splitBurialNote({ status: "upcoming", outsideQatar: false, time: "بعد صلاة العصر في مقبرة أبو هامور غداً" }),
      { status: "upcoming", outsideQatar: false, day: "غداً", weekday: undefined, time: "بعد صلاة العصر", cemetery: "مقبرة أبو هامور", note: undefined },
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
