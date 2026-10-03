import { initializeApp, getApps, type FirebaseApp } from "@firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
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

// In-memory cache & fallback store
const inMemoryRequests: ObituaryRequestRow[] = [
  {
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
      condolencePhoneContacts: [
        { name: "محمد (ابنه)", phone: "+974 5512 3456" },
        { name: "خليفة (شقيقه)", phone: "+974 6623 4567" },
      ],
      notes: "تقبل التعازي مع مراعاة أوقات الصلاة، نسأل الله له المغفرة والرضوان.",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

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
  };
}

/** الحذف الاحتياطي يضع هذه العلامة على المستند بدل حذفه (حين تمنع قواعد قاعدة البيانات الحذف النهائي). */
function isSoftDeleted(data: any): boolean {
  return !!data && typeof data === "object" && !!data.deletedAt;
}

let seedInitialized = false;
async function ensureSeedData() {
  if (!firestoreDb || seedInitialized) return;
  seedInitialized = true;
  try {
    // نسخ ما في Firestore إلى ذاكرة الخدمة (احتياطاً عند انقطاع الاتصال). لا يُكتب سجل تجريبي في قاعدة الإنتاج،
    // وإلا عاد بعد حذفه كلما بدأت نسخة جديدة من الخدمة والقاعدة فارغة.
    const snap = await getDocs(collection(firestoreDb, "obituary_requests"));
    snap.forEach((d) => {
      if (isSoftDeleted(d.data())) return;
      const row = docDataToRow(d.data(), nextNumericId++);
      const idx = inMemoryRequests.findIndex((r) => r.requestNumber === row.requestNumber);
      if (idx >= 0) {
        inMemoryRequests[idx] = row;
      } else {
        inMemoryRequests.push(row);
      }
    });
  } catch (err) {
    console.warn("[AI Studio] Error syncing with Firestore collection:", err);
  }
}

function forgetInMemory(requestNumber: string) {
  const idx = inMemoryRequests.findIndex((r) => r.requestNumber === requestNumber);
  if (idx >= 0) inMemoryRequests.splice(idx, 1);
}

// Start initial sync in background
ensureSeedData().catch(() => {});

export const obituaryRequestsDb = {
  async list(): Promise<ObituaryRequestRow[]> {
    if (firestoreDb) {
      try {
        const colRef = collection(firestoreDb, "obituary_requests");
        const snap = await getDocs(colRef);
        // Firestore هو المرجع عند نجاح القراءة، حتى لو كان فارغاً (بعد حذف كل الطلبات مثلاً)
        const list: ObituaryRequestRow[] = [];
        snap.forEach((d) => {
          if (!isSoftDeleted(d.data())) list.push(docDataToRow(d.data(), nextNumericId++));
        });
        list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return list;
      } catch (err) {
        console.warn("[AI Studio] Firestore list error, using cached records:", err);
      }
    }
    return [...inMemoryRequests].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async getByRequestNumber(requestNumber: string): Promise<ObituaryRequestRow | null> {
    if (firestoreDb) {
      try {
        const docRef = doc(firestoreDb, "obituary_requests", requestNumber);
        const snap = await getDoc(docRef);
        if (snap.exists() && !isSoftDeleted(snap.data())) {
          return docDataToRow(snap.data(), nextNumericId++);
        }
        // غير موجود (أو محذوف) في Firestore: لا نعيده من ذاكرة نسخة أخرى قديمة من الخدمة
        forgetInMemory(requestNumber);
        return null;
      } catch (err) {
        console.warn("[AI Studio] Firestore get error, checking memory cache:", err);
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
  }): Promise<ObituaryRequestRow> {
    const newRow: ObituaryRequestRow = {
      id: nextNumericId++,
      requestNumber: data.requestNumber,
      deceasedName: data.deceasedName,
      status: data.status || "new",
      payload: data.payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    inMemoryRequests.unshift(newRow);

    if (firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, "obituary_requests", newRow.requestNumber), {
          id: newRow.id,
          requestNumber: newRow.requestNumber,
          deceasedName: newRow.deceasedName,
          status: newRow.status,
          payload: newRow.payload,
          createdAt: newRow.createdAt.toISOString(),
          updatedAt: newRow.updatedAt.toISOString(),
        });
        console.info(`[AI Studio] Obituary request saved to Firestore: ${newRow.requestNumber}`);
      } catch (err) {
        console.error("[AI Studio] Failed to save obituary request to Firestore:", err);
      }
    }

    return newRow;
  },

  async update(
    requestNumber: string,
    data: {
      deceasedName?: string;
      status?: string;
      payload?: Record<string, unknown>;
    }
  ): Promise<ObituaryRequestRow | null> {
    let existing = inMemoryRequests.find((r) => r.requestNumber === requestNumber);
    if (firestoreDb) {
      try {
        const snap = await getDoc(doc(firestoreDb, "obituary_requests", requestNumber));
        if (snap.exists() && !isSoftDeleted(snap.data())) {
          existing = docDataToRow(snap.data(), nextNumericId++);
          const cached = inMemoryRequests.findIndex((r) => r.requestNumber === requestNumber);
          if (cached >= 0) inMemoryRequests[cached] = existing;
          else inMemoryRequests.push(existing);
        } else {
          // محذوف أو غير موجود: لا يُعاد إحياؤه بالتعديل من ذاكرة قديمة
          forgetInMemory(requestNumber);
          return null;
        }
      } catch (err) {
        console.warn("[AI Studio] Firestore lookup for update failed:", err);
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
    };

    const idx = inMemoryRequests.findIndex((r) => r.requestNumber === requestNumber);
    if (idx >= 0) {
      inMemoryRequests[idx] = updatedRow;
    }

    if (firestoreDb) {
      try {
        await setDoc(
          doc(firestoreDb, "obituary_requests", requestNumber),
          {
            id: updatedRow.id,
            requestNumber: updatedRow.requestNumber,
            deceasedName: updatedRow.deceasedName,
            status: updatedRow.status,
            payload: updatedRow.payload,
            updatedAt: updatedRow.updatedAt.toISOString(),
          },
          { merge: true }
        );
        console.info(`[AI Studio] Obituary request updated in Firestore: ${requestNumber}`);
      } catch (err) {
        console.error("[AI Studio] Failed to update obituary request in Firestore:", err);
      }
    }

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

    const ref = doc(firestoreDb, "obituary_requests", requestNumber);
    let existsRemotely = false;
    try {
      const snap = await getDoc(ref);
      existsRemotely = snap.exists() && !isSoftDeleted(snap.data());
    } catch (err) {
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
      console.warn("[AI Studio] Firestore refused to delete; hiding the request instead:", (err as { code?: string })?.code ?? err);
    }
    // القواعد تمنع الحذف النهائي: نخفي الطلب بعلامة (التعديل مسموح بالقواعد نفسها)
    await setDoc(ref, { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
    forgetInMemory(requestNumber);
    return "soft";
  },
};

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
