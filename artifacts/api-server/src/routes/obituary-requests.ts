import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import {
  CreateObituaryRequestBody,
  CreateObituaryRequestResponse,
  DeleteObituaryRequestParams,
  GetObituaryRequestParams,
  GetObituaryRequestResponse,
  ListObituaryRequestsResponse,
  UpdateObituaryRequestBody,
  UpdateObituaryRequestParams,
  UpdateObituaryRequestResponse,
} from "@workspace/api-zod";
import { labRequestsDb, obituaryRequestsDb, type ObituaryRequestRow, type RequestsStore } from "@workspace/db";
import { clientKey, createRateLimiter, isAdminRequest, requireAdmin } from "../lib/admin-auth";
import { appendHistory, diffRequests, sanitizeAudit, type HistoryEntry } from "../lib/request-audit";

type RequestPayload = Record<string, unknown>;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalIndex(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizeLinkedPerson(value: unknown) {
  const person = objectValue(value);
  const name = optionalString(person.name);
  if (!name) return undefined;
  return {
    ...(optionalString(person.title) ? { title: String(person.title) } : {}),
    name,
    deceased: person.deceased === true,
  };
}

function normalizeRelatives(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((group) => {
    const relativeGroup = objectValue(group);
    const sourcePeople = Array.isArray(relativeGroup.people)
      ? relativeGroup.people
      : Array.isArray(relativeGroup.names)
        ? relativeGroup.names.map((name) => ({ name }))
        : [];
    const reference = normalizeLinkedPerson(relativeGroup.reference);
    return {
      relation: String(relativeGroup.relation ?? ""),
      ...(optionalString(relativeGroup.relationKey) ? { relationKey: relativeGroup.relationKey } : {}),
      familyReference: String(relativeGroup.familyReference ?? ""),
      ...(reference ? { reference } : {}),
      ...(optionalString(relativeGroup.deceasedPlacement) ? { deceasedPlacement: relativeGroup.deceasedPlacement } : {}),
      deceasedIndex: optionalIndex(relativeGroup.deceasedIndex),
      people: sourcePeople.map((person) => {
        const relativePerson = typeof person === "string" ? { name: person } : objectValue(person);
        return {
          name: String(relativePerson.name ?? ""),
          occupation: String(relativePerson.occupation ?? ""),
          deceased: relativePerson.deceased === true,
        };
      }),
    };
  });
}

/**
 * اسم مختصر للعرض في قوائم الإدارة. المتوفاة قد لا يُذكر اسمها، فيُستعمل
 * طريق التعريف (الكنية أو «حرم/أرملة فلان» أو «ابنة فلان») بدل وضع اسم شخص آخر مكان اسمها.
 */
function summarizeDeceased(people: unknown): string {
  if (!Array.isArray(people)) return "";
  return people.map((value) => {
    const person = objectValue(value);
    const female = person.gender === "woman" || person.gender === "girl";
    const fullName = optionalString(person.fullName);
    const kunya = optionalString(person.kunya);
    const spouse = objectValue(person.spouse);
    const father = objectValue(person.father);
    if (person.identifyBy === "kunya" && kunya) return kunya;
    if (person.identifyBy === "spouse" && optionalString(spouse.name)) {
      return `${spouse.kind === "widow" ? (female ? "أرملة" : "أرمل") : (female ? "حرم" : "زوج")} ${spouse.name}`;
    }
    if (person.identifyBy === "father" && optionalString(father.name)) {
      return `${female ? "ابنة" : "ابن"} ${father.name}`;
    }
    if (person.identifyBy === "children") return female ? "والدة (بلا اسم)" : "والد (بلا اسم)";
    return fullName ?? kunya ?? "";
  }).filter(Boolean).join("، ");
}

function normalizePayload(payload: RequestPayload) {
  // السجلات القديمة: لا نفترض «رجل» عند غياب الجنس؛ «other» يُظهر تنبيهاً للمراجع بدل نص بجنس خاطئ.
  const oldGender = payload.gender === "female" ? "woman" : payload.gender === "male" ? "man" : "other";
  const deceasedPeople = Array.isArray(payload.deceasedPeople)
    ? payload.deceasedPeople
    : [{
        fullName: String(payload.deceasedName ?? ""),
        gender: oldGender,
        age: typeof payload.age === "number" ? payload.age : null,
        nationality: String(payload.nationality ?? ""),
        deathPlace: "",
        title: "",
        occupation: String(payload.occupation ?? ""),
        note: "",
      }];

  const oldMen = objectValue(payload.menCondolence);
  const oldWomen = objectValue(payload.womenCondolence);
  const menEnabled = oldMen.enabled === true;
  const womenEnabled = oldWomen.enabled === true;
  const rawCondolences = Array.isArray(payload.condolences)
    ? payload.condolences
    : [
        ...(menEnabled ? [{
          audience: "men",
          location: String(oldMen.location ?? ""),
          mapLink: String(oldMen.mapLink ?? ""),
          start: "",
          durationDays: null,
          time: String(oldMen.time ?? ""),
        }] : []),
        ...(womenEnabled ? [{
          audience: "women",
          location: String(oldWomen.location ?? ""),
          mapLink: String(oldWomen.mapLink ?? ""),
          start: "",
          durationDays: null,
          time: String(oldWomen.time ?? ""),
        }] : []),
      ];
  const legacyType = String(payload.condolenceType ?? "");
  const condolenceOptions = Array.isArray(payload.condolenceOptions)
    ? payload.condolenceOptions.filter((option): option is "phone" | "men" | "women" | "men_cemetery" | "tbd" =>
        option === "phone" || option === "men" || option === "women" || option === "men_cemetery" || option === "tbd")
    : [
        ...(legacyType === "men" || legacyType === "separate" || legacyType === "shared" ? ["men" as const] : []),
        ...(legacyType === "women" || legacyType === "separate" || legacyType === "shared" ? ["women" as const] : []),
      ];
  const condolences = rawCondolences.flatMap((card) => {
    const value = objectValue(card);
    const audience = value.audience === "women" ? "women" : value.audience === "both" ? "both" : "men";
    if (audience === "both") {
      return [{ ...value, audience: "men" }, { ...value, audience: "women" }];
    }
    return [{ ...value, audience }];
  }).filter((card) => card.audience === "men" || card.audience === "women");

  const messageType = optionalString(payload.messageType) ?? "announcement";
  const announcementMode = optionalString(payload.announcementMode)
    ?? (deceasedPeople.length > 1 ? "unrelated" : "single");
  const sharedParent = normalizeLinkedPerson(payload.sharedParent);
  const cancellation = objectValue(payload.cancellation);

  return {
    messageType,
    ...(optionalString(payload.relatedRequestNumber) ? { relatedRequestNumber: String(payload.relatedRequestNumber) } : {}),
    announcementMode,
    ...(sharedParent ? { sharedParent } : {}),
    ...(messageType === "condolence_cancellation" ? {
      cancellation: {
        audience: cancellation.audience === "women" || cancellation.audience === "all" ? cancellation.audience : "men",
        from: String(cancellation.from ?? ""),
        reason: String(cancellation.reason ?? ""),
        phoneOnly: cancellation.phoneOnly === true,
      },
    } : {}),
    deceasedPeople,
    relatives: normalizeRelatives(payload.relatives),
    ...(payload.noRelatives === true ? { noRelatives: true } : {}),
    prayer: payload.prayer ?? {
      enabled: payload.hasSeparatePrayer === true,
      day: "",
      time: "",
      place: String(payload.prayerDetails ?? ""),
      mapLink: "",
    },
    burial: payload.burial ?? {
      status: payload.burialStatus === "completed" ? "completed" : "upcoming",
      day: String(payload.burialDay ?? ""),
      time: String(payload.burialTime ?? ""),
      cemetery: String(payload.cemetery ?? ""),
      mapLink: "",
      outsideQatar: false,
      outsideLocation: "",
    },
    condolences,
    condolenceOptions,
    ...(condolenceOptions.includes("phone") ? {
      phoneAudience: payload.phoneAudience === "men" || payload.phoneAudience === "women" ? payload.phoneAudience : "all",
    } : {}),
    ...(optionalString(payload.condolenceNote) ? { condolenceNote: String(payload.condolenceNote) } : {}),
    condolencePhoneContacts: condolenceOptions.includes("phone") && Array.isArray(payload.condolencePhoneContacts)
      ? payload.condolencePhoneContacts.map((contact) => {
          const value = objectValue(contact);
          return {
            ...(value.name ? { name: String(value.name) } : {}),
            ...(value.phone ? { phone: String(value.phone) } : {}),
          };
        })
      : [],
    notes: String(payload.notes ?? ""),
  };
}

/** الطلب كما يُرسل للعميل. السجل (المصدر والتعديلات) للمسؤول فقط: الجلب العام برقم الطلب لا يكشف النص الأصلي. */
export function serialize(row: ObituaryRequestRow, { admin = true }: { admin?: boolean } = {}) {
  return {
    ...normalizePayload(row.payload as RequestPayload),
    id: row.id,
    requestNumber: row.requestNumber,
    status: ["new", "reviewing", "ready", "completed"].includes(row.status) ? row.status : "new",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(admin && row.audit ? { audit: row.audit } : {}),
    ...(admin && row.history ? { history: row.history } : {}),
  };
}

/** رقم الطلب: رقما السنة ثم أربعة أرقام عشوائية («261234»)، مع التأكد من عدم وجود طلب بالرقم نفسه في المخزن. */
async function makeRequestNumber(store: RequestsStore): Promise<string> {
  const year = String(new Date().getFullYear()).slice(-2);
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = `${year}${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
    if (!(await store.getByRequestNumber(candidate))) return candidate;
  }
  throw new Error("Could not allocate a unique request number");
}

/** خطأ من مخزن صارم (التجارب): قواعد Firestore غير منشورة أو لا اتصال؛ يُعاد 503 برسالة واضحة بدل 500. */
export function storeUnavailable(err: unknown): string | null {
  const code = String((err as { code?: string })?.code ?? "");
  if (code === "permission-denied") return "قواعد Firestore لمجموعة التجارب غير منشورة بعد؛ انشرها من Firebase Console ثم أعد المحاولة.";
  if (code === "unavailable" || code === "unauthenticated") return "تعذر الوصول إلى قاعدة البيانات، حاول بعد قليل.";
  return null;
}

/**
 * مسارات الطلبات على مخزن بعينه. الحي يُركَّب على /obituary-requests (الإنشاء والجلب برقم الطلب مفتوحان
 * للجمهور)، والتجارب على /lab/obituary-requests بكل مساراتها للمسؤول فقط (`allPrivate`).
 */
export function makeObituaryRequestsRouter(store: RequestsStore, { allPrivate }: { allPrivate: boolean }): IRouter {
  const router: IRouter = Router();
  const guard = allPrivate ? [requireAdmin] : [];

  /**
   * البحث برقم الطلب مفتوح لغير المسؤول (يحتاجه المستخدم ليحمّل طلبه السابق فيعدّله)، لكن رقم الطلب من ستة
   * أرقام فقط، فيُحدّ عدد المحاولات لكل عنوان حتى لا يمكن تجريب الأرقام كلها لقراءة طلبات الآخرين.
   */
  const publicLookups = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30 });

router.get("/obituary-requests", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await store.list();
  res.json(ListObituaryRequestsResponse.parse(rows.map((row) => serialize(row))));
});

router.post("/obituary-requests", ...guard, async (req, res): Promise<void> => {
  const parsed = CreateObituaryRequestBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid obituary request");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const admin = isAdminRequest(req);
  const { audit: rawAudit, ...input } = parsed.data;
  const audit = sanitizeAudit(rawAudit, { admin });
  const created: HistoryEntry = { at: new Date().toISOString(), channel: audit?.channel ?? (admin ? "admin_edit" : "form"), changes: ["أُنشئ الطلب"] };
  const row = await store.create({
    requestNumber: await makeRequestNumber(store),
    deceasedName: summarizeDeceased(input.deceasedPeople),
    payload: normalizePayload(input as RequestPayload),
    status: "new",
    ...(audit ? { audit } : {}),
    history: [created],
  });
  res.status(201).json(CreateObituaryRequestResponse.parse(serialize(row, { admin })));
});

router.get("/obituary-requests/:requestNumber", ...guard, async (req, res): Promise<void> => {
  if (!isAdminRequest(req)) {
    const lookup = publicLookups.hit(clientKey(req));
    if (!lookup.allowed) {
      res.setHeader("Retry-After", String(lookup.retryAfterSec));
      res.status(429).json({ error: "محاولات بحث كثيرة، حاول بعد قليل." });
      return;
    }
  }
  const params = GetObituaryRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const row = await store.getByRequestNumber(params.data.requestNumber);
  if (!row) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return;
  }
  res.json(GetObituaryRequestResponse.parse(serialize(row, { admin: isAdminRequest(req) })));
});

router.put("/obituary-requests/:requestNumber", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateObituaryRequestParams.safeParse(req.params);
  const parsed = UpdateObituaryRequestBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { status, audit: rawAudit, ...inputPayload } = parsed.data;
  const payload = normalizePayload(inputPayload as RequestPayload);
  const existing = await store.getByRequestNumber(params.data.requestNumber);
  if (!existing) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return;
  }
  // سجل التعديل: ما تغيّر بالعربية، ومن أين (تعديل المسؤول، أو «طلب من نص» بنصه وتحذيراته)
  const audit = sanitizeAudit(rawAudit, { admin: true });
  const changes = diffRequests(normalizePayload(existing.payload as RequestPayload), payload, existing.status, status);
  const entry: HistoryEntry = {
    at: new Date().toISOString(),
    channel: audit?.channel ?? "admin_edit",
    changes: changes.length ? changes : ["حُفظ بلا تغيير"],
    ...(audit?.sourceText ? { sourceText: audit.sourceText } : {}),
    ...(audit?.aiWarnings ? { aiWarnings: audit.aiWarnings } : {}),
  };
  const row = await store.update(params.data.requestNumber, {
    deceasedName: summarizeDeceased(payload.deceasedPeople),
    payload,
    status,
    history: appendHistory(existing.history, entry),
  });
  if (!row) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return;
  }
  res.json(UpdateObituaryRequestResponse.parse(serialize(row)));
});

router.delete("/obituary-requests/:requestNumber", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteObituaryRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const mode = await store.remove(params.data.requestNumber);
    if (!mode) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }
    req.log.info({ requestNumber: params.data.requestNumber, mode }, "Obituary request deleted");
    res.status(204).end();
  } catch (err) {
    req.log.error({ err, requestNumber: params.data.requestNumber }, "Failed to delete obituary request");
    res.status(500).json({ error: storeUnavailable(err) ?? "تعذر حذف الطلب، حاول مرة أخرى." });
  }
});

  // أخطاء المخزن الصارم تصل هنا كرفض وعد (Express 5 يمرر رفض المعالجات غير المتزامنة إلى معالج الأخطاء)
  router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const message = storeUnavailable(err);
    if (message) {
      res.status(503).json({ error: message });
      return;
    }
    next(err);
  });

  return router;
}

/** الطلبات الحية كما كانت. */
const router: IRouter = makeObituaryRequestsRouter(obituaryRequestsDb, { allPrivate: false });

/** طلبات التجارب على مجموعة مستقلة، للمسؤول فقط. */
export const labObituaryRequestsRouter: IRouter = Router();
labObituaryRequestsRouter.use("/lab", makeObituaryRequestsRouter(labRequestsDb, { allPrivate: true }));

export default router;
