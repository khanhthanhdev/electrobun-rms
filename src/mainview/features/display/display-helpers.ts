/**
 * Helpers for display scene formatting.
 */

export const formatTimer = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const formatTeamLabel = (
  teamNumber: number,
  teamName: string,
  isSurrogate?: boolean
): string => {
  const tag = `${teamNumber}${isSurrogate ? "*" : ""}`;
  const name = teamName?.trim() ?? "";
  return name ? `${tag} ${name}` : `Team ${tag}`;
};
