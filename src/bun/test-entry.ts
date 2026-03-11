import { initializeDatabase } from "./db/migrate";
import { createServer } from "./server";

await initializeDatabase();
const _app = createServer(".");
console.log("running");
