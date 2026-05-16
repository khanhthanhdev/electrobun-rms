import {
  DEFAULT_DISPLAY_TEXT_SETTINGS,
  DISPLAY_CUSTOM_HEADER_MAX_LENGTH,
  DISPLAY_FOOTER_MAX_LENGTH,
  DISPLAY_FOOTER_FONT_SIZE_MAX,
  DISPLAY_FOOTER_FONT_SIZE_MIN,
  DISPLAY_HEADER_FONT_SIZE_MAX,
  DISPLAY_HEADER_FONT_SIZE_MIN,
  type DisplayHeaderMode,
  type DisplayTextSettings,
} from "@shared/display";
import { useCallback, useEffect, useState } from "react";
import { publishDisplayCommand } from "@/features/display/display-command-channel";
import {
  fetchDisplayTextSettings,
  saveDisplayTextSettingsRequest,
} from "@/features/display/display-text-settings-service";
import { getSceneForAction } from "./display-action-to-scene-map";

interface MatchControlSettings {
  allowExtRandomization: boolean;
  enableHrControl: boolean;
  enablePenaltyTablets: boolean;
  flipAlliances: boolean;
  requireRefInit: boolean;
  useLiveScoring: boolean;
}

const MATCH_CONTROL_SETTINGS_KEY = "match-control-settings";

const DEFAULT_SETTINGS: MatchControlSettings = {
  allowExtRandomization: false,
  enableHrControl: false,
  enablePenaltyTablets: false,
  flipAlliances: false,
  requireRefInit: false,
  useLiveScoring: true,
};

const loadMatchControlSettings = (): MatchControlSettings => {
  try {
    const raw = localStorage.getItem(MATCH_CONTROL_SETTINGS_KEY);
    return raw
      ? {
          ...DEFAULT_SETTINGS,
          ...(JSON.parse(raw) as Partial<MatchControlSettings>),
        }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const saveMatchControlSettings = (s: MatchControlSettings): void => {
  try {
    localStorage.setItem(MATCH_CONTROL_SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

const clampNumber = (
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
): number =>
  Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value as number)))
    : fallback;

const normalizeFormSettings = (
  settings: DisplayTextSettings
): DisplayTextSettings => ({
  headerMode: settings.headerMode,
  customHeaderText: settings.customHeaderText.slice(
    0,
    DISPLAY_CUSTOM_HEADER_MAX_LENGTH
  ),
  headerFontSize: clampNumber(
    settings.headerFontSize,
    DISPLAY_HEADER_FONT_SIZE_MIN,
    DISPLAY_HEADER_FONT_SIZE_MAX,
    DEFAULT_DISPLAY_TEXT_SETTINGS.headerFontSize
  ),
  headerColor: settings.headerColor || DEFAULT_DISPLAY_TEXT_SETTINGS.headerColor,
  footerText: settings.footerText.slice(0, DISPLAY_FOOTER_MAX_LENGTH),
  footerFontSize: clampNumber(
    settings.footerFontSize,
    DISPLAY_FOOTER_FONT_SIZE_MIN,
    DISPLAY_FOOTER_FONT_SIZE_MAX,
    DEFAULT_DISPLAY_TEXT_SETTINGS.footerFontSize
  ),
  footerColor: settings.footerColor || DEFAULT_DISPLAY_TEXT_SETTINGS.footerColor,
});

const parseFontSizeInput = (
  value: string,
  min: number,
  max: number,
  fallback: number
): number => {
  const parsed = Number.parseFloat(value);
  return clampNumber(parsed, min, max, fallback);
};

export const MatchControlSettingsPanel = ({
  eventCode,
  token,
}: {
  eventCode: string;
  token: string | null;
}): JSX.Element => {
  const [settings, setSettings] = useState<MatchControlSettings>(
    loadMatchControlSettings
  );
  const [displaySettings, setDisplaySettings] = useState<DisplayTextSettings>(
    DEFAULT_DISPLAY_TEXT_SETTINGS
  );
  const [headerFontSizeInput, setHeaderFontSizeInput] = useState(
    String(DEFAULT_DISPLAY_TEXT_SETTINGS.headerFontSize)
  );
  const [footerFontSizeInput, setFooterFontSizeInput] = useState(
    String(DEFAULT_DISPLAY_TEXT_SETTINGS.footerFontSize)
  );
  const [displayStatus, setDisplayStatus] = useState("");
  const [isDisplayLoading, setIsDisplayLoading] = useState(true);
  const [isDisplaySaving, setIsDisplaySaving] = useState(false);

  useEffect(() => {
    saveMatchControlSettings(settings);
  }, [settings]);

  useEffect(() => {
    let isCurrent = true;
    setIsDisplayLoading(true);
    fetchDisplayTextSettings(eventCode)
      .then((loaded) => {
        if (isCurrent) {
          const normalized = normalizeFormSettings(loaded);
          setDisplaySettings(normalized);
          setHeaderFontSizeInput(String(normalized.headerFontSize));
          setFooterFontSizeInput(String(normalized.footerFontSize));
          setDisplayStatus("");
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setDisplayStatus(
            error instanceof Error
              ? error.message
              : "Unable to load display text settings."
          );
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsDisplayLoading(false);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [eventCode]);

  const update = useCallback(
    (key: keyof MatchControlSettings, value: boolean) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateDisplayText = useCallback(
    (patch: Partial<DisplayTextSettings>) => {
      setDisplaySettings((prev) => normalizeFormSettings({ ...prev, ...patch }));
      setDisplayStatus("");
    },
    []
  );

  const saveAudienceDisplayText = useCallback(async () => {
    setIsDisplaySaving(true);
    setDisplayStatus("");
    try {
      const settingsToSave = normalizeFormSettings({
        ...displaySettings,
        headerFontSize: parseFontSizeInput(
          headerFontSizeInput,
          DISPLAY_HEADER_FONT_SIZE_MIN,
          DISPLAY_HEADER_FONT_SIZE_MAX,
          displaySettings.headerFontSize
        ),
        footerFontSize: parseFontSizeInput(
          footerFontSizeInput,
          DISPLAY_FOOTER_FONT_SIZE_MIN,
          DISPLAY_FOOTER_FONT_SIZE_MAX,
          displaySettings.footerFontSize
        ),
      });
      const saved = await saveDisplayTextSettingsRequest(
        eventCode,
        settingsToSave,
        token
      );
      const normalized = normalizeFormSettings(saved);
      setDisplaySettings(normalized);
      setHeaderFontSizeInput(String(normalized.headerFontSize));
      setFooterFontSizeInput(String(normalized.footerFontSize));
      setDisplayStatus("Saved");
    } catch (error) {
      setDisplayStatus(
        error instanceof Error ? error.message : "Unable to save display text."
      );
    } finally {
      setIsDisplaySaving(false);
    }
  }, [
    displaySettings,
    eventCode,
    footerFontSizeInput,
    headerFontSizeInput,
    token,
  ]);

  const resetAudienceDisplayText = useCallback(() => {
    updateDisplayText(DEFAULT_DISPLAY_TEXT_SETTINGS);
    setHeaderFontSizeInput(
      String(DEFAULT_DISPLAY_TEXT_SETTINGS.headerFontSize)
    );
    setFooterFontSizeInput(
      String(DEFAULT_DISPLAY_TEXT_SETTINGS.footerFontSize)
    );
  }, [updateDisplayText]);

  const disabled = isDisplayLoading || isDisplaySaving;

  return (
    <div className="match-control-settings-panel">
      <div className="match-control-settings-group">
        <h3 className="match-control-settings-group-title">
          Live Scoring Options
        </h3>
        {(
          [
            ["useLiveScoring", "Use Live Scoring"],
            ["requireRefInit", "Require Referee Init Submit Before Start"],
            ["enablePenaltyTablets", "Enable Penalty Referee Tablets"],
            ["enableHrControl", "Enable HR Match Control (Beta)"],
            ["allowExtRandomization", "Allow External Randomization"],
          ] as Array<[keyof MatchControlSettings, string]>
        ).map(([key, label]) => (
          <div className="match-control-setting-row" key={key}>
            <span className="match-control-setting-label">{label}</span>
            <input
              checked={settings[key]}
              onChange={(e) => update(key, e.target.checked)}
              type="checkbox"
            />
          </div>
        ))}
      </div>

      <div className="match-control-settings-group">
        <h3 className="match-control-settings-group-title">
          Control Page Appearance
        </h3>
        <div className="match-control-setting-row">
          <span className="match-control-setting-label">Flip Alliances</span>
          <input
            checked={settings.flipAlliances}
            onChange={(e) => update("flipAlliances", e.target.checked)}
            type="checkbox"
          />
        </div>
      </div>

      <div className="match-control-settings-group">
        <h3 className="match-control-settings-group-title">
          Audience Display Text
        </h3>
        <label className="match-control-setting-field">
          <span className="match-control-setting-label">Header Mode</span>
          <select
            disabled={disabled}
            onChange={(e) =>
              updateDisplayText({
                headerMode: e.target.value as DisplayHeaderMode,
              })
            }
            value={displaySettings.headerMode}
          >
            <option value="default">Default scene headers</option>
            <option value="custom">Custom header text</option>
          </select>
        </label>
        <label className="match-control-setting-field">
          <span className="match-control-setting-label">Custom Header Text</span>
          <input
            disabled={disabled}
            maxLength={DISPLAY_CUSTOM_HEADER_MAX_LENGTH}
            onChange={(e) =>
              updateDisplayText({
                customHeaderText: e.target.value,
                headerMode: e.target.value.trim()
                  ? "custom"
                  : displaySettings.headerMode,
              })
            }
            type="text"
            value={displaySettings.customHeaderText}
          />
        </label>
        <div className="match-control-setting-grid">
          <label className="match-control-setting-field">
            <span className="match-control-setting-label">
              Header Font Size
            </span>
            <input
              disabled={disabled}
              inputMode="numeric"
              max={DISPLAY_HEADER_FONT_SIZE_MAX}
              min={DISPLAY_HEADER_FONT_SIZE_MIN}
              onBlur={() => {
                const normalized = parseFontSizeInput(
                  headerFontSizeInput,
                  DISPLAY_HEADER_FONT_SIZE_MIN,
                  DISPLAY_HEADER_FONT_SIZE_MAX,
                  displaySettings.headerFontSize
                );
                setHeaderFontSizeInput(String(normalized));
                updateDisplayText({ headerFontSize: normalized });
              }}
              onChange={(e) => {
                const value = e.target.value;
                setHeaderFontSizeInput(value);
                if (value.trim()) {
                  updateDisplayText({ headerFontSize: Number(value) });
                } else {
                  setDisplayStatus("");
                }
              }}
              type="text"
              value={headerFontSizeInput}
            />
          </label>
          <label className="match-control-setting-field">
            <span className="match-control-setting-label">Header Color</span>
            <input
              disabled={disabled}
              onChange={(e) =>
                updateDisplayText({ headerColor: e.target.value })
              }
              type="color"
              value={displaySettings.headerColor}
            />
          </label>
        </div>
        <label className="match-control-setting-field">
          <span className="match-control-setting-label">Footer Text</span>
          <input
            disabled={disabled}
            maxLength={DISPLAY_FOOTER_MAX_LENGTH}
            onChange={(e) => updateDisplayText({ footerText: e.target.value })}
            type="text"
            value={displaySettings.footerText}
          />
        </label>
        <div className="match-control-setting-grid">
          <label className="match-control-setting-field">
            <span className="match-control-setting-label">
              Footer Font Size
            </span>
            <input
              disabled={disabled}
              inputMode="numeric"
              max={DISPLAY_FOOTER_FONT_SIZE_MAX}
              min={DISPLAY_FOOTER_FONT_SIZE_MIN}
              onBlur={() => {
                const normalized = parseFontSizeInput(
                  footerFontSizeInput,
                  DISPLAY_FOOTER_FONT_SIZE_MIN,
                  DISPLAY_FOOTER_FONT_SIZE_MAX,
                  displaySettings.footerFontSize
                );
                setFooterFontSizeInput(String(normalized));
                updateDisplayText({ footerFontSize: normalized });
              }}
              onChange={(e) => {
                const value = e.target.value;
                setFooterFontSizeInput(value);
                if (value.trim()) {
                  updateDisplayText({ footerFontSize: Number(value) });
                } else {
                  setDisplayStatus("");
                }
              }}
              type="text"
              value={footerFontSizeInput}
            />
          </label>
          <label className="match-control-setting-field">
            <span className="match-control-setting-label">Footer Color</span>
            <input
              disabled={disabled}
              onChange={(e) =>
                updateDisplayText({ footerColor: e.target.value })
              }
              type="color"
              value={displaySettings.footerColor}
            />
          </label>
        </div>
        <div className="match-control-display-buttons">
          <button
            className="button"
            disabled={disabled}
            onClick={saveAudienceDisplayText}
            type="button"
          >
            {isDisplaySaving ? "Saving..." : "Save Display Text"}
          </button>
          <button
            className="button button-secondary"
            disabled={disabled}
            onClick={resetAudienceDisplayText}
            type="button"
          >
            Reset to Defaults
          </button>
        </div>
        {displayStatus ? (
          <p className="match-control-setting-hint">{displayStatus}</p>
        ) : null}
      </div>

      <div className="match-control-settings-group">
        <h3 className="match-control-settings-group-title">
          Set Audience Display
        </h3>
        <p className="match-control-setting-hint">
          Switch the audience display to these modes (same browser/device).
        </p>
        <div className="match-control-display-buttons">
          <button
            className="button"
            onClick={() =>
              publishDisplayCommand(
                eventCode,
                { mode: getSceneForAction("show-blank") },
                token
              )
            }
            type="button"
          >
            Show Blank Screen
          </button>
          <button
            className="button"
            onClick={() =>
              publishDisplayCommand(
                eventCode,
                { mode: getSceneForAction("show-ranking") },
                token
              )
            }
            type="button"
          >
            Show Ranks &amp; Results
          </button>
          <button
            className="button"
            onClick={() =>
              publishDisplayCommand(
                eventCode,
                { mode: getSceneForAction("show-inspection") },
                token
              )
            }
            type="button"
          >
            Show Inspection Status
          </button>
          <button
            className="button"
            onClick={() =>
              publishDisplayCommand(
                eventCode,
                {
                  mode: getSceneForAction("show-message"),
                  message: "Wait for next match",
                },
                token
              )
            }
            type="button"
          >
            Show Message
          </button>
          <button
            className="button"
            onClick={() =>
              publishDisplayCommand(
                eventCode,
                { mode: getSceneForAction("show-sponsors") },
                token
              )
            }
            type="button"
          >
            Show Sponsors
          </button>
        </div>
      </div>
    </div>
  );
};
