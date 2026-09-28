import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { obituaryRequestsTable, type ObituaryRequestRow } from "./schema/obituary-requests";

const { Pool } = pg;

// In-memory mock store for when Postgres/Cloud SQL is not connected
const inMemoryObituaryRequests: ObituaryRequestRow[] = [
  {
    id: 1,
    requestNumber: "QTR-20260927-1001",
    deceasedName: "عبدالله بن خالد آل ثاني",
    status: "new",
    payload: {
      deceasedPeople: [
        {
          fullName: "عبدالله بن خالد آل ثاني",
          gender: "man",
          age: 72,
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
            { name: "خالد", occupation: "", deceased: false },
            { name: "محمد", occupation: "", deceased: false },
          ],
        },
      ],
      prayer: {
        enabled: true,
        day: "الأحد",
        time: "بعد صلاة العصر",
        place: "جامع الإمام محمد بن عبدالوهاب",
        mapLink: "",
      },
      burial: {
        status: "upcoming",
        day: "الأحد",
        time: "بعد صلاة العصر",
        cemetery: "مقبرة مسيمير",
        mapLink: "",
        outsideQatar: false,
        outsideLocation: "",
      },
      condolences: [
        {
          audience: "men",
          location: "مجلس الوالد في الدفنة",
          mapLink: "",
          start: "",
          durationDays: 3,
          time: "بعد صلاة العصر إلى صلاة العشاء",
        },
      ],
      condolenceOptions: ["men", "phone"],
      condolencePhoneContacts: [
        { name: "خالد", phone: "55551234" },
      ],
      notes: "إنا لله وإنا إليه راجعون",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

let nextId = 2;

function extractRequestNumberFromWhere(clause: any): string | null {
  if (!clause) return null;
  if (typeof clause === "string") return clause;
  if (clause.value !== undefined) return String(clause.value);
  if (clause.right !== undefined) {
    if (typeof clause.right === "object" && clause.right !== null && clause.right.value !== undefined) {
      return String(clause.right.value);
    }
    return String(clause.right);
  }
  try {
    const str = JSON.stringify(clause);
    const match = str.match(/QTR-[A-Za-z0-9_-]+/);
    if (match) return match[0];
  } catch {
    // ignore serialization failure
  }
  return null;
}

const mockDb = {
  select: (_fields?: any) => ({
    from: (_table: any) => {
      const getRows = () => [...inMemoryObituaryRequests];
      return {
        orderBy: (_orderCol?: any) => {
          const rows = getRows().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          return Promise.resolve(rows);
        },
        where: (clause: any) => {
          const reqNum = extractRequestNumberFromWhere(clause);
          const found = reqNum
            ? inMemoryObituaryRequests.filter((r) => r.requestNumber === reqNum)
            : [...inMemoryObituaryRequests];
          return Promise.resolve(found);
        },
        then: (resolve: any, reject: any) => {
          return Promise.resolve(getRows()).then(resolve, reject);
        },
      };
    },
  }),
  insert: (_table: any) => ({
    values: (data: any) => ({
      returning: async () => {
        const newRow: ObituaryRequestRow = {
          id: nextId++,
          requestNumber: data.requestNumber || `QTR-${Date.now()}`,
          deceasedName: data.deceasedName || "",
          status: data.status || "new",
          payload: data.payload || {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        inMemoryObituaryRequests.unshift(newRow);
        return [newRow];
      },
    }),
  }),
  update: (_table: any) => ({
    set: (data: any) => ({
      where: (clause: any) => ({
        returning: async () => {
          const reqNum = extractRequestNumberFromWhere(clause);
          const index = inMemoryObituaryRequests.findIndex((r) => r.requestNumber === reqNum);
          if (index === -1) return [];
          const existing = inMemoryObituaryRequests[index];
          const updated: ObituaryRequestRow = {
            ...existing,
            ...data,
            payload: data.payload ?? existing.payload,
            deceasedName: data.deceasedName ?? existing.deceasedName,
            status: data.status ?? existing.status,
            updatedAt: data.updatedAt ?? new Date(),
          };
          inMemoryObituaryRequests[index] = updated;
          return [updated];
        },
      }),
    }),
  }),
};

let pool: any = null;
let db: any = mockDb;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const realDb = drizzle(pool, { schema });
    db = new Proxy(realDb, {
      get(target, prop, receiver) {
        const original = Reflect.get(target, prop, receiver);
        if (typeof original === "function") {
          return function (...args: any[]) {
            try {
              return original.apply(target, args);
            } catch (e) {
              console.warn("[AI Studio] Database query failed, falling back to mock store:", e);
              return (mockDb as any)[prop]?.(...args);
            }
          };
        }
        return original;
      },
    });
  } catch (err) {
    console.warn("[AI Studio] Failed to initialize Postgres connection, using mock database:", err);
    db = mockDb;
  }
} else {
  console.info("[AI Studio] DATABASE_URL not set — using in-memory mock store.");
}

export { pool, db };
export * from "./schema";
