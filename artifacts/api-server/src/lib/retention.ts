// تشغيل انتهاء مدة الاحتفاظ (48 ساعة) على مخازن الطلبات: قبل كل قراءة من المسارات (بحدّ مرة في الدقيقة لكل
// مخزن) وبمؤقّت دوري، حتى لا يصل طلب تجاوز المدة إلى أي شاشة أو بحث.
import { labRequestsDb, obituaryRequestsDb, retentionHours, type RequestsStore } from "@workspace/db";
import { logger } from "./logger";

/** الفاصل الأدنى بين فحصين: دقيقة، أو ربع المهلة إن كانت أقصر (للاختبار بـ`RETENTION_HOURS` صغيرة). */
const minGapMs = () => Math.min(60 * 1000, (retentionHours() * 3600 * 1000) / 4);
const lastSweep = new WeakMap<RequestsStore, number>();
const running = new WeakMap<RequestsStore, Promise<number>>();

/** يجهّل ما انتهت مدته في المخزن. يعيد عدد المجهَّل، أو 0 إن سبق فحصه قبل أقل من دقيقة. */
export async function sweepExpired(store: RequestsStore, { force = false }: { force?: boolean } = {}): Promise<number> {
  const now = Date.now();
  const inFlight = running.get(store);
  if (inFlight) return inFlight;
  if (!force && now - (lastSweep.get(store) ?? 0) < minGapMs()) return 0;
  const job = store
    .expireOlderThan(retentionHours())
    .then((count) => {
      if (count) logger.info({ collection: store.collectionName, count }, "Expired requests anonymised");
      return count;
    })
    .catch((err) => {
      logger.warn({ err, collection: store.collectionName }, "Retention sweep failed");
      return 0;
    })
    .finally(() => {
      lastSweep.set(store, Date.now());
      running.delete(store);
    });
  running.set(store, job);
  return job;
}

/** عند بدء الخدمة ثم كل ربع ساعة، على المخزنين. */
export function startRetentionTimer(): void {
  const run = () => {
    void sweepExpired(obituaryRequestsDb, { force: true });
    void sweepExpired(labRequestsDb, { force: true });
  };
  run();
  const timer = setInterval(run, 15 * 60 * 1000);
  timer.unref();
}
