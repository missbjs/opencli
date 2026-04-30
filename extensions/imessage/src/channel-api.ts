import { formatTrimmedAllowFromEntries } from "opencli/plugin-sdk/channel-config-helpers";
import type { ChannelStatusIssue } from "opencli/plugin-sdk/channel-contract";
import { PAIRING_APPROVED_MESSAGE } from "opencli/plugin-sdk/channel-status";
import {
  DEFAULT_ACCOUNT_ID,
  getChatChannelMeta,
  type ChannelPlugin,
  type OpenCLIConfig,
} from "opencli/plugin-sdk/core";
import { resolveChannelMediaMaxBytes } from "opencli/plugin-sdk/media-runtime";
import { collectStatusIssuesFromLastError } from "opencli/plugin-sdk/status-helpers";
import {
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
} from "./config-accessors.js";
import { looksLikeIMessageTargetId, normalizeIMessageMessagingTarget } from "./normalize.js";
export { chunkTextForOutbound } from "opencli/plugin-sdk/text-chunking";

export {
  collectStatusIssuesFromLastError,
  DEFAULT_ACCOUNT_ID,
  formatTrimmedAllowFromEntries,
  getChatChannelMeta,
  looksLikeIMessageTargetId,
  normalizeIMessageMessagingTarget,
  PAIRING_APPROVED_MESSAGE,
  resolveChannelMediaMaxBytes,
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
};

export type { ChannelPlugin, ChannelStatusIssue, OpenCLIConfig };
