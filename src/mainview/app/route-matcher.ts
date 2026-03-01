export const readCurrentPath = (): string => {
  if (typeof window === "undefined") {
    return "/";
  }

  return window.location.pathname;
};

export const decodePathSegment = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};
