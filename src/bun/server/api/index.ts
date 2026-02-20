import { Hono } from "hono";
import { authRoutes } from "./auth/auth.routes";
import type { AppEnv } from "./common/app-env";
import { eventsRoutes } from "./events/events.routes";
import { usersRoutes } from "./users/users.routes";

const api = new Hono<AppEnv>();

api.route("/auth", authRoutes);
api.route("/events", eventsRoutes);
api.route("/users", usersRoutes);

export { api };
