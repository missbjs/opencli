import { describe, expect, it } from "vitest";
import {
  parseArgs,
  validateOpenCLIPackageSpec,
} from "../../scripts/resolve-opencli-package-candidate.mjs";

describe("resolve-opencli-package-candidate", () => {
  it("accepts only OpenCLI release package specs for npm candidates", () => {
    expect(() => validateOpenCLIPackageSpec("opencli@beta")).not.toThrow();
    expect(() => validateOpenCLIPackageSpec("opencli@latest")).not.toThrow();
    expect(() => validateOpenCLIPackageSpec("opencli@2026.4.27")).not.toThrow();
    expect(() => validateOpenCLIPackageSpec("opencli@2026.4.27-1")).not.toThrow();
    expect(() => validateOpenCLIPackageSpec("opencli@2026.4.27-beta.2")).not.toThrow();

    expect(() => validateOpenCLIPackageSpec("@evil/opencli@1.0.0")).toThrow(
      "package_spec must be opencli@beta",
    );
    expect(() => validateOpenCLIPackageSpec("opencli@canary")).toThrow(
      "package_spec must be opencli@beta",
    );
    expect(() => validateOpenCLIPackageSpec("opencli@2026.04.27")).toThrow(
      "package_spec must be opencli@beta",
    );
  });

  it("parses optional empty workflow inputs without rejecting the command line", () => {
    expect(
      parseArgs([
        "--source",
        "npm",
        "--package-ref",
        "release/2026.4.27",
        "--package-spec",
        "opencli@beta",
        "--package-url",
        "",
        "--package-sha256",
        "",
        "--artifact-dir",
        ".",
        "--output-dir",
        ".artifacts/docker-e2e-package",
      ]),
    ).toMatchObject({
      artifactDir: ".",
      outputDir: ".artifacts/docker-e2e-package",
      packageSha256: "",
      packageRef: "release/2026.4.27",
      packageSpec: "opencli@beta",
      packageUrl: "",
      source: "npm",
    });
  });
});
