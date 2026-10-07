// كشف الطلب المكرر: نفس المتوفى قد يصل مرتين (من قريبين، أو رسالة تصحيح بعد الأولى).
// المقارنة بالاسم وحده، لأن بقية البيانات تختلف بين الرسالتين غالباً، وضمن نافذة زمنية قصيرة
// لأن تشابه الأسماء بعد أيام لا يعني التكرار.
import type { ObituaryRequest, ObituaryRequestInput } from "@workspace/api-client-react";
import { normalizeArabic } from "./presentation-normalizer";

/** الطلبات الأقدم من هذه المدة ليست تكراراً ولو تطابق الاسم. */
export const DUPLICATE_WINDOW_HOURS = 48;

/** كلمات لا تميّز شخصاً عن آخر، فلا تُحتسب في المطابقة. */
const FILLER = new Set(["بن", "بنت", "ابن", "ابنه", "ابنة", "ال", "آل", "الشيخ", "الشيخه", "المرحوم", "المرحومه"]);

/** كلمات الاسم بعد توحيد الهمزات والتاء المربوطة، بلا الكلمات الرابطة. */
export function nameTokens(name: string): string[] {
  return normalizeArabic(name)
    .split(/\s+/u)
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !FILLER.has(word));
}

/**
 * اسمان لشخص واحد على الأرجح:
 * إما أن يكون الأقصر جزءاً من الأطول («عبدالله حمد هادي» داخل «عبدالله حمد هادي دخيل الدوسري»)،
 * أو يتفق اسم العائلة (آخر كلمة) ويشترك الاسمان في أغلب كلماتهما.
 */
export function sameDeceasedName(a: string, b: string): boolean {
  const first = nameTokens(a);
  const second = nameTokens(b);
  if (!first.length || !second.length) return false;
  const [shortTokens, longTokens] = first.length <= second.length ? [first, second] : [second, first];
  const longSet = new Set(longTokens);
  const shared = shortTokens.filter((word) => longSet.has(word));
  if (shared.length === shortTokens.length) return true;
  const sameFamily = shortTokens[shortTokens.length - 1] === longTokens[longTokens.length - 1];
  return sameFamily && shared.length / shortTokens.length >= 0.6;
}

/** أسماء المتوفين في طلب، بما فيها الكنية واسم الزوج حين يُعرَّف بهما. */
function deceasedNames(request: Pick<ObituaryRequestInput, "deceasedPeople">): string[] {
  return (request.deceasedPeople ?? [])
    .flatMap((person) => [person.fullName, person.kunya, person.spouse?.name])
    .map((name) => (name ?? "").trim())
    .filter(Boolean);
}

export type DuplicateMatch = {
  request: ObituaryRequest;
  /** الاسم الذي طابق، كما هو مكتوب في الطلب السابق. */
  name: string;
};

/**
 * الطلبات المسجّلة خلال النافذة الزمنية التي تحمل اسم أحد المتوفين نفسه، الأحدث أولاً.
 * المقارنة تتجاهل الطلب نفسه (عند التحديث) وما حُذف من القائمة.
 */
export function findRecentDuplicates(
  candidate: Pick<ObituaryRequestInput, "deceasedPeople">,
  requests: readonly ObituaryRequest[],
  now: Date = new Date(),
  { windowHours = DUPLICATE_WINDOW_HOURS, excludeRequestNumber = "" }: { windowHours?: number; excludeRequestNumber?: string } = {},
): DuplicateMatch[] {
  const names = deceasedNames(candidate);
  if (!names.length) return [];
  const oldest = now.getTime() - windowHours * 60 * 60 * 1000;
  return requests
    .filter((request) => request.requestNumber !== excludeRequestNumber)
    .map((request) => {
      const created = Date.parse(request.createdAt);
      if (!Number.isFinite(created) || created < oldest || created > now.getTime() + 60_000) return undefined;
      const name = deceasedNames(request).find((previous) => names.some((current) => sameDeceasedName(current, previous)));
      return name ? { request, name } : undefined;
    })
    .filter((match): match is DuplicateMatch => !!match)
    .sort((a, b) => Date.parse(b.request.createdAt) - Date.parse(a.request.createdAt));
}
