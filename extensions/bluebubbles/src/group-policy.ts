import {
  resolveChannelGroupRequireMention,
  resolveChannelGroupToolsPolicy,
  type GroupToolPolicyConfig,
} from "opencli/plugin-sdk/channel-policy";
import type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";

type BlueBubblesGroupContext = {
  cfg: OpenCLIConfig;
  accountId?: string | null;
  groupId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  senderUsername?: string | null;
  senderE164?: string | null;
};

export function resolveBlueBubblesGroupRequireMention(params: BlueBubblesGroupContext): boolean {
  return resolveChannelGroupRequireMention({
    cfg: params.cfg,
    channel: "bluebubbles",
    groupId: params.groupId,
    accountId: params.accountId,
  });
}

export function resolveBlueBubblesGroupToolPolicy(
  params: BlueBubblesGroupContext,
): GroupToolPolicyConfig | undefined {
  return resolveChannelGroupToolsPolicy({
    cfg: params.cfg,
    channel: "bluebubbles",
    groupId: params.groupId,
    accountId: params.accountId,
    senderId: params.senderId,
    senderName: params.senderName,
    senderUsername: params.senderUsername,
    senderE164: params.senderE164,
  });
}
