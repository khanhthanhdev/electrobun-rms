import { resolve } from "node:path";

export const adminStorageStatePath = resolve(
  process.cwd(),
  "playwright",
  ".auth",
  "admin.json"
);
