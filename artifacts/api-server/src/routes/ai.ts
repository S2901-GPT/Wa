import { Router, type IRouter } from "express";
import { ParseObituaryTextBody, ParseObituaryTextResponse } from "@workspace/api-zod";
import { clientKey, createRateLimiter, requireAdmin } from "../lib/admin-auth";
import { AI_STUDIO_PROXY_PATH, AiError, aiConfig, aiEnvHints, extractRequest } from "../lib/ai-extract";
import { maskPhones } from "../lib/request-audit";

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
  const host = req.get("host") ?? "";
  const viaAiStudio = !apiKey && Boolean(process.env.APPLET_ID) && /^[a-z0-9.-]+(:\d+)?$/iu.test(host);
  const notConfigured = () => {
    const seen = aiEnvHints();
    req.log?.warn({ seen, viaAiStudio }, "Gemini key not visible to the app");
    res.status(503).json({
      error: `خدمة الصياغة بالذكاء الاصطناعي غير مفعّلة: مفتاح Gemini (GEMINI_API_KEY) لا يصل إلى التطبيق. المتغيرات التي يراها التطبيق: ${seen.join("، ") || "لا شيء"}.`,
      code: "ai_not_configured",
    });
  };
  if (!apiKey && !viaAiStudio) {
    notConfigured();
    return;
  }
  const limit = parses.hit(clientKey(req));
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSec));
    res.status(429).json({ error: "طلبات صياغة كثيرة، حاول بعد قليل." });
    return;
  }
  try {
    // بلا مفتاح في خدمة من AI Studio: جرّب وسيطها على عنوان الخدمة نفسه، فهو يضيف المفتاح.
    const endpoint = viaAiStudio ? `${req.protocol}://${host}${AI_STUDIO_PROXY_PATH}` : undefined;
    // أرقام الهواتف لا تغادر الخادم: تُطمس قبل الإرسال إلى النموذج
    const result = await extractRequest(maskPhones(parsed.data.text.trim()), { apiKey, model, endpoint });
    // لا يُكتب مقتطف الرد في سجل الخادم (قد يحمل أسماء)؛ المسؤول يراه في الشاشة
    if (result.debug) req.log?.warn({ model }, "AI extraction came back hollow");
    res.json(ParseObituaryTextResponse.parse(result));
  } catch (error) {
    // وصل الوسيط إلى Gemini (نص بلا متوفى، أو الخدمة مشغولة): رسالته هي الصحيحة. غير ذلك: الوسيط غير موجود.
    if (viaAiStudio && !(error instanceof AiError && (error.status === 422 || error.status === 429))) {
      req.log?.warn({ err: error }, "AI Studio proxy attempt failed");
      notConfigured();
      return;
    }
    if (error instanceof AiError) {
      if (error.debug) req.log?.warn({ status: error.status }, "AI extraction failed");
      res.status(error.status).json({ error: error.message, ...(error.debug ? { debug: error.debug } : {}) });
      return;
    }
    req.log.error({ err: error }, "AI parse failed");
    res.status(502).json({ error: "تعذّر الحصول على نتيجة من الذكاء الاصطناعي، حاول مرة أخرى." });
  }
});

export default router;
