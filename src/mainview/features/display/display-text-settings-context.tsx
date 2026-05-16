import {
  DEFAULT_DISPLAY_TEXT_SETTINGS,
  type DisplayTextSettings,
} from "@shared/display";
import { createContext, useContext } from "react";

const DisplayTextSettingsContext = createContext<DisplayTextSettings>(
  DEFAULT_DISPLAY_TEXT_SETTINGS
);

export const DisplayTextSettingsProvider = ({
  children,
  settings,
}: {
  children: React.ReactNode;
  settings: DisplayTextSettings;
}): JSX.Element => (
  <DisplayTextSettingsContext.Provider value={settings}>
    {children}
  </DisplayTextSettingsContext.Provider>
);

export const useDisplayTextSettings = (): DisplayTextSettings =>
  useContext(DisplayTextSettingsContext);
