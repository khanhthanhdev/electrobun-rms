export const EVENT_CODE_REGEX = /^[A-Za-z0-9]{1,8}$/;
export const LEGACY_EVENT_CODE_REGEX = /^[a-z0-9_]{1,4}$/;
export const USERNAME_REGEX = /^[a-z0-9_]+$/;
export const MAX_EVENT_CODE_LENGTH = 8;
export const EVENT_CODE_VALIDATION_MESSAGE =
  "Event code must be 1-8 letters or digits.";

export const normalizeEventCode = (value: string): string => value.trim();

export const isValidEventCode = (value: string): boolean =>
  EVENT_CODE_REGEX.test(normalizeEventCode(value));

export const isSupportedEventCode = (value: string): boolean => {
  const trimmedValue = value.trim();
  return (
    EVENT_CODE_REGEX.test(trimmedValue) ||
    LEGACY_EVENT_CODE_REGEX.test(trimmedValue)
  );
};
