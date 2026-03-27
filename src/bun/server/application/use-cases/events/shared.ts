import { ApplicationError } from "../../common/application-error";

export type MaybePromise<T> = Promise<T> | T;

export const normalizeEventsEventCode = (eventCode: string): string => {
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
