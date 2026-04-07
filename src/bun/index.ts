import { join } from "node:path";
import { BrowserWindow, Updater, Utils } from "electrobun/bun";
import { initializeDatabase } from "./db/migrate";
import { createServer } from "./server";
import { qualificationRankingsSyncHub } from "./server/api/events/rankings-sync";
import {
  GetQualificationRankingSourceFingerprintUseCase,
  RebuildQualificationRankingsUseCase,
} from "./server/application/use-cases/ranking";
import { SQLiteRankingRepository } from "./server/infrastructure/adapters/ranking";
import { RankingPollService } from "./server/infrastructure/services/ranking-poll-service";

// --- Configuration ---
const SERVER_PORT = 3002;
const SERVER_HOST = "0.0.0.0"; // Bind to all interfaces for LAN access
const VITE_DEV_PORT = 5173;

// --- Initialize database ---
await initializeDatabase();

// --- Start ranking poll service ---
const pollService = new RankingPollService({
  hub: qualificationRankingsSyncHub,
  getFingerprintUseCase: new GetQualificationRankingSourceFingerprintUseCase(
    new SQLiteRankingRepository()
  ),
  rebuildUseCase: new RebuildQualificationRankingsUseCase(
    new SQLiteRankingRepository()
  ),
});
pollService.start();

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
  title: "STEAM For Vietnam - Robotics Team",
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

// --- Auto Update ---
async function checkAndApplyUpdate() {
  try {
    const updateInfo = await Updater.checkForUpdate();
    console.log(
      `Update check: v${updateInfo.version}, available=${updateInfo.updateAvailable}`
    );

    if (updateInfo.updateAvailable) {
      console.log("Downloading update...");
      await Updater.downloadUpdate();

      const info = Updater.updateInfo();
      if (info?.updateReady) {
        console.log("Applying update and relaunching...");
        await Updater.applyUpdate();
      }
    }
  } catch (error) {
    console.error("Update check failed:", error);
  }
}

if (channel !== "dev") {
  checkAndApplyUpdate();
  // Check for updates every 30 minutes
  setInterval(checkAndApplyUpdate, 30 * 60 * 1000);
}

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
