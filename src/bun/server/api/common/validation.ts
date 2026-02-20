import type { BaseIssue } from "valibot";

export function formatValidationIssues(issues?: BaseIssue<unknown>[]): string {
  if (!issues || issues.length === 0) {
    return "Invalid request payload.";
  }

  return issues.map((issue) => issue.message).join("; ");
}
