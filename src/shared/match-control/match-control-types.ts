import type { InferOutput } from "valibot";
import type { matchControlStateSchema } from "./match-control-schemas";

export type MatchControlState = InferOutput<typeof matchControlStateSchema>;
