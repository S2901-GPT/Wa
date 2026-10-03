import { initializeApp, getApps, type FirebaseApp } from "@firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
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
    requestNumber: "QTR-20260927-1001",
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

let seedInitialized = false;
async function ensureSeedData() {
  if (!firestoreDb || seedInitialized) return;
  seedInitialized = true;
  try {
    const colRef = collection(firestoreDb, "obituary_requests");
    const snap = await getDocs(colRef);
    if (snap.empty) {
      for (const item of inMemoryRequests) {
        await setDoc(doc(firestoreDb, "obituary_requests", item.requestNumber), {
          id: item.id,
          requestNumber: item.requestNumber,
          deceasedName: item.deceasedName,
          status: item.status,
          payload: item.payload,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        });
      }
      console.info("[AI Studio] Seeded initial request to Cloud Firestore");
    } else {
      // Sync from Firestore into memory cache
      snap.forEach((d) => {
        const row = docDataToRow(d.data(), nextNumericId++);
        const idx = inMemoryRequests.findIndex((r) => r.requestNumber === row.requestNumber);
        if (idx >= 0) {
          inMemoryRequests[idx] = row;
        } else {
          inMemoryRequests.push(row);
        }
      });
    }
  } catch (err) {
    console.warn("[AI Studio] Error syncing with Firestore collection:", err);
  }
}

// Start initial sync in background
ensureSeedData().catch(() => {});

export const obituaryRequestsDb = {
  async list(): Promise<ObituaryRequestRow[]> {
    if (firestoreDb) {
      try {
        const colRef = collection(firestoreDb, "obituary_requests");
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          const list: ObituaryRequestRow[] = [];
          snap.forEach((d) => {
            list.push(docDataToRow(d.data(), nextNumericId++));
          });
          list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          return list;
        }
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
        if (snap.exists()) {
          return docDataToRow(snap.data(), nextNumericId++);
        }
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
    if (!existing && firestoreDb) {
      try {
        const snap = await getDoc(doc(firestoreDb, "obituary_requests", requestNumber));
        if (snap.exists()) {
          existing = docDataToRow(snap.data(), nextNumericId++);
          inMemoryRequests.push(existing);
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
};

export { firestoreDb };
export * from "./schema";
