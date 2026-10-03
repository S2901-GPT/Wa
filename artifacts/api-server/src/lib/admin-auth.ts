// حماية صفحة المسؤول وواجهتها: كلمة مرور واحدة تُضبط في بيئة الخادم (ADMIN_PASSWORD)، وجلسة موقّعة في
// ملف تعريف ارتباط HttpOnly. التحقق يتم في الخادم لكل طلب محمي، فلا تكفي واجهة تسجيل دخول مخفية.
// لا توجد كلمة مرور افتراضية: إن لم تُضبط أو كانت ضعيفة تبقى لوحة الإدارة مقفلة (الإغلاق عند الغموض).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const ADMIN_COOKIE = "wa_admin";
export const MIN_PASSWORD_LENGTH = 8;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_PATH = "/api";

export type AdminStatus = "ok" | "missing" | "weak";

export function adminPassword(env: NodeJS.ProcessEnv = process.env): string {
  return (env.ADMIN_PASSWORD ?? "").trim();
}

export function adminStatus(env: NodeJS.ProcessEnv = process.env): AdminStatus {
  const password = adminPassword(env);
  if (!password) return "missing";
  return password.length < MIN_PASSWORD_LENGTH ? "weak" : "ok";
}

function sessionSecret(env: NodeJS.ProcessEnv): string {
  // تغيير كلمة المرور يُبطل كل الجلسات القائمة تلقائياً.
  return env.ADMIN_SESSION_SECRET?.trim() || createHash("sha256").update(`wa-admin-session:${adminPassword(env)}`).digest("hex");
}

const sign = (payload: string, env: NodeJS.ProcessEnv) => createHmac("sha256", sessionSecret(env)).update(payload).digest("base64url");

function equalStrings(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** مقارنة كلمة المرور بزمن ثابت (عبر ملخّصين بطول واحد حتى لا يظهر طول كلمة المرور من زمن الرد). */
export function passwordMatches(candidate: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (adminStatus(env) !== "ok") return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(candidate), hash(adminPassword(env)));
}

export function createSessionToken(now = Date.now(), env: NodeJS.ProcessEnv = process.env): string {
  const expires = String(now + SESSION_MS);
  return `${expires}.${sign(`v1.${expires}`, env)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now(), env: NodeJS.ProcessEnv = process.env): boolean {
  if (!token || adminStatus(env) !== "ok") return false;
  const [expires, signature, ...rest] = token.split(".");
  if (!expires || !signature || rest.length) return false;
  if (!/^\d{10,16}$/.test(expires) || Number(expires) <= now) return false;
  return equalStrings(signature, sign(`v1.${expires}`, env));
}

export function readCookie(req: Pick<Request, "headers">, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return undefined;
}

function isSecure(req: Pick<Request, "secure" | "headers">): boolean {
  return req.secure || req.headers["x-forwarded-proto"] === "https";
}

export function sessionCookie(req: Pick<Request, "secure" | "headers">, token: string): string {
  return `${ADMIN_COOKIE}=${token}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_MS / 1000)}${isSecure(req) ? "; Secure" : ""}`;
}

export function clearedCookie(req: Pick<Request, "secure" | "headers">): string {
  return `${ADMIN_COOKIE}=; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=0${isSecure(req) ? "; Secure" : ""}`;
}

export function isAdminRequest(req: Pick<Request, "headers">, now = Date.now(), env: NodeJS.ProcessEnv = process.env): boolean {
  return verifySessionToken(readCookie(req, ADMIN_COOKIE), now, env);
}

/** يحمي المسار: بلا جلسة مسؤول صالحة يرد 401، ولا يُخزَّن الرد في ذاكرة المتصفح. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "no-store");
  if (isAdminRequest(req)) {
    next();
    return;
  }
  res.status(401).json({ error: "يلزم تسجيل الدخول كمسؤول", code: "admin_required" });
}

// ───────────────────────── تحديد المحاولات ─────────────────────────

export type RateLimiter = {
  /** يسجّل محاولة للمفتاح، ويعيد هل ما زال مسموحاً وكم ثانية للانتظار إن مُنع. */
  hit(key: string, now?: number): { allowed: boolean; retryAfterSec: number };
  /** هل المفتاح ممنوع الآن دون تسجيل محاولة جديدة. */
  blocked(key: string, now?: number): { blocked: boolean; retryAfterSec: number };
  reset(key: string): void;
};

/** حد بسيط في الذاكرة لكل مفتاح (عنوان العميل). لكل نسخة من الخدمة عدّادها، وهو كافٍ لإبطاء التخمين. */
export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }): RateLimiter {
  const hits = new Map<string, number[]>();
  const recent = (key: string, now: number) => {
    const list = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  };
  const retryAfter = (list: number[], now: number) => Math.max(1, Math.ceil((list[0] + windowMs - now) / 1000));
  return {
    hit(key, now = Date.now()) {
      const list = recent(key, now);
      if (list.length >= max) return { allowed: false, retryAfterSec: retryAfter(list, now) };
      list.push(now);
      hits.set(key, list);
      if (hits.size > 5000) for (const stale of hits.keys()) recent(stale, now);
      return { allowed: true, retryAfterSec: 0 };
    },
    blocked(key, now = Date.now()) {
      const list = recent(key, now);
      return list.length >= max ? { blocked: true, retryAfterSec: retryAfter(list, now) } : { blocked: false, retryAfterSec: 0 };
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

export function clientKey(req: Pick<Request, "ip" | "socket">): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}
