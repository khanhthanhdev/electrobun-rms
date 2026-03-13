import { describe, expect, it } from "bun:test";
import { safeParse } from "valibot";
import {
  EVENT_CODE_VALIDATION_MESSAGE,
  isValidEventCode,
} from "../common/patterns";
import { manualEventBodySchema } from "./events.schema";

const validManualEventPayload = {
  divisions: 1,
  endDate: "2026-03-12",
  eventCode: "Nrc2026",
  eventName: "NRC Event",
  eventType: 1,
  fields: 1,
  region: "Vietnam",
  startDate: "2026-03-11",
};

describe("event code validation", () => {
  it("accepts 1-8 mixed-case alphanumeric event codes", () => {
    expect(isValidEventCode("A")).toBe(true);
    expect(isValidEventCode("Nrc2026")).toBe(true);
    expect(isValidEventCode("nrc2026")).toBe(true);
  });

  it("rejects empty, overlong, and special-character event codes", () => {
    expect(isValidEventCode("")).toBe(false);
    expect(isValidEventCode("Nrc20267X")).toBe(false);
    expect(isValidEventCode("NRC_1")).toBe(false);
    expect(isValidEventCode("NRC-1")).toBe(false);
  });

  it("trims manual event codes without changing their case", () => {
    const result = safeParse(manualEventBodySchema, {
      ...validManualEventPayload,
      eventCode: "  nRc2026  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.eventCode).toBe("nRc2026");
    }
  });

  it("returns the shared validation message once for invalid manual event codes", () => {
    const result = safeParse(manualEventBodySchema, {
      ...validManualEventPayload,
      eventCode: "",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.message).toBe(EVENT_CODE_VALIDATION_MESSAGE);
  });
});
