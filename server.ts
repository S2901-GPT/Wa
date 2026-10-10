import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import apiApp from "./artifacts/api-server/src/app";
import { logger } from "./artifacts/api-server/src/lib/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);
const port = Number(process.env.PORT) || 3000;

// الشعار صورة داخل الجسم: مسار الإعدادات وحده يقبل جسماً أكبر من الافتراضي (100KB)، ويجب أن يسبق المحلل العام.
app.use("/api/admin/settings", express.json({ limit: "1mb" }));
app.use(express.json());
// أخطاء المتصفح: حقول محددة ومقصوصة فقط (لا جسم حر في السجل)، وبحدّ للمعدل لأن المسار مفتوح
const clientLogWindow = new Map<string, { count: number; until: number }>();
app.post("/api/client-log", (req, res) => {
  const key = req.ip ?? "?";
  const now = Date.now();
  const slot = clientLogWindow.get(key);
  if (slot && slot.until > now && slot.count >= 20) {
    res.status(429).end();
    return;
  }
  clientLogWindow.set(key, slot && slot.until > now ? { count: slot.count + 1, until: slot.until } : { count: 1, until: now + 10 * 60 * 1000 });
  if (clientLogWindow.size > 5000) clientLogWindow.clear();
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const field = (name: string, max: number) => (typeof body[name] === "string" ? (body[name] as string).slice(0, max) : undefined);
  console.error("BROWSER_CLIENT_ERROR:", JSON.stringify({ message: field("message", 500), stack: field("stack", 2000), componentStack: field("componentStack", 2000) }));
  res.json({ ok: true });
});

// Mount API app (handles /api/*)
app.use(apiApp);

// Mount frontend. In production this file runs as the bundle dist/server.mjs, one level below the project root.
const rootDir = path.basename(__dirname) === "dist" ? path.dirname(__dirname) : __dirname;
const clientRoot = path.resolve(rootDir, "artifacts/qatar-obituary-form");
const isProduction = process.env.NODE_ENV === "production";

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      configFile: path.resolve(clientRoot, "vite.config.ts"),
      root: clientRoot,
      server: {
        middlewareMode: true,
        host: "0.0.0.0",
        port,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const staticDir = path.resolve(clientRoot, "dist/public");
    app.use(express.static(staticDir));
    // Express 5 (path-to-regexp v8) rejects "*"; the SPA fallback must be written as a named wildcard.
    app.get("/{*splat}", (req, res) => {
      if (req.path.startsWith("/api/")) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.sendFile(path.resolve(staticDir, "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    logger.info({ port }, `Server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
