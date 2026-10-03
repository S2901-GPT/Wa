import { Router, type IRouter } from "express";
import { AdminLoginBody } from "@workspace/api-zod";
import {
  adminStatus,
  clearedCookie,
  clientKey,
  createRateLimiter,
  createSessionToken,
  isAdminRequest,
  passwordMatches,
  sessionCookie,
} from "../lib/admin-auth";

const router: IRouter = Router();

/** عشر محاولات خاطئة كل ربع ساعة لكل عنوان. */
const failedLogins = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

router.use("/admin", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

router.get("/admin/session", (req, res): void => {
  const configured = adminStatus() === "ok";
  res.json({ authenticated: configured && isAdminRequest(req), configured });
});

router.post("/admin/login", async (req, res): Promise<void> => {
  const status = adminStatus();
  if (status !== "ok") {
    res.status(503).json({
      error: status === "weak" ? "كلمة مرور المسؤول المضبوطة في الخادم قصيرة؛ يلزم 8 أحرف على الأقل." : "لم تُضبط كلمة مرور المسؤول في الخادم بعد.",
      code: status === "weak" ? "admin_password_weak" : "admin_not_configured",
    });
    return;
  }

  const key = clientKey(req);
  const blocked = failedLogins.blocked(key);
  if (blocked.blocked) {
    res.setHeader("Retry-After", String(blocked.retryAfterSec));
    res.status(429).json({ error: "محاولات خاطئة كثيرة، حاول بعد قليل.", code: "too_many_attempts" });
    return;
  }

  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success || !passwordMatches(parsed.data.password)) {
    failedLogins.hit(key);
    // تأخير قصير يبطئ التخمين الآلي
    await sleep(400);
    res.status(401).json({ error: "كلمة المرور غير صحيحة", code: "bad_password" });
    return;
  }

  failedLogins.reset(key);
  res.setHeader("Set-Cookie", sessionCookie(req, createSessionToken()));
  res.json({ authenticated: true, configured: true });
});

router.post("/admin/logout", (req, res): void => {
  res.setHeader("Set-Cookie", clearedCookie(req));
  res.json({ authenticated: false, configured: adminStatus() === "ok" });
});

export default router;
