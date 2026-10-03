/**
 * اختبارات حماية صفحة المسؤول: كلمة المرور، الجلسة الموقّعة، تحديد المحاولات، والتحقق عبر خادم HTTP حقيقي
 * (بلا قاعدة بيانات: مسارات الإدارة ومسار تجريبي محمي فقط).
 */
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  ADMIN_COOKIE,
  adminStatus,
  createRateLimiter,
  createSessionToken,
  passwordMatches,
  readCookie,
  requireAdmin,
  sessionCookie,
  verifySessionToken,
} from "./admin-auth";
import adminRouter from "../routes/admin";

const PASSWORD = "correct-horse-battery";
const env = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => ({ ADMIN_PASSWORD: PASSWORD, ...extra });
const NOW = 1_800_000_000_000;

const cases: Array<[string, () => void | Promise<void>]> = [
  ["status: missing, weak (under 8) and ok; whitespace is trimmed", () => {
    assert.equal(adminStatus({}), "missing");
    assert.equal(adminStatus({ ADMIN_PASSWORD: "   " }), "missing");
    assert.equal(adminStatus({ ADMIN_PASSWORD: "short7!" }), "weak");
    assert.equal(adminStatus({ ADMIN_PASSWORD: "12345678" }), "ok");
    assert.equal(adminStatus({ ADMIN_PASSWORD: "  12345678\n" }), "ok");
  }],
  ["password check is exact and never succeeds when the password is not configured", () => {
    assert.equal(passwordMatches(PASSWORD, env()), true);
    assert.equal(passwordMatches(`${PASSWORD} `, env()), false);
    assert.equal(passwordMatches("wrong", env()), false);
    assert.equal(passwordMatches("", env()), false);
    assert.equal(passwordMatches("", {}), false, "empty password must not match an unset one");
    assert.equal(passwordMatches("short7!", { ADMIN_PASSWORD: "short7!" }), false, "weak passwords are refused");
  }],
  ["session token: valid, expired, tampered and malformed", () => {
    const token = createSessionToken(NOW, env());
    assert.equal(verifySessionToken(token, NOW + 1000, env()), true);
    assert.equal(verifySessionToken(token, NOW + 7 * 24 * 3600 * 1000 + 1, env()), false, "expired after 7 days");
    const [expires, signature] = token.split(".");
    assert.equal(verifySessionToken(`${Number(expires) + 100000}.${signature}`, NOW, env()), false, "extended expiry");
    assert.equal(verifySessionToken(`${expires}.${signature.slice(0, -2)}xx`, NOW, env()), false, "bad signature");
    for (const bad of ["", "abc", "1.2.3", `${expires}.`, `.${signature}`, undefined]) assert.equal(verifySessionToken(bad, NOW, env()), false, String(bad));
  }],
  ["a token dies when the password changes or the password is removed", () => {
    const token = createSessionToken(NOW, env());
    assert.equal(verifySessionToken(token, NOW, env({ ADMIN_PASSWORD: "another-password-1" })), false);
    assert.equal(verifySessionToken(token, NOW, {}), false);
    assert.equal(verifySessionToken(token, NOW, env({ ADMIN_SESSION_SECRET: "x" })), false, "different signing secret");
  }],
  ["cookie parsing and the session cookie flags", () => {
    assert.equal(readCookie({ headers: { cookie: `a=1; ${ADMIN_COOKIE}=tok%2Ben; b=2` } }, ADMIN_COOKIE), "tok+en");
    assert.equal(readCookie({ headers: { cookie: "a=1" } }, ADMIN_COOKIE), undefined);
    assert.equal(readCookie({ headers: {} }, ADMIN_COOKIE), undefined);
    const secure = sessionCookie({ secure: false, headers: { "x-forwarded-proto": "https" } }, "T");
    assert.match(secure, /^wa_admin=T; Path=\/api; HttpOnly; SameSite=Strict; Max-Age=604800; Secure$/);
    assert.ok(!sessionCookie({ secure: false, headers: {} }, "T").includes("Secure"));
  }],
  ["rate limiter: blocks after max, reports the wait, expires and resets", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 3 });
    for (let i = 0; i < 3; i += 1) assert.equal(limiter.hit("ip", NOW + i).allowed, true);
    const denied = limiter.hit("ip", NOW + 10);
    assert.equal(denied.allowed, false);
    assert.ok(denied.retryAfterSec >= 1);
    assert.equal(limiter.blocked("ip", NOW + 10).blocked, true);
    assert.equal(limiter.hit("other", NOW + 10).allowed, true, "other keys are independent");
    assert.equal(limiter.blocked("ip", NOW + 5000).blocked, false, "window passed");
    limiter.hit("ip", NOW + 6000); limiter.hit("ip", NOW + 6001); limiter.hit("ip", NOW + 6002);
    assert.equal(limiter.blocked("ip", NOW + 6003).blocked, true);
    limiter.reset("ip");
    assert.equal(limiter.blocked("ip", NOW + 6003).blocked, false);
  }],
];

/** خادم حقيقي: مسارات الإدارة + مسار محمي تجريبي. */
async function httpFlow() {
  process.env.ADMIN_PASSWORD = PASSWORD;
  delete process.env.ADMIN_SESSION_SECRET;
  const app = express();
  app.use(express.json());
  app.use("/api", adminRouter);
  app.get("/api/secret", requireAdmin, (_req, res) => { res.json({ ok: true }); });
  const server = await new Promise<import("node:http").Server>((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const post = (path: string, body: unknown, cookie?: string) =>
    fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
  try {
    // بلا جلسة
    let res = await fetch(`${base}/secret`);
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.deepEqual(await (await fetch(`${base}/admin/session`)).json(), { authenticated: false, configured: true });

    // كلمة مرور خاطئة أو جسم غير صالح
    assert.equal((await post("/admin/login", { password: "nope" })).status, 401);
    assert.equal((await post("/admin/login", {})).status, 401);
    assert.equal((await fetch(`${base}/secret`, { headers: { cookie: `${ADMIN_COOKIE}=forged.value` } })).status, 401);

    // دخول صحيح
    res = await post("/admin/login", { password: PASSWORD });
    assert.equal(res.status, 200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    const cookie = setCookie.split(";")[0];
    assert.equal((await fetch(`${base}/secret`, { headers: { cookie } })).status, 200);
    assert.deepEqual(await (await fetch(`${base}/admin/session`, { headers: { cookie } })).json(), { authenticated: true, configured: true });

    // خروج
    res = await post("/admin/logout", {}, cookie);
    assert.match(res.headers.get("set-cookie") ?? "", /Max-Age=0/);

    // كلمة المرور غير مضبوطة أو ضعيفة: الدخول مرفوض والجلسة القديمة لا تعمل
    delete process.env.ADMIN_PASSWORD;
    res = await post("/admin/login", { password: "anything" });
    assert.equal(res.status, 503);
    assert.equal((await res.json() as { code: string }).code, "admin_not_configured");
    assert.equal((await fetch(`${base}/secret`, { headers: { cookie } })).status, 401, "old session dies with the password");
    assert.deepEqual(await (await fetch(`${base}/admin/session`)).json(), { authenticated: false, configured: false });
    process.env.ADMIN_PASSWORD = "short";
    assert.equal((await (await post("/admin/login", { password: "short" })).json() as { code: string }).code, "admin_password_weak");

    // تحديد المحاولات: عشر محاولات خاطئة ثم المنع حتى لكلمة المرور الصحيحة
    process.env.ADMIN_PASSWORD = PASSWORD;
    for (let i = 0; i < 10; i += 1) assert.equal((await post("/admin/login", { password: `wrong-${i}` })).status, 401);
    res = await post("/admin/login", { password: PASSWORD });
    assert.equal(res.status, 429);
    assert.ok(Number(res.headers.get("retry-after")) >= 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

let failed = 0;
for (const [name, test] of [...cases, ["http flow: gating, login, session, logout, not-configured, weak and throttling", httpFlow] as [string, () => Promise<void>]]) {
  try {
    await test();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}\n${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  }
}
if (failed) {
  console.error(`${failed} of ${cases.length + 1} admin auth cases failed.`);
  process.exit(1);
}
console.log(`Passed ${cases.length + 1} admin auth cases.`);
