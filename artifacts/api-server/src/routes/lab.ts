// مركز التجارب: حالة مجموعات التجارب، ونسخ الطلبات الحية إليها، وتفريغها. كلها للمسؤول فقط.
import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { labRequestsDb, obituaryRequestsDb, probeCollection } from "@workspace/db";
import { requireAdmin } from "../lib/admin-auth";
import { storeUnavailable } from "./obituary-requests";

const router: IRouter = Router();

router.get("/lab/status", requireAdmin, async (_req, res): Promise<void> => {
  const [labRequests, formVisits] = await Promise.all([labRequestsDb.probe(), probeCollection("form_visits")]);
  let count = 0;
  if (labRequests === "ok") {
    try {
      count = (await labRequestsDb.list()).length;
    } catch {
      count = 0;
    }
  }
  res.json({ count, labRequests, formVisits });
});

/** نسخ كل الطلبات الحية إلى التجارب بالرقم والحالة وتاريخ الإنشاء نفسها (استبدالاً). */
router.post("/lab/import", requireAdmin, async (req, res): Promise<void> => {
  const rows = await obituaryRequestsDb.list();
  for (const row of rows) await labRequestsDb.putRaw(row);
  req.log.info({ count: rows.length }, "Live requests copied into the lab");
  res.json({ count: rows.length });
});

router.post("/lab/reset", requireAdmin, async (req, res): Promise<void> => {
  const count = await labRequestsDb.removeAll();
  req.log.info({ count }, "Lab requests cleared");
  res.json({ count });
});

// أخطاء المخزن الصارم (قواعد غير منشورة أو لا اتصال) → 503 برسالة عربية
router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  const message = storeUnavailable(err);
  if (message) {
    res.status(503).json({ error: message });
    return;
  }
  next(err);
});

export default router;
