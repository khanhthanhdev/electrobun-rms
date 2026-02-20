import { join } from "node:path";
import { BrowserWindow, Updater, Utils } from "electrobun/bun";
import { initializeDatabase } from "./db/migrate";
import { createServer } from "./server";

// --- Configuration ---
const SERVER_PORT = 3000;
const SERVER_HOST = "0.0.0.0"; // Bind to all interfaces for LAN access
const VITE_DEV_PORT = 5173;

// --- Initialize database ---
await initializeDatabase();

// Resolve static dir relative to the bundled bun entry point
// import.meta.dir = .../Resources/app/bun → static files at .../Resources/app/views/mainview
const staticDir = join(import.meta.dir, "..", "views", "mainview");

// --- Start Hono server ---
const app = createServer(staticDir);

const server = Bun.serve({
  port: SERVER_PORT,
  hostname: SERVER_HOST,
  fetch: app.fetch,
});

console.log(`🚀 Server running at http://${SERVER_HOST}:${SERVER_PORT}`);
console.log(`📡 LAN access: http://${getLocalIP()}:${SERVER_PORT}`);

// --- Create ElectroBun window ---
const channel = await Updater.localInfo.channel();
let windowUrl: string;

if (channel === "dev") {
  try {
    await fetch(`http://localhost:${VITE_DEV_PORT}`, { method: "HEAD" });
    windowUrl = `http://localhost:${VITE_DEV_PORT}`;
    console.log("🔥 HMR enabled: Using Vite dev server");
  } catch {
    windowUrl = `http://localhost:${SERVER_PORT}`;
    console.log("Using built assets via Hono server");
  }
} else {
  windowUrl = `http://localhost:${SERVER_PORT}`;
}

const mainWindow = new BrowserWindow({
  title: "ElectroBun App",
  url: windowUrl,
  frame: {
    width: 1200,
    height: 800,
    x: 100,
    y: 100,
  },
});

mainWindow.on("close", () => {
  server.stop(true);
  Utils.quit();
});

console.log("✅ ElectroBun app started!");

// --- Helper ---
function getLocalIP(): string {
  const os = require("node:os");
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}
