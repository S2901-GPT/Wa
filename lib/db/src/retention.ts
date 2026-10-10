// الاحتفاظ بالبيانات: كل طلب يُحذف محتواه بعد مدة الاحتفاظ (48 ساعة افتراضاً) ولا يبقى منه إلا إحصاء تقني
// بلا أسماء ولا نصوص: القناة، وعدد التعديلات، وأسماء الحقول التي تغيّرت (لا قيمها)، وتحذيرات الذكاء الاصطناعي.
// هذا الملف لا يستورد Firebase حتى يمكن اختباره وحده.

export const DEFAULT_RETENTION_HOURS = 48;

/** مدة الاحتفاظ بالساعات من `RETENTION_HOURS` (للاختبار) وإلا 48. */
export function retentionHours(env: Record<string, string | undefined> = process.env): number {
  const value = Number(env.RETENTION_HOURS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_RETENTION_HOURS;
}

export type ExpiredHistoryEntry = { at: string; channel: string; fields: string[] };
export type ExpiredRequestStat = {
  requestNumber: string;
  status: string;
  createdAt: string;
  expiredAt: string;
  channel?: string;
  inferred?: boolean;
  model?: string;
  aiWarnings?: string[];
  edits: number;
  history: ExpiredHistoryEntry[];
};

type Loose = Record<string, unknown>;
const isObject = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * اسم الحقل فقط من سطر تغيير مثل «مقر عزاء النساء: منزل الفقيد ← منزل أم محمد» → «مقر عزاء النساء».
 * الأسطر التي بلا قيمة («أُنشئ الطلب»، «حُذف عزاء النساء») تبقى كما هي.
 */
export function changeField(line: string): string {
  return line.split(/[:←]/u)[0]!.replace(/\s+/gu, " ").trim();
}

/** الإحصاء الباقي من طلب بعد انتهاء مدة الاحتفاظ. لا يحمل أي اسم أو نص. */
export function anonymizeRequest(doc: Loose, expiredAt: Date): ExpiredRequestStat {
  const audit = isObject(doc.audit) ? doc.audit : {};
  const history = Array.isArray(doc.history) ? doc.history.filter(isObject) : [];
  const warnings = Array.isArray(audit.aiWarnings) ? audit.aiWarnings.filter((w): w is string => typeof w === "string") : [];
  const channel = str(audit.channel) || str(history[0]?.channel);
  return {
    requestNumber: str(doc.requestNumber),
    status: str(doc.status) || "new",
    createdAt: str(doc.createdAt) || expiredAt.toISOString(),
    expiredAt: expiredAt.toISOString(),
    ...(channel ? { channel } : {}),
    ...(audit.inferred === true ? { inferred: true } : {}),
    ...(str(audit.model) ? { model: str(audit.model) } : {}),
    ...(warnings.length ? { aiWarnings: warnings } : {}),
    edits: Math.max(0, history.length - 1),
    history: history.map((entry) => ({
      at: str(entry.at),
      channel: str(entry.channel),
      fields: (Array.isArray(entry.changes) ? entry.changes : []).filter((c): c is string => typeof c === "string").map(changeField),
    })),
  };
}

/** مستند Firestore للطلب المجهَّل: يحقق قواعد المجموعة (الرقم والاسم والحالة وخريطة) بلا أي بيانات. */
export function expiredDoc(stat: ExpiredRequestStat, id: number): Loose {
  return {
    id,
    requestNumber: stat.requestNumber,
    deceasedName: "",
    status: stat.status,
    payload: {},
    createdAt: stat.createdAt,
    updatedAt: stat.expiredAt,
    expiredAt: stat.expiredAt,
    stat,
  };
}

/** هل انتهت مدة الاحتفاظ بطلب أُنشئ في `createdAt`؟ */
export function isExpired(createdAt: Date, now: Date, hours: number): boolean {
  return now.getTime() - createdAt.getTime() >= hours * 3600 * 1000;
}

/** يقرأ الإحصاء من مستند مجهَّل (أو null إن لم يكن كذلك). */
export function readExpired(doc: unknown): ExpiredRequestStat | null {
  if (!isObject(doc) || !str(doc.expiredAt) || !isObject(doc.stat)) return null;
  const stat = doc.stat;
  return {
    requestNumber: str(stat.requestNumber) || str(doc.requestNumber),
    status: str(stat.status) || "new",
    createdAt: str(stat.createdAt),
    expiredAt: str(stat.expiredAt) || str(doc.expiredAt),
    ...(str(stat.channel) ? { channel: str(stat.channel) } : {}),
    ...(stat.inferred === true ? { inferred: true } : {}),
    ...(str(stat.model) ? { model: str(stat.model) } : {}),
    ...(Array.isArray(stat.aiWarnings) ? { aiWarnings: stat.aiWarnings.filter((w): w is string => typeof w === "string") } : {}),
    edits: typeof stat.edits === "number" ? stat.edits : 0,
    history: (Array.isArray(stat.history) ? stat.history.filter(isObject) : []).map((entry) => ({
      at: str(entry.at),
      channel: str(entry.channel),
      fields: (Array.isArray(entry.fields) ? entry.fields : []).filter((f): f is string => typeof f === "string"),
    })),
  };
}
