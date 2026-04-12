import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const SERVER_HOST = "127.0.0.1";
const SERVER_PORT = 3102;
const STATIC_DIR = resolve(process.cwd(), "dist");
const E2E_DATA_DIR = resolve(process.cwd(), ".data", "e2e");

process.env.ELECTROBUN_DATA_DIR = E2E_DATA_DIR;

const dataDir = resolve(E2E_DATA_DIR);

if (existsSync(dataDir)) {
  rmSync(dataDir, {
    force: true,
    recursive: true,
  });
}

const [{ initializeDatabase }, { createServer }] = await Promise.all([
  import("./db/migrate"),
  import("./server"),
]);

await initializeDatabase();

const app = createServer(STATIC_DIR);
const server = Bun.serve({
  fetch: app.fetch,
  hostname: SERVER_HOST,
  port: SERVER_PORT,
});

console.log(`E2E server running at http://${SERVER_HOST}:${SERVER_PORT}`);
console.log(`E2E data dir: ${dataDir}`);

const shutdown = (): void => {
  server.stop(true);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
