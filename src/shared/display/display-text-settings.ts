export type DisplayHeaderMode = "default" | "custom";

export interface DisplayTextSettings {
  headerMode: DisplayHeaderMode;
  customHeaderText: string;
  headerFontSize: number;
  headerColor: string;
  footerText: string;
  footerFontSize: number;
  footerColor: string;
}

export const DEFAULT_DISPLAY_FOOTER_TEXT = "HÀNH TINH 4.0";
export const DEFAULT_DISPLAY_HEADER_COLOR = "#ffffff";
export const DEFAULT_DISPLAY_FOOTER_COLOR = "#0a0930";

export const DEFAULT_DISPLAY_TEXT_SETTINGS: DisplayTextSettings = {
  headerMode: "default",
  customHeaderText: "",
  headerFontSize: 64,
  headerColor: DEFAULT_DISPLAY_HEADER_COLOR,
  footerText: DEFAULT_DISPLAY_FOOTER_TEXT,
  footerFontSize: 23,
  footerColor: DEFAULT_DISPLAY_FOOTER_COLOR,
};

export const DISPLAY_CUSTOM_HEADER_MAX_LENGTH = 80;
export const DISPLAY_FOOTER_MAX_LENGTH = 48;
export const DISPLAY_HEADER_FONT_SIZE_MIN = 24;
export const DISPLAY_HEADER_FONT_SIZE_MAX = 96;
export const DISPLAY_FOOTER_FONT_SIZE_MIN = 14;
export const DISPLAY_FOOTER_FONT_SIZE_MAX = 42;
