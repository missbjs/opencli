import { describe, expect, it } from "vitest";
import { shortenText } from "./text-format.js";

describe("shortenText", () => {
  it("returns original text when it fits", () => {
    expect(shortenText("opencli", 16)).toBe("opencli");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(shortenText("opencli-status-output", 10)).toBe("opencli-…");
  });

  it("counts multi-byte characters correctly", () => {
    expect(shortenText("hello🙂world", 7)).toBe("hello🙂…");
  });
});
