import { initializeDatabase } from "./db/migrate";
import { createServer } from "./server";

await initializeDatabase();
createServer(".");
console.log("running");
