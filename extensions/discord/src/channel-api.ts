export { DEFAULT_ACCOUNT_ID } from "opencli/plugin-sdk/account-id";
export {
  buildTokenChannelStatusSummary,
  PAIRING_APPROVED_MESSAGE,
  projectCredentialSnapshotFields,
  resolveConfiguredFromCredentialStatuses,
} from "opencli/plugin-sdk/channel-status";
export { createScopedChannelConfigAdapter } from "opencli/plugin-sdk/channel-config-helpers";
export type { ChannelPlugin } from "opencli/plugin-sdk/channel-core";
export type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";

const DISCORD_CHANNEL_META = {
  id: "discord",
  label: "Discord",
  selectionLabel: "Discord (Bot API)",
  detailLabel: "Discord Bot",
  docsPath: "/channels/discord",
  docsLabel: "discord",
  blurb: "very well supported right now.",
  systemImage: "bubble.left.and.bubble.right",
  markdownCapable: true,
} as const;

export function getChatChannelMeta(id: string) {
  if (id !== DISCORD_CHANNEL_META.id) {
    throw new Error(`Unsupported Discord channel meta lookup: ${id}`);
  }
  return DISCORD_CHANNEL_META;
}
