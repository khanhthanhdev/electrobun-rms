import { ApplicationError } from "../../common/application-error";

export const normalizeScoringEventCode = (eventCode: string): string => {
  const normalizedEventCode = eventCode.trim();
  if (!normalizedEventCode) {
    throw new ApplicationError("Event code is required.", 400);
  }

  if (
    normalizedEventCode.includes("/") ||
    normalizedEventCode.includes("\\") ||
    normalizedEventCode.includes("..")
  ) {
    throw new ApplicationError(
      `Invalid event code "${normalizedEventCode}".`,
      400
    );
  }

  return normalizedEventCode;
};
