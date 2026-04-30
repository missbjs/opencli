import {
  expectOpenCLILiveTranscriptMarker,
  normalizeTranscriptForMatch,
  OPENCLI_LIVE_TRANSCRIPT_MARKER_RE,
} from "opencli/plugin-sdk/provider-test-contracts";
import { describe, expect, it } from "vitest";

describe("normalizeTranscriptForMatch", () => {
  it("normalizes punctuation and common OpenCLI live transcription variants", () => {
    expect(normalizeTranscriptForMatch("Open-Claw integration OK")).toBe("opencliintegrationok");
    expect(normalizeTranscriptForMatch("Testing OpenFlaw realtime transcription")).toMatch(
      /open(?:claw|flaw)/,
    );
    expect(normalizeTranscriptForMatch("OpenCore xAI realtime transcription")).toMatch(
      OPENCLI_LIVE_TRANSCRIPT_MARKER_RE,
    );
    expect(normalizeTranscriptForMatch("OpenCL xAI realtime transcription")).toMatch(
      OPENCLI_LIVE_TRANSCRIPT_MARKER_RE,
    );
    expectOpenCLILiveTranscriptMarker("OpenClar integration OK");
  });
});
