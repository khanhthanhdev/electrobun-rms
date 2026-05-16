const DISPLAY_SETTINGS_REFRESH_EVENT = "display-settings-refresh";

export const notifyDisplaySettingsRefresh = (eventCode: string): void => {
  window.dispatchEvent(
    new CustomEvent(DISPLAY_SETTINGS_REFRESH_EVENT, { detail: { eventCode } })
  );
};

export const subscribeToDisplaySettingsRefresh = (
  eventCode: string,
  listener: () => void
): (() => void) => {
  const handleRefresh = (event: Event): void => {
    const detail = (event as CustomEvent<{ eventCode?: string }>).detail;
    if (detail?.eventCode === eventCode) {
      listener();
    }
  };

  window.addEventListener(DISPLAY_SETTINGS_REFRESH_EVENT, handleRefresh);
  return () => {
    window.removeEventListener(DISPLAY_SETTINGS_REFRESH_EVENT, handleRefresh);
  };
};
