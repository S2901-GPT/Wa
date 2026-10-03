// إعدادات هوية صورة التعزية (الشعار…) للمسؤول. ملف مستقل عن admin.ts حتى لا تستورد اختبارات الحماية طبقة قاعدة البيانات.
import { Router, type IRouter } from "express";
import { SavePosterSettingsBody } from "@workspace/api-zod";
import { posterSettingsDb } from "@workspace/db";
import { requireAdmin } from "../lib/admin-auth";
import { isValidLogoDataUrl, normalizePosterSettings } from "../lib/poster-settings";

const router: IRouter = Router();

router.get("/admin/settings", requireAdmin, async (_req, res): Promise<void> => {
  res.json(normalizePosterSettings(await posterSettingsDb.get()));
});

router.put("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const parsed = SavePosterSettingsBody.safeParse(req.body);
  if (!parsed.success || (parsed.data.logoDataUrl !== "" && !isValidLogoDataUrl(parsed.data.logoDataUrl))) {
    res.status(400).json({ error: "الإعدادات غير صالحة: الشعار يجب أن يكون صورة PNG أو JPEG أو WebP." });
    return;
  }
  const settings = normalizePosterSettings(parsed.data);
  try {
    await posterSettingsDb.save(settings);
  } catch (err) {
    req.log.error({ err }, "Failed to save poster settings");
    res.status(500).json({ error: "تعذر حفظ الإعدادات، حاول مرة أخرى." });
    return;
  }
  res.json(settings);
});

export default router;
