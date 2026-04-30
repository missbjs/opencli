import { defineBundledChannelEntry } from "opencli/plugin-sdk/channel-entry-contract";

export default defineBundledChannelEntry({
  id: "synology-chat",
  name: "Synology Chat",
  description: "Native Synology Chat channel plugin for OpenCLI",
  importMetaUrl: import.meta.url,
  plugin: {
    specifier: "./channel-plugin-api.js",
    exportName: "synologyChatPlugin",
  },
  runtime: {
    specifier: "./api.js",
    exportName: "setSynologyRuntime",
  },
});
