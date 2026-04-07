import { Hono } from "hono";
import { authRoutes } from "./auth/auth.routes";
import type { AppEnv } from "./common/app-env";
import { displayRoutes } from "./display/display.routes";
import { eventsRoutes } from "./events/events.routes";
import { inspectionRoutes } from "./inspection/inspection.routes";
import { matchControlRoutes } from "./match-control/match-control.routes";
import { rankingRoutes } from "./ranking/ranking.routes";
import { scheduleRoutes } from "./schedule/schedule.routes";
import { scoringRoutes } from "./scoring/scoring.routes";
import { syncRoutes } from "./sync/sync.routes";
import { teamsRoutes } from "./teams/teams.routes";
import { usersRoutes } from "./users/users.routes";

const api = new Hono<AppEnv>();

api.route("/auth", authRoutes);
api.route("/events", eventsRoutes);
api.route("/events", inspectionRoutes);
api.route("/events", scoringRoutes);
api.route("/events", scheduleRoutes);
api.route("/events", teamsRoutes);
api.route("/events", displayRoutes);
api.route("/events", matchControlRoutes);
api.route("/users", usersRoutes);
api.route("/sync", syncRoutes);
api.route("/sync/v1", syncRoutes);
api.route("/events", rankingRoutes);

export { api };
