import { describe, it, expect } from "vitest";
import { KNOWN_REPORT_COMMANDS, COMMAND_PAYLOAD_VALIDATORS } from "../report-parser.js";

describe("report parser command validator map", () => {
  it("has validators for every known command", () => {
    expect(Object.keys(COMMAND_PAYLOAD_VALIDATORS).sort()).toEqual(
      [...KNOWN_REPORT_COMMANDS].sort()
    );
  });

  it("validates diff payload via map", () => {
    const validateDiff = COMMAND_PAYLOAD_VALIDATORS.diff;
    expect(validateDiff({ schemaVersion: 1, command: "diff", targets: [], sourceNames: [] })).toBe(
      true
    );
    expect(validateDiff({ schemaVersion: 1, command: "diff", targets: [] })).toBe(false);
  });
});
