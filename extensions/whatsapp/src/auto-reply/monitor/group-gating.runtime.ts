export {
  implicitMentionKindWhen,
  resolveInboundMentionDecision,
} from "opencli/plugin-sdk/channel-mention-gating";
export { hasControlCommand } from "opencli/plugin-sdk/command-detection";
export { recordPendingHistoryEntryIfEnabled } from "opencli/plugin-sdk/reply-history";
export { parseActivationCommand } from "opencli/plugin-sdk/group-activation";
export { normalizeE164 } from "../../text-runtime.js";
