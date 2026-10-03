import { Router, type IRouter } from "express";
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
import { obituaryRequestsDb, type ObituaryRequestRow } from "@workspace/db";
import { clientKey, createRateLimiter, isAdminRequest, requireAdmin } from "../lib/admin-auth";

const router: IRouter = Router();
type RequestPayload = Record<string, unknown>;

/**
 * البحث برقم الطلب مفتوح لغير المسؤول (يحتاجه المستخدم ليحمّل طلبه السابق فيعدّله)، لكن رقم الطلب من ستة
 * أرقام فقط، فيُحدّ عدد المحاولات لكل عنوان حتى لا يمكن تجريب الأرقام كلها لقراءة طلبات الآخرين.
 */
const publicLookups = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30 });

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

function serialize(row: ObituaryRequestRow) {
  return {
    ...normalizePayload(row.payload as RequestPayload),
    id: row.id,
    requestNumber: row.requestNumber,
    status: ["new", "reviewing", "ready", "completed"].includes(row.status) ? row.status : "new",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** رقم الطلب: رقما السنة ثم أربعة أرقام عشوائية («261234»)، مع التأكد من عدم وجود طلب بالرقم نفسه. */
async function makeRequestNumber(): Promise<string> {
  const year = String(new Date().getFullYear()).slice(-2);
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = `${year}${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
    if (!(await obituaryRequestsDb.getByRequestNumber(candidate))) return candidate;
  }
  throw new Error("Could not allocate a unique request number");
}

router.get("/obituary-requests", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await obituaryRequestsDb.list();
  res.json(ListObituaryRequestsResponse.parse(rows.map(serialize)));
});

router.post("/obituary-requests", async (req, res): Promise<void> => {
  const parsed = CreateObituaryRequestBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid obituary request");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const row = await obituaryRequestsDb.create({
    requestNumber: await makeRequestNumber(),
    deceasedName: summarizeDeceased(parsed.data.deceasedPeople),
    payload: normalizePayload(parsed.data as RequestPayload),
    status: "new",
  });
  res.status(201).json(CreateObituaryRequestResponse.parse(serialize(row)));
});

router.get("/obituary-requests/:requestNumber", async (req, res): Promise<void> => {
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
  const row = await obituaryRequestsDb.getByRequestNumber(params.data.requestNumber);
  if (!row) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return;
  }
  res.json(GetObituaryRequestResponse.parse(serialize(row)));
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
  const { status, ...inputPayload } = parsed.data;
  const payload = normalizePayload(inputPayload as RequestPayload);
  const row = await obituaryRequestsDb.update(params.data.requestNumber, {
    deceasedName: summarizeDeceased(payload.deceasedPeople),
    payload,
    status,
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
    const mode = await obituaryRequestsDb.remove(params.data.requestNumber);
    if (!mode) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }
    req.log.info({ requestNumber: params.data.requestNumber, mode }, "Obituary request deleted");
    res.status(204).end();
  } catch (err) {
    req.log.error({ err, requestNumber: params.data.requestNumber }, "Failed to delete obituary request");
    res.status(500).json({ error: "تعذر حذف الطلب، حاول مرة أخرى." });
  }
});

export default router;
