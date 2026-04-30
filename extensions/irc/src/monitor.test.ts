import { describe, expect, it } from "vitest";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#opencli",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#opencli",
      rawTarget: "#opencli",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "opencli-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "opencli-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "opencli-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "opencli-bot",
      rawTarget: "opencli-bot",
    });
  });
});
