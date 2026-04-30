import { describe, expect, it } from "vitest";
import { isOpenCLIManagedMatrixDevice, summarizeMatrixDeviceHealth } from "./device-health.js";

describe("matrix device health", () => {
  it("detects OpenCLI-managed device names", () => {
    expect(isOpenCLIManagedMatrixDevice("OpenCLI Gateway")).toBe(true);
    expect(isOpenCLIManagedMatrixDevice("OpenCLI Debug")).toBe(true);
    expect(isOpenCLIManagedMatrixDevice("Element iPhone")).toBe(false);
    expect(isOpenCLIManagedMatrixDevice(null)).toBe(false);
  });

  it("summarizes stale OpenCLI-managed devices separately from the current device", () => {
    const summary = summarizeMatrixDeviceHealth([
      {
        deviceId: "du314Zpw3A",
        displayName: "OpenCLI Gateway",
        current: true,
      },
      {
        deviceId: "BritdXC6iL",
        displayName: "OpenCLI Gateway",
        current: false,
      },
      {
        deviceId: "G6NJU9cTgs",
        displayName: "OpenCLI Debug",
        current: false,
      },
      {
        deviceId: "phone123",
        displayName: "Element iPhone",
        current: false,
      },
    ]);

    expect(summary.currentDeviceId).toBe("du314Zpw3A");
    expect(summary.currentOpenCLIDevices).toEqual([
      expect.objectContaining({ deviceId: "du314Zpw3A" }),
    ]);
    expect(summary.staleOpenCLIDevices).toEqual([
      expect.objectContaining({ deviceId: "BritdXC6iL" }),
      expect.objectContaining({ deviceId: "G6NJU9cTgs" }),
    ]);
  });
});
