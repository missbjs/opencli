import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createTuiCommand } from "./src/commands.js";
import { handleTuiInboundClaim } from "./src/inbound-claim.js";

export default definePluginEntry({
  id: "tui-bridge",
  name: "TUI Bridge",
  description:
    "Bind a chat conversation to a long-lived TUI process. User text is piped to the process's stdin; screen output (raw or xterm-rendered) is returned as chat replies.",
  register(api) {
    api.registerCommand(createTuiCommand({ pluginConfig: api.pluginConfig }));
    api.on("inbound_claim", (event, ctx) =>
      handleTuiInboundClaim(event, ctx, { pluginConfig: api.pluginConfig }),
    );
  },
});
