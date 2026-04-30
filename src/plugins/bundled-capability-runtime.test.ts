import { describe, expect, it } from "vitest";
import { buildVitestCapabilityShimAliasMap } from "./bundled-capability-runtime.js";

describe("buildVitestCapabilityShimAliasMap", () => {
  it("keeps scoped and unscoped capability shim aliases aligned", () => {
    const aliasMap = buildVitestCapabilityShimAliasMap();

    expect(aliasMap["opencli/plugin-sdk/config-runtime"]).toBe(
      aliasMap["@opencli/plugin-sdk/config-runtime"],
    );
    expect(aliasMap["opencli/plugin-sdk/media-runtime"]).toBe(
      aliasMap["@opencli/plugin-sdk/media-runtime"],
    );
    expect(aliasMap["opencli/plugin-sdk/provider-onboard"]).toBe(
      aliasMap["@opencli/plugin-sdk/provider-onboard"],
    );
    expect(aliasMap["opencli/plugin-sdk/speech-core"]).toBe(
      aliasMap["@opencli/plugin-sdk/speech-core"],
    );
  });
});
