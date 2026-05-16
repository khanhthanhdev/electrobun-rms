import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_DISPLAY_FOOTER_COLOR,
  DEFAULT_DISPLAY_FOOTER_TEXT,
  DEFAULT_DISPLAY_HEADER_COLOR,
  DEFAULT_DISPLAY_TEXT_SETTINGS,
  DISPLAY_CUSTOM_HEADER_MAX_LENGTH,
  DISPLAY_FOOTER_MAX_LENGTH,
  DISPLAY_FOOTER_FONT_SIZE_MAX,
  DISPLAY_FOOTER_FONT_SIZE_MIN,
  DISPLAY_HEADER_FONT_SIZE_MAX,
  DISPLAY_HEADER_FONT_SIZE_MIN,
  type DisplayTextSettings,
} from "@shared/display";
import { getDataDir } from "../../../db";

const DISPLAY_TEXT_SETTINGS_CONFIG_KEY = "display_text_settings";

const trimBounded = (value: unknown, maxLength: number): string =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const clampNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number => {
  const numberValue =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(numberValue)));
};

const normalizeHexColor = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
};

export const normalizeDisplayTextSettings = (
  input: unknown
): DisplayTextSettings => {
  const data =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const headerMode = data.headerMode === "custom" ? "custom" : "default";
  const customHeaderText = trimBounded(
    data.customHeaderText,
    DISPLAY_CUSTOM_HEADER_MAX_LENGTH
  );
  const headerFontSize = clampNumber(
    data.headerFontSize ?? DEFAULT_DISPLAY_TEXT_SETTINGS.headerFontSize,
    DISPLAY_HEADER_FONT_SIZE_MIN,
    DISPLAY_HEADER_FONT_SIZE_MAX,
    DEFAULT_DISPLAY_TEXT_SETTINGS.headerFontSize
  );
  const headerColor = normalizeHexColor(
    data.headerColor,
    DEFAULT_DISPLAY_HEADER_COLOR
  );
  const footerText =
    trimBounded(data.footerText, DISPLAY_FOOTER_MAX_LENGTH) ||
    DEFAULT_DISPLAY_FOOTER_TEXT;
  const footerFontSize = clampNumber(
    data.footerFontSize ?? DEFAULT_DISPLAY_TEXT_SETTINGS.footerFontSize,
    DISPLAY_FOOTER_FONT_SIZE_MIN,
    DISPLAY_FOOTER_FONT_SIZE_MAX,
    DEFAULT_DISPLAY_TEXT_SETTINGS.footerFontSize
  );
  const footerColor = normalizeHexColor(
    data.footerColor,
    DEFAULT_DISPLAY_FOOTER_COLOR
  );

  return {
    headerMode,
    customHeaderText,
    headerFontSize,
    headerColor,
    footerText,
    footerFontSize,
    footerColor,
  };
};

export const validateDisplayTextSettings = (
  input: unknown
): { settings: DisplayTextSettings } | { error: string } => {
  const settings = normalizeDisplayTextSettings(input);

  if (settings.headerMode === "custom" && !settings.customHeaderText) {
    return { error: "Custom header text is required when custom mode is used." };
  }

  return { settings };
};

const openEventDb = (
  eventCode: string,
  options: { ensureConfigTable: boolean }
): Database | null => {
  const eventDbPath = join(getDataDir(), `${eventCode}.db`);
  if (!existsSync(eventDbPath)) {
    return null;
  }

  const eventDb = new Database(eventDbPath);
  eventDb.exec("PRAGMA busy_timeout = 1000;");
  if (options.ensureConfigTable) {
    eventDb.exec(
      "CREATE TABLE IF NOT EXISTS config (key TEXT NOT NULL PRIMARY KEY, value TEXT)"
    );
  }
  return eventDb;
};

export const getDisplayTextSettings = (
  eventCode: string
): DisplayTextSettings => {
  const eventDb = openEventDb(eventCode, { ensureConfigTable: false });
  if (!eventDb) {
    return DEFAULT_DISPLAY_TEXT_SETTINGS;
  }

  try {
    const configTable = eventDb
      .query(
        "SELECT 1 AS has_table FROM sqlite_master WHERE type = 'table' AND name = 'config' LIMIT 1"
      )
      .get() as { has_table?: number } | null;
    if (!configTable?.has_table) {
      return DEFAULT_DISPLAY_TEXT_SETTINGS;
    }

    const row = eventDb
      .query("SELECT value AS value FROM config WHERE key = ? LIMIT 1")
      .get(DISPLAY_TEXT_SETTINGS_CONFIG_KEY) as { value?: string } | null;
    if (!row?.value) {
      return DEFAULT_DISPLAY_TEXT_SETTINGS;
    }
    return normalizeDisplayTextSettings(JSON.parse(row.value));
  } catch {
    return DEFAULT_DISPLAY_TEXT_SETTINGS;
  } finally {
    eventDb.close();
  }
};

export const saveDisplayTextSettings = (
  eventCode: string,
  settings: DisplayTextSettings
): DisplayTextSettings => {
  const eventDb = openEventDb(eventCode, { ensureConfigTable: true });
  if (!eventDb) {
    throw new Error(`Event database for "${eventCode}" was not found.`);
  }

  try {
    const normalized = normalizeDisplayTextSettings(settings);
    eventDb
      .query(
        "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run(DISPLAY_TEXT_SETTINGS_CONFIG_KEY, JSON.stringify(normalized));
    return normalized;
  } finally {
    eventDb.close();
  }
};
