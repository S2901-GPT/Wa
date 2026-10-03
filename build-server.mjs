// Bundles server.ts and everything it imports into dist/server.mjs, so production
// runs with plain `node` and needs no node_modules (Cloud Run may get the source without them).
import { build } from "esbuild";

await build({
  entryPoints: ["server.ts"],
  outfile: "dist/server.mjs",
  platform: "node",
  target: "node22",
  format: "esm",
  bundle: true,
  // vite is only imported in development; native addons cannot be bundled.
  external: ["vite", "*.node", "fsevents", "lightningcss"],
  // The bundle is production-only: no Vite middleware and no pino-pretty worker, whatever NODE_ENV says.
  define: { "process.env.NODE_ENV": '"production"' },
  sourcemap: "linked",
  logLevel: "info",
  // CommonJS packages (express and friends) call require/__dirname inside an ESM bundle.
  banner: {
    js: [
      "import { createRequire as __cr } from 'node:module';",
      "import __p from 'node:path';",
      "import __u from 'node:url';",
      "const require = __cr(import.meta.url);",
      // Globals, not declarations: server.ts declares its own top-level __filename/__dirname.
      "globalThis.__filename ??= __u.fileURLToPath(import.meta.url);",
      "globalThis.__dirname ??= __p.dirname(globalThis.__filename);",
    ].join("\n"),
  },
});
