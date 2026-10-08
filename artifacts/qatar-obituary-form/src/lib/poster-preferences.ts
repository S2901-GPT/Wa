// اختيارات صورة التعزية المحفوظة في هذا المتصفح (التخطيط، حجم الخط، المقاس).
// يستخدمها الاستوديو وصفحة التجربة معاً، فيبقى الاختيار واحداً بينهما.
import {
  DEFAULT_NASKH_LAYOUT,
  DEFAULT_NASKH_POSTER_SIZE,
  DEFAULT_NASKH_TYPE_SCALE,
  isNaskhLayoutId,
  isNaskhPosterSizeId,
  isNaskhTypeScaleId,
  type NaskhLayoutId,
  type NaskhPosterSizeId,
  type NaskhTypeScaleId,
} from "./naskh-poster-plan";

const LAYOUT_STORAGE_KEY = "qatar_poster_layout_v1";
const TYPE_SCALE_STORAGE_KEY = "qatar_poster_type_scale_v1";
const POSTER_SIZE_STORAGE_KEY = "qatar_poster_size_v1";

function read<T extends string>(key: string, valid: (value: unknown) => value is T, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return valid(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* التخزين المحلي غير متاح (وضع خاص مثلاً)؛ الاختيار يبقى لهذه الجلسة فقط */
  }
}

/** آخر تخطيط اختاره المستخدم في هذا المتصفح. */
export const readStoredLayout = (): NaskhLayoutId => read(LAYOUT_STORAGE_KEY, isNaskhLayoutId, DEFAULT_NASKH_LAYOUT);
export const storeLayout = (layout: NaskhLayoutId) => store(LAYOUT_STORAGE_KEY, layout);

/** آخر حجم خط اختاره المستخدم في هذا المتصفح. */
export const readStoredTypeScale = (): NaskhTypeScaleId => read(TYPE_SCALE_STORAGE_KEY, isNaskhTypeScaleId, DEFAULT_NASKH_TYPE_SCALE);
export const storeTypeScale = (scale: NaskhTypeScaleId) => store(TYPE_SCALE_STORAGE_KEY, scale);

/** آخر مقاس صورة اختاره المستخدم في هذا المتصفح. */
export const readStoredPosterSize = (): NaskhPosterSizeId => read(POSTER_SIZE_STORAGE_KEY, isNaskhPosterSizeId, DEFAULT_NASKH_POSTER_SIZE);
export const storePosterSize = (size: NaskhPosterSizeId) => store(POSTER_SIZE_STORAGE_KEY, size);
