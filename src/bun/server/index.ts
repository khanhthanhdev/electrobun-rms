import { extname, join, resolve } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { api } from "./routes";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
};

function getMimeType(filePath: string): string {
  return (
    MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream"
  );
}

export function createServer(staticDir: string) {
  const app = new Hono();

  app.use("/*", cors());

  app.route("/api", api);

  app.get("/health", (c) =>
    c.json({ status: "ok", timestamp: new Date().toISOString() })
  );

  const absStaticDir = resolve(staticDir);

  app.get("/*", async (c) => {
    let pathname = new URL(c.req.url).pathname;
    if (pathname === "/") {
      pathname = "/index.html";
    }

    const filePath = join(absStaticDir, pathname);

    if (!filePath.startsWith(absStaticDir)) {
      return c.text("Forbidden", 403);
    }

    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file.stream(), {
        headers: { "Content-Type": getMimeType(filePath) },
      });
    }

    // SPA fallback
    const indexFile = Bun.file(join(absStaticDir, "index.html"));
    if (await indexFile.exists()) {
      return new Response(indexFile.stream(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return c.text("Not Found", 404);
  });

  return app;
}
