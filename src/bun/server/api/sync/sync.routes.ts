import { Hono } from "hono";
import type { AppEnv } from "../common/app-env";
import { syncAdminRoutes } from "./sync-admin.routes";
import { syncConfigRoutes } from "./sync-config.routes";
import { syncMachineRoutes } from "./sync-machine.routes";

export const syncRoutes = new Hono<AppEnv>();

syncRoutes.route("/", syncMachineRoutes);
syncRoutes.route("/", syncAdminRoutes);
syncRoutes.route("/", syncConfigRoutes);
