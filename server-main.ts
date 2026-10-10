import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "node:url";
import apiApp from "./artifacts/api-server/src/app";
import { logger } from "./artifacts/api-server/src/lib/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.post("/api/client-log", (req, res) => {
  console.error("BROWSER_CLIENT_ERROR:", JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

// Health check endpoint for Cloud Run / load balancers
app.get("/healthz", (_req, res) => {
  res.status(200).send("OK");
});

// Mount API app (handles /api/*)
app.use(apiApp);

// Mount frontend
const clientRoot = path.resolve(__dirname, "artifacts/qatar-obituary-form");
const staticDir = path.resolve(clientRoot, "dist/public");
const hasBuiltAssets = fs.existsSync(path.resolve(staticDir, "index.html"));
const isDev = process.env.npm_lifecycle_event === "dev";
const isProduction = !isDev && hasBuiltAssets;

if (isProduction) {
  process.env.NODE_ENV = "production";
}

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
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(staticDir));
    
    // Catch-all route for SPA in Express 5
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return next();
      }
      const indexPath = path.resolve(staticDir, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err && !res.headersSent) {
          next(err);
        }
      });
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
