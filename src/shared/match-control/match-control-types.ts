import type { InferOutput } from "valibot";
import type {
  activeStateSchema,
  loadedStateSchema,
  matchControlStateSchema,
} from "./match-control-schemas";

export type LoadedState = InferOutput<typeof loadedStateSchema>;
export type ActiveState = InferOutput<typeof activeStateSchema>;
export type MatchControlState = InferOutput<typeof matchControlStateSchema>;
