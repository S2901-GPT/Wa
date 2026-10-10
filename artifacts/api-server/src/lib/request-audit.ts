// سجل سلوك الطلب: من أين جاء (نموذج الجمهور، طلب من نص، تعديل المسؤول) وما تغيّر في كل تعديل.
// كل ما هنا للمسؤول فقط؛ الجمهور لا يستطيع أن يدّعي قناة غير «form» ولا يرى السجل.

type Loose = Record<string, unknown>;
export type AuditChannel = "form" | "from_text" | "admin_edit";
export type Audit = {
  channel: AuditChannel;
  sourceText?: string;
  aiWarnings?: string[];
  aiReply?: string;
  model?: string;
};

/** رقم هاتف قطري (٨ أرقام تبدأ بـ٣ أو ٥ أو ٦ أو ٧، مع أو بلا +974) أو دولي؛ يُستبدل حتى لا يُحفظ رقم مع الطلب. */
const PHONE_RE = /(?:\+?\s?974[\s-]?)?(?<![\d٠-٩])[3567]\d{3}[\s-]?\d{4}(?![\d٠-٩])|\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/gu;
export const PHONE_MASK = "[رقم محذوف]";
export function maskPhones(value: string): string {
  return value.replace(PHONE_RE, PHONE_MASK);
}
export type HistoryEntry = { at: string; channel: AuditChannel; changes: string[]; sourceText?: string; aiWarnings?: string[] };

const isObject = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 8000): string => (typeof value === "string" ? value.trim().slice(0, max) : "");
const CHANNELS: readonly AuditChannel[] = ["form", "from_text", "admin_edit"];

/**
 * ينظّف ما أرسله العميل. غير المسؤول قناته «form» دائماً ولا يُقبل منه أي شيء آخر (لا جهاز ولا تعريف).
 * نص المسؤول وردّ النموذج يُحفظان بعد طمس أرقام الهواتف.
 */
export function sanitizeAudit(input: unknown, { admin }: { admin: boolean }): Audit | undefined {
  if (!admin) return { channel: "form" };
  if (!isObject(input)) return undefined;
  const out: Audit = { channel: CHANNELS.includes(input.channel as AuditChannel) ? (input.channel as AuditChannel) : "admin_edit" };
  const sourceText = maskPhones(text(input.sourceText, 8000));
  if (sourceText) out.sourceText = sourceText;
  const aiReply = maskPhones(text(input.aiReply, 8192));
  if (aiReply) out.aiReply = aiReply;
  const model = text(input.model, 60);
  if (model) out.model = model;
  if (Array.isArray(input.aiWarnings)) {
    const warnings = input.aiWarnings.map((warning) => text(warning, 500)).filter(Boolean).slice(0, 20);
    if (warnings.length) out.aiWarnings = warnings;
  }
  return out;
}

/** يضيف سجلاً ويحتفظ بآخر `max` (حجم المستند في Firestore محدود). */
export function appendHistory(history: unknown, entry: HistoryEntry, max = 50): HistoryEntry[] {
  const previous = Array.isArray(history) ? history.filter(isObject) as HistoryEntry[] : [];
  return [...previous, entry].slice(-max);
}

// ───────────────────────── الفروق بالعربية ─────────────────────────

const STATUS_LABELS: Record<string, string> = { new: "جديد", reviewing: "قيد المراجعة", ready: "جاهز", completed: "مكتمل" };
const AUDIENCE: Record<string, string> = { men: "الرجال", women: "النساء" };
const BURIAL_STATUS: Record<string, string> = { upcoming: "قادم", completed: "تم", postponed: "مؤجل" };
const MESSAGE_TYPES: Record<string, string> = { announcement: "إعلان", postponement: "تأجيل دفن", amendment: "تعديل", condolence_cancellation: "إلغاء عزاء" };

const show = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  return String(value).replace(/\s+/gu, " ").trim() || "—";
};

function field(changes: string[], label: string, before: unknown, after: unknown, names?: Record<string, string>) {
  const a = show(names && typeof before === "string" ? names[before] ?? before : before);
  const b = show(names && typeof after === "string" ? names[after] ?? after : after);
  if (a !== b) changes.push(`${label}: ${a} ← ${b}`);
}

const list = (value: unknown): Loose[] => (Array.isArray(value) ? value.filter(isObject) : []);
const peopleNames = (group: Loose): string[] => list(group.people).map((person) => text(person.name)).filter(Boolean);

/** اسم مقر العزاء للعرض: عزاء الرجال، عزاء النساء ٢… */
function venueLabels(cards: Loose[]): string[] {
  const seen: Record<string, number> = {};
  return cards.map((card) => {
    const audience = String(card.audience ?? "");
    seen[audience] = (seen[audience] ?? 0) + 1;
    const base = `عزاء ${AUDIENCE[audience] ?? audience}`;
    return seen[audience] > 1 ? `${base} ${seen[audience]}` : base;
  });
}

/**
 * أسطر عربية بما تغيّر بين نسختين من الطلب (بعد التطبيع)، مثل:
 * «مقر عزاء النساء: منزل الفقيد بالناصرية ← منزل أم محمد بمنطقة الفروش».
 */
export function diffRequests(before: Loose, after: Loose, statusBefore?: string, statusAfter?: string): string[] {
  const changes: string[] = [];
  if (statusAfter !== undefined) field(changes, "الحالة", statusBefore, statusAfter, STATUS_LABELS);
  field(changes, "نوع الرسالة", before.messageType ?? "announcement", after.messageType ?? "announcement", MESSAGE_TYPES);

  const oldPeople = list(before.deceasedPeople);
  const newPeople = list(after.deceasedPeople);
  for (let i = 0; i < Math.max(oldPeople.length, newPeople.length); i += 1) {
    const label = Math.max(oldPeople.length, newPeople.length) > 1 ? `المتوفى ${i + 1}` : "المتوفى";
    const a = oldPeople[i];
    const b = newPeople[i];
    if (!a) { changes.push(`أُضيف ${label}: ${show(b?.fullName ?? b?.kunya)}`); continue; }
    if (!b) { changes.push(`حُذف ${label}: ${show(a.fullName ?? a.kunya)}`); continue; }
    field(changes, `اسم ${label}`, a.fullName, b.fullName);
    field(changes, `لقب ${label}`, a.title, b.title);
    field(changes, `كنية ${label}`, a.kunya, b.kunya);
    field(changes, `عمر ${label}`, a.age, b.age);
    field(changes, `زوج/ة ${label}`, isObject(a.spouse) ? a.spouse.name : undefined, isObject(b.spouse) ? b.spouse.name : undefined);
  }

  // الأقارب: بالمجموعة (صلة القرابة)، ثم الأسماء المضافة والمحذوفة
  const groupKey = (group: Loose) => text(group.relation) || text(group.relationKey);
  const oldGroups = new Map(list(before.relatives).map((group) => [groupKey(group), peopleNames(group)]));
  const newGroups = new Map(list(after.relatives).map((group) => [groupKey(group), peopleNames(group)]));
  for (const [key, names] of newGroups) {
    const previous = oldGroups.get(key);
    if (!previous) { changes.push(`أُضيفت مجموعة أقارب «${key}»: ${names.join("، ")}`); continue; }
    const added = names.filter((name) => !previous.includes(name));
    const removed = previous.filter((name) => !names.includes(name));
    if (added.length) changes.push(`أُضيف إلى «${key}»: ${added.join("، ")}`);
    if (removed.length) changes.push(`حُذف من «${key}»: ${removed.join("، ")}`);
  }
  for (const key of oldGroups.keys()) if (!newGroups.has(key)) changes.push(`حُذفت مجموعة أقارب «${key}»`);

  const oldBurial = isObject(before.burial) ? before.burial : {};
  const newBurial = isObject(after.burial) ? after.burial : {};
  field(changes, "حالة الدفن", oldBurial.status, newBurial.status, BURIAL_STATUS);
  field(changes, "يوم الدفن", oldBurial.day, newBurial.day);
  field(changes, "يوم الأسبوع للدفن", oldBurial.weekday, newBurial.weekday);
  field(changes, "وقت الدفن", oldBurial.time, newBurial.time);
  field(changes, "المقبرة", oldBurial.cemetery, newBurial.cemetery);
  field(changes, "ملاحظة الدفن", oldBurial.note, newBurial.note);
  field(changes, "الدفن خارج قطر", oldBurial.outsideLocation, newBurial.outsideLocation);

  const oldPrayer = isObject(before.prayer) ? before.prayer : {};
  const newPrayer = isObject(after.prayer) ? after.prayer : {};
  field(changes, "صلاة منفصلة", oldPrayer.enabled === true, newPrayer.enabled === true);
  field(changes, "مكان الصلاة", oldPrayer.place ?? oldPrayer.mosque, newPrayer.place ?? newPrayer.mosque);
  field(changes, "وقت الصلاة", oldPrayer.time, newPrayer.time);

  const oldCards = list(before.condolences);
  const newCards = list(after.condolences);
  const oldLabels = venueLabels(oldCards);
  const newLabels = venueLabels(newCards);
  for (const [i, label] of newLabels.entries()) {
    const j = oldLabels.indexOf(label);
    const b = newCards[i];
    if (j < 0) { changes.push(`أُضيف ${label}: ${show(b.location)}${text(b.area) ? ` (${text(b.area)})` : ""}`); continue; }
    const a = oldCards[j];
    field(changes, `مقر ${label}`, a.location, b.location);
    field(changes, `منطقة ${label}`, a.area, b.area);
    field(changes, `رقم منزل ${label}`, a.houseNumber, b.houseNumber);
    field(changes, `وقت ${label}`, a.time, b.time);
    field(changes, `بداية ${label}`, a.start, b.start);
    field(changes, `مدة ${label} (أيام)`, a.durationDays, b.durationDays);
    field(changes, `رابط موقع ${label}`, a.mapLink, b.mapLink);
    const schedule = (card: Loose) => list(card.schedule).map((entry) => `${show(entry.days)} ${show(entry.time)}`).join(" / ");
    field(changes, `فترات ${label}`, schedule(a), schedule(b));
  }
  for (const label of oldLabels) if (!newLabels.includes(label)) changes.push(`حُذف ${label}`);

  field(changes, "ملاحظة العزاء", before.condolenceNote, after.condolenceNote);
  field(changes, "الملاحظات", before.notes, after.notes);
  field(changes, "الطلب المرتبط", before.relatedRequestNumber, after.relatedRequestNumber);

  // تغيير لم تلتقطه الحقول المعروفة
  if (!changes.length && JSON.stringify(before) !== JSON.stringify(after)) changes.push("تعديلات أخرى في البيانات");
  return changes;
}
