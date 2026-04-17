/**
 * Display scene modes - re-exported from shared contract.
 *
 * The shared contract defines all documented display scenes.
 * This file re-exports the type for backward compatibility.
 *
 * @see docs/display-control-workflow.md
 */
import type { DisplaySceneMode } from "@shared/display";

// Re-export for backward compatibility
export type { DisplaySceneMode } from "@shared/display";

/** Default scene when no command has been received. */
export const DEFAULT_DISPLAY_SCENE: DisplaySceneMode = "next-match";
