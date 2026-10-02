import { Router, type IRouter } from "express";
import {
  CreateObituaryRequestBody,
  CreateObituaryRequestResponse,
  GetObituaryRequestParams,
  GetObituaryRequestResponse,
  ListObituaryRequestsResponse,
  UpdateObituaryRequestBody,
  UpdateObituaryRequestParams,
  UpdateObituaryRequestResponse,
} from "@workspace/api-zod";
import { obituaryRequestsDb, type ObituaryRequestRow } from "@workspace/db";

const router: IRouter = Router();
type RequestPayload = Record<string, unknown>;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
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
    return {
      relation: String(relativeGroup.relation ?? ""),
      familyReference: String(relativeGroup.familyReference ?? ""),
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

function normalizePayload(payload: RequestPayload) {
  const oldGender = payload.gender === "female" ? "woman" : "man";
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
    ? payload.condolenceOptions.filter((option): option is "phone" | "men" | "women" =>
        option === "phone" || option === "men" || option === "women")
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

  return {
    deceasedPeople,
    relatives: normalizeRelatives(payload.relatives),
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

function makeRequestNumber() {
  const date = new Date();
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  return `QTR-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}

router.get("/obituary-requests", async (_req, res): Promise<void> => {
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
    requestNumber: makeRequestNumber(),
    deceasedName: parsed.data.deceasedPeople[0]?.fullName ?? "",
    payload: normalizePayload(parsed.data as RequestPayload),
    status: "new",
  });
  res.status(201).json(CreateObituaryRequestResponse.parse(serialize(row)));
});

router.get("/obituary-requests/:requestNumber", async (req, res): Promise<void> => {
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

router.put("/obituary-requests/:requestNumber", async (req, res): Promise<void> => {
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
    deceasedName: payload.deceasedPeople[0]?.fullName ?? "",
    payload,
    status,
  });
  if (!row) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return;
  }
  res.json(UpdateObituaryRequestResponse.parse(serialize(row)));
});

export default router;
