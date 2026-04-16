import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

interface IssueScan {
  file: string;
  issue: boolean;
}

const RESET_GUARD_FILES = [
  "src/mainview/features/inspection/hooks/use-realtime-refresh.ts",
  "src/mainview/features/scoring/hooks/use-scoring-realtime-refresh.ts",
  "src/mainview/features/display/hooks/use-display-realtime-refresh.ts",
  "src/mainview/features/events/rankings/use-qualification-rankings-realtime-refresh.ts",
] as const;

const FATAL_ERROR_FILES = [
  "src/mainview/features/inspection/services/inspection-sync-service.ts",
  "src/mainview/features/scoring/services/scoring-sync-service.ts",
  "src/mainview/features/events/control/services/match-control-sync-service.ts",
] as const;

const hasResetGuardIssue = (source: string): boolean =>
  /realtimeVersion\s*<=\s*lastAppliedRef\.current\.version/.test(source);

const hasFatalErrorClassIssue = (source: string): boolean =>
  /export\s+class\s+\w+FatalError\s+extends\s+Error\s*\{\s*\}/.test(source);

const runScan = (
  files: readonly string[],
  detector: (source: string) => boolean
): { issues: number; scans: IssueScan[] } => {
  const scans = files.map((file) => {
    const source = readFileSync(file, "utf8");
    return { file, issue: detector(source) };
  });

  return {
    issues: scans.filter((scan) => scan.issue).length,
    scans,
  };
};

const startedAt = performance.now();

const resetGuardScan = runScan(RESET_GUARD_FILES, hasResetGuardIssue);
const fatalErrorScan = runScan(FATAL_ERROR_FILES, hasFatalErrorClassIssue);

const totalIssues = resetGuardScan.issues + fatalErrorScan.issues;
const elapsedMs = performance.now() - startedAt;

console.log(`METRIC sync_error_count=${totalIssues}`);
console.log(`METRIC reset_guard_issues=${resetGuardScan.issues}`);
console.log(`METRIC fatal_error_class_issues=${fatalErrorScan.issues}`);
console.log(`METRIC scan_ms=${Math.round(elapsedMs)}`);
