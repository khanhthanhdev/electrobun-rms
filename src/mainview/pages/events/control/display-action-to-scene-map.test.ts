import { describe, expect, it } from "bun:test";
import { getSceneForAction } from "./display-action-to-scene-map";

describe("getSceneForAction", () => {
  it("returns match-preview for show-preview action", () => {
    expect(getSceneForAction("show-preview")).toBe("match-preview");
  });

  it("returns match-start for show-match action", () => {
    expect(getSceneForAction("show-match")).toBe("match-start");
  });

  it("returns match-start for start-match action", () => {
    expect(getSceneForAction("start-match")).toBe("match-start");
  });

  it("returns match-winner for show-results action", () => {
    expect(getSceneForAction("show-results")).toBe("match-winner");
  });

  it("returns blank for show-blank action", () => {
    expect(getSceneForAction("show-blank")).toBe("blank");
  });

  it("returns ranking-result for show-ranking action", () => {
    expect(getSceneForAction("show-ranking")).toBe("ranking-result");
  });

  it("returns robot-inspection-status for show-inspection action", () => {
    expect(getSceneForAction("show-inspection")).toBe(
      "robot-inspection-status"
    );
  });

  it("returns text-notification for show-message action", () => {
    expect(getSceneForAction("show-message")).toBe("text-notification");
  });

  it("returns sponsors for show-sponsors action", () => {
    expect(getSceneForAction("show-sponsors")).toBe("sponsors");
  });
});
