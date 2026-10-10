import { initializeApp, getApps, type FirebaseApp } from "@firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  limit,
  query,
  writeBatch,
  type Firestore,
} from "@firebase/firestore";
import firebaseConfig from "../../../firebase-applet-config.json";
import { type ObituaryRequestRow } from "./schema/obituary-requests";

// Initialize Firebase App & Firestore using the provisioned Firestore Database ID
let firestoreDb: Firestore | null = null;
try {
  const app: FirebaseApp = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  console.info("[AI Studio] Cloud Firestore initialized successfully with database:", firebaseConfig.firestoreDatabaseId);
} catch (err) {
  console.warn("[AI Studio] Firebase Firestore initialization error:", err);
}

/** السجل التجريبي للنسخة المحلية فقط (حين لا تتوفر Firestore)؛ لا يُكتب في قاعدة الإنتاج أبداً. */
const SAMPLE_REQUEST: ObituaryRequestRow = {
  id: 1,
  requestNumber: "261001",
  deceasedName: "عبدالله بن ناصر",
  status: "new",
  payload: {
    deceasedPeople: [
      {
        fullName: "عبدالله بن ناصر",
        gender: "man",
        age: 78,
        nationality: "قطري",
        deathPlace: "الدوحة",
        title: "الوالد",
        occupation: "",
        note: "",
      },
    ],
    relatives: [
      {
        relation: "الأبناء",
        familyReference: "",
        people: [
          { name: "ناصر", occupation: "", deceased: false },
          { name: "محمد", occupation: "", deceased: false },
          { name: "سلطان", occupation: "", deceased: false },
        ],
      },
      {
        relation: "الإخوة",
        familyReference: "",
        people: [
          { name: "خليفة", occupation: "", deceased: false },
          { name: "أحمد", occupation: "", deceased: true },
          { name: "سالم", occupation: "", deceased: false },
        ],
      },
    ],
    prayer: {
      enabled: true,
      day: "الأحد 28 سبتمبر 2026",
      time: "بعد صلاة العصر",
      place: "جامع الإمام محمد بن عبدالوهاب",
      mapLink: "https://maps.google.com/?q=Imam+Muhammad+ibn+Abd+al-Wahhab+Mosque+Doha",
    },
    burial: {
      status: "upcoming",
      day: "الأحد 28 سبتمبر 2026",
      time: "بعد صلاة الجنازة مباشرة",
      cemetery: "مقبرة مسيمير",
      mapLink: "https://maps.google.com/?q=Mesaimeer+Cemetery+Doha",
      outsideQatar: false,
      outsideLocation: "",
    },
    condolences: [
      {
        audience: "men",
        location: "مجلس العائلة في منطقة الدفنة",
        mapLink: "https://maps.google.com/?q=Al+Dafna+Zone+66+Doha",
        start: "الأحد 28 سبتمبر 2026",
        durationDays: 3,
        time: "من بعد صلاة العصر حتى صلاة العشاء",
        area: "الدفنة",
        street: "شارع 850",
        houseNumber: "14",
      },
      {
        audience: "women",
        location: "منزل الفقيد في منطقة الدفنة",
        mapLink: "https://maps.google.com/?q=Dafna+Park+Doha",
        start: "الأحد 28 سبتمبر 2026",
        durationDays: 3,
        time: "من الساعة 4:00 عصرًا حتى 8:30 مساءً",
        area: "الدفنة",
        street: "شارع 852",
        houseNumber: "18",
      },
    ],
    condolenceOptions: ["men", "women", "phone"],
    notes: "تقبل التعازي مع مراعاة أوقات الصلاة، نسأل الله له المغفرة والرضوان.",
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

let nextNumericId = 2;

function docDataToRow(data: any, fallbackId: number): ObituaryRequestRow {
  return {
    id: typeof data.id === "number" ? data.id : fallbackId,
    requestNumber: String(data.requestNumber || ""),
    deceasedName: String(data.deceasedName || ""),
    status: String(data.status || "new"),
    payload: (data.payload && typeof data.payload === "object") ? data.payload : {},
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
    ...(data.audit && typeof data.audit === "object" ? { audit: data.audit } : {}),
    ...(Array.isArray(data.history) ? { history: data.history } : {}),
  };
}

/** الحذف الاحتياطي يضع هذه العلامة على المستند بدل حذفه (حين تمنع قواعد قاعدة البيانات الحذف النهائي). */
function isSoftDeleted(data: any): boolean {
  return !!data && typeof data === "object" && !!data.deletedAt;
}

const errorCode = (err: unknown): string => String((err as { code?: string })?.code ?? "");

/** حالة مجموعة في Firestore: تعمل، أو قواعدها غير منشورة (permission-denied)، أو لا اتصال. */
export type StoreProbe = "ok" | "rules-missing" | "offline";

export type RequestsStore = ReturnType<typeof makeRequestsStore>;

/** يفحص إمكانية القراءة من مجموعة بالاسم دون كتابة شيء (لعرض حالة القواعد في مركز التجارب). */
export async function probeCollection(name: string): Promise<StoreProbe> {
  if (!firestoreDb) return "offline";
  try {
    await getDocs(query(collection(firestoreDb, name), limit(1)));
    return "ok";
  } catch (err) {
    return errorCode(err) === "permission-denied" ? "rules-missing" : "offline";
  }
}

/**
 * مخزن طلبات على مجموعة بعينها. الحي (`obituary_requests`) يسقط إلى ذاكرة الخدمة إن تعذر الاتصال
 * حتى لا يتوقف الموقع؛ أما الصارم (`strict`، لطلبات التجارب) فيرمي الخطأ بدل أن يوهم بحفظ يضيع عند
 * إعادة التشغيل — وبه يكتشف المسؤول أن قواعد المجموعة لم تُنشر بعد.
 */
function makeRequestsStore(options: { collection: string; seed?: ObituaryRequestRow[]; strict: boolean }) {
  const collectionName = options.collection;
  const inMemoryRequests: ObituaryRequestRow[] = [...(options.seed ?? [])];
  const useMemory = !firestoreDb || !options.strict;

  function forgetInMemory(requestNumber: string) {
    const idx = inMemoryRequests.findIndex((r) => r.requestNumber === requestNumber);
    if (idx >= 0) inMemoryRequests.splice(idx, 1);
  }

  function remember(row: ObituaryRequestRow) {
    const idx = inMemoryRequests.findIndex((r) => r.requestNumber === row.requestNumber);
    if (idx >= 0) inMemoryRequests[idx] = row;
    else inMemoryRequests.push(row);
  }

  /** في الوضع الصارم يُرمى الخطأ؛ وإلا يُسجَّل ويُستكمل من الذاكرة. */
  function fail(action: string, err: unknown): void {
    if (options.strict) throw err;
    console.warn(`[AI Studio] Firestore ${action} error on ${collectionName}, using cached records:`, err);
  }

  const toDoc = (row: ObituaryRequestRow) => ({
    id: row.id,
    requestNumber: row.requestNumber,
    deceasedName: row.deceasedName,
    status: row.status,
    payload: row.payload,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.audit ? { audit: row.audit } : {}),
    ...(row.history ? { history: row.history } : {}),
  });

  let seedInitialized = false;
  async function ensureSeedData() {
    if (!firestoreDb || seedInitialized || options.strict) return;
    seedInitialized = true;
    try {
      // نسخ ما في Firestore إلى ذاكرة الخدمة (احتياطاً عند انقطاع الاتصال). لا يُكتب سجل تجريبي في قاعدة الإنتاج،
      // وإلا عاد بعد حذفه كلما بدأت نسخة جديدة من الخدمة والقاعدة فارغة.
      const snap = await getDocs(collection(firestoreDb, collectionName));
      snap.forEach((d) => {
        if (!isSoftDeleted(d.data())) remember(docDataToRow(d.data(), nextNumericId++));
      });
    } catch (err) {
      console.warn("[AI Studio] Error syncing with Firestore collection:", err);
    }
  }
  ensureSeedData().catch(() => {});

  return {
    collectionName,

    /** يفحص إمكانية القراءة من المجموعة دون كتابة شيء. */
    probe(): Promise<StoreProbe> {
      return probeCollection(collectionName);
    },

    async list(): Promise<ObituaryRequestRow[]> {
      if (firestoreDb) {
        try {
          const snap = await getDocs(collection(firestoreDb, collectionName));
          // Firestore هو المرجع عند نجاح القراءة، حتى لو كان فارغاً (بعد حذف كل الطلبات مثلاً)
          const list: ObituaryRequestRow[] = [];
          snap.forEach((d) => {
            if (!isSoftDeleted(d.data())) list.push(docDataToRow(d.data(), nextNumericId++));
          });
          list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          return list;
        } catch (err) {
          fail("list", err);
        }
      }
      return [...inMemoryRequests].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async getByRequestNumber(requestNumber: string): Promise<ObituaryRequestRow | null> {
      if (firestoreDb) {
        try {
          const snap = await getDoc(doc(firestoreDb, collectionName, requestNumber));
          if (snap.exists() && !isSoftDeleted(snap.data())) {
            return docDataToRow(snap.data(), nextNumericId++);
          }
          // غير موجود (أو محذوف) في Firestore: لا نعيده من ذاكرة نسخة أخرى قديمة من الخدمة
          forgetInMemory(requestNumber);
          return null;
        } catch (err) {
          fail("get", err);
        }
      }
      const found = inMemoryRequests.find((r) => r.requestNumber === requestNumber);
      return found ? { ...found } : null;
    },

    async create(data: {
      requestNumber: string;
      deceasedName: string;
      payload: Record<string, unknown>;
      status?: string;
      audit?: Record<string, unknown>;
      history?: Array<Record<string, unknown>>;
    }): Promise<ObituaryRequestRow> {
      const newRow: ObituaryRequestRow = {
        id: nextNumericId++,
        requestNumber: data.requestNumber,
        deceasedName: data.deceasedName,
        status: data.status || "new",
        payload: data.payload,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(data.audit ? { audit: data.audit } : {}),
        ...(data.history ? { history: data.history } : {}),
      };

      if (firestoreDb) {
        try {
          await setDoc(doc(firestoreDb, collectionName, newRow.requestNumber), toDoc(newRow));
          console.info(`[AI Studio] Obituary request saved to Firestore (${collectionName}): ${newRow.requestNumber}`);
        } catch (err) {
          if (options.strict) throw err;
          console.error("[AI Studio] Failed to save obituary request to Firestore:", err);
        }
      }
      if (useMemory) inMemoryRequests.unshift(newRow);
      return newRow;
    },

    /** يحفظ صفاً كما هو (الرقم والحالة وتاريخ الإنشاء) — للنسخ من مجموعة إلى أخرى. */
    async putRaw(row: ObituaryRequestRow): Promise<void> {
      if (firestoreDb) {
        try {
          await setDoc(doc(firestoreDb, collectionName, row.requestNumber), toDoc(row));
        } catch (err) {
          fail("put", err);
        }
      }
      if (useMemory) remember({ ...row });
    },

    async update(
      requestNumber: string,
      data: {
        deceasedName?: string;
        status?: string;
        payload?: Record<string, unknown>;
        /** يُستبدل كاملاً؛ يبنيه المسار من القديم + سجل جديد. */
        history?: Array<Record<string, unknown>>;
      }
    ): Promise<ObituaryRequestRow | null> {
      let existing = inMemoryRequests.find((r) => r.requestNumber === requestNumber);
      if (firestoreDb) {
        try {
          const snap = await getDoc(doc(firestoreDb, collectionName, requestNumber));
          if (snap.exists() && !isSoftDeleted(snap.data())) {
            existing = docDataToRow(snap.data(), nextNumericId++);
            if (useMemory) remember(existing);
          } else {
            // محذوف أو غير موجود: لا يُعاد إحياؤه بالتعديل من ذاكرة قديمة
            forgetInMemory(requestNumber);
            return null;
          }
        } catch (err) {
          fail("lookup for update", err);
        }
      }

      if (!existing) {
        return null;
      }

      const updatedRow: ObituaryRequestRow = {
        ...existing,
        deceasedName: data.deceasedName ?? existing.deceasedName,
        status: data.status ?? existing.status,
        payload: data.payload ?? existing.payload,
        updatedAt: new Date(),
        ...(data.history ? { history: data.history } : {}),
      };

      if (firestoreDb) {
        try {
          await setDoc(
            doc(firestoreDb, collectionName, requestNumber),
            {
              id: updatedRow.id,
              requestNumber: updatedRow.requestNumber,
              deceasedName: updatedRow.deceasedName,
              status: updatedRow.status,
              payload: updatedRow.payload,
              updatedAt: updatedRow.updatedAt.toISOString(),
              ...(data.history ? { history: data.history } : {}),
            },
            { merge: true }
          );
          console.info(`[AI Studio] Obituary request updated in Firestore (${collectionName}): ${requestNumber}`);
        } catch (err) {
          if (options.strict) throw err;
          console.error("[AI Studio] Failed to update obituary request in Firestore:", err);
        }
      }
      if (useMemory) remember(updatedRow);
      return updatedRow;
    },

    /**
     * حذف طلب. يعيد "hard" إن حُذف نهائياً، و"soft" إن منعت قواعد قاعدة البيانات الحذف فأُخفي الطلب بعلامة
     * (لا يظهر في أي قائمة أو بحث ولا يمكن تعديله)، و null إن لم يوجد الطلب. يرمي خطأ إن تعذر الحذف والإخفاء معاً.
     */
    async remove(requestNumber: string): Promise<"hard" | "soft" | null> {
      if (!firestoreDb) {
        const existed = inMemoryRequests.some((r) => r.requestNumber === requestNumber);
        forgetInMemory(requestNumber);
        return existed ? "hard" : null;
      }

      const ref = doc(firestoreDb, collectionName, requestNumber);
      let existsRemotely = false;
      try {
        const snap = await getDoc(ref);
        existsRemotely = snap.exists() && !isSoftDeleted(snap.data());
      } catch (err) {
        if (options.strict) throw err;
        console.warn("[AI Studio] Firestore lookup before delete failed:", err);
        existsRemotely = true; // لا نعرف؛ نجرّب الحذف
      }
      if (!existsRemotely) {
        const existed = inMemoryRequests.some((r) => r.requestNumber === requestNumber);
        forgetInMemory(requestNumber);
        return existed ? "hard" : null;
      }

      try {
        await deleteDoc(ref);
        forgetInMemory(requestNumber);
        return "hard";
      } catch (err) {
        console.warn("[AI Studio] Firestore refused to delete; hiding the request instead:", errorCode(err) || err);
      }
      // القواعد تمنع الحذف النهائي: نخفي الطلب بعلامة (التعديل مسموح بالقواعد نفسها)
      await setDoc(ref, { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
      forgetInMemory(requestNumber);
      return "soft";
    },

    /** يحذف كل مستندات المجموعة (حتى المخفية) على دفعات؛ للتفريغ في التجارب. يعيد عدد المحذوف. */
    async removeAll(): Promise<number> {
      let removed = 0;
      if (firestoreDb) {
        try {
          const snap = await getDocs(collection(firestoreDb, collectionName));
          const refs = snap.docs.map((d) => d.ref);
          for (let i = 0; i < refs.length; i += 400) {
            const batch = writeBatch(firestoreDb);
            refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
            await batch.commit();
          }
          removed = refs.length;
        } catch (err) {
          fail("removeAll", err);
        }
      }
      removed = Math.max(removed, inMemoryRequests.length);
      inMemoryRequests.splice(0, inMemoryRequests.length);
      return removed;
    },
  };
}

/** الطلبات الحية: تُعرض للجمهور، وتسقط إلى ذاكرة الخدمة إن انقطع الاتصال. */
export const obituaryRequestsDb = makeRequestsStore({ collection: "obituary_requests", seed: [SAMPLE_REQUEST], strict: false });

/** طلبات التجارب (`/admin/lab/admin`): مجموعة مستقلة، وأي خطأ من Firestore يُرفع للمسؤول بدل أن يُخفى. */
export const labRequestsDb = makeRequestsStore({ collection: "lab_requests", strict: true });

/**
 * إعدادات هوية صورة التعزية (الشعار واسم الحساب…). تُحفظ في مجموعة «condolence_templates» لأن قواعد Firestore
 * المنشورة تسمح بالكتابة فيها (مستند بمعرّف صالح)، ولا تسمح بمجموعة جديدة. وإن لم يوجد المستند الجديد تُقرأ
 * «branding» المحفوظة قديماً في مستند قالب النسخ حتى لا يضيع شعار رُفع قبل حذف محرر القوالب.
 */
const POSTER_SETTINGS_COLLECTION = "condolence_templates";
const POSTER_SETTINGS_ID = "poster-settings";
const LEGACY_TEMPLATE_ID = "naskh";
let inMemoryPosterSettings: Record<string, unknown> | null = null;

export const posterSettingsDb = {
  /** الإعدادات المخزّنة كما هي (تُنظَّف في الخادم)، أو null إن لم يُحفظ شيء بعد. */
  async get(): Promise<Record<string, unknown> | null> {
    if (firestoreDb) {
      try {
        const current = await getDoc(doc(firestoreDb, POSTER_SETTINGS_COLLECTION, POSTER_SETTINGS_ID));
        if (current.exists()) return current.data() as Record<string, unknown>;
        const legacy = await getDoc(doc(firestoreDb, POSTER_SETTINGS_COLLECTION, LEGACY_TEMPLATE_ID));
        const branding = legacy.exists() ? (legacy.data() as { branding?: unknown }).branding : undefined;
        if (branding && typeof branding === "object") return branding as Record<string, unknown>;
        return inMemoryPosterSettings;
      } catch (err) {
        console.warn("[AI Studio] Firestore poster settings read failed, using memory:", err);
      }
    }
    return inMemoryPosterSettings;
  },

  /** يحفظ الإعدادات. يرمي خطأ إن فشلت الكتابة في Firestore، حتى لا يظن المسؤول أن الشعار حُفظ وهو لم يُحفظ. */
  async save(settings: Record<string, unknown>): Promise<void> {
    if (firestoreDb) {
      await setDoc(doc(firestoreDb, POSTER_SETTINGS_COLLECTION, POSTER_SETTINGS_ID), { ...settings, updatedAt: new Date().toISOString() });
    }
    inMemoryPosterSettings = { ...settings };
  },
};

export { firestoreDb };
export * from "./schema";
