import { Router, type IRouter } from "express";
import { ParseObituaryTextBody, ParseObituaryTextResponse } from "@workspace/api-zod";
import { clientKey, createRateLimiter, requireAdmin } from "../lib/admin-auth";
import { AiError, aiConfig, extractRequest } from "../lib/ai-extract";

const router: IRouter = Router();

/** كل صياغة استدعاء مدفوع للذكاء الاصطناعي: ثلاثون كل عشر دقائق تكفي المسؤول وتمنع الإسراف. */
const parses = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30 });

router.post("/admin/parse-text", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ParseObituaryTextBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.text.trim()) {
    res.status(400).json({ error: "الصق نص الإعلان أولاً (حتى 8000 حرف)." });
    return;
  }
  const { apiKey, model } = aiConfig();
  if (!apiKey) {
    res.status(503).json({ error: "خدمة الصياغة بالذكاء الاصطناعي غير مفعّلة على الخادم.", code: "ai_not_configured" });
    return;
  }
  const limit = parses.hit(clientKey(req));
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSec));
    res.status(429).json({ error: "طلبات صياغة كثيرة، حاول بعد قليل." });
    return;
  }
  try {
    const result = await extractRequest(parsed.data.text.trim(), { apiKey, model });
    res.json(ParseObituaryTextResponse.parse(result));
  } catch (error) {
    if (error instanceof AiError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "AI parse failed");
    res.status(502).json({ error: "تعذّر الحصول على نتيجة من الذكاء الاصطناعي، حاول مرة أخرى." });
  }
});

export default router;
