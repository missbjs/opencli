import type { OpenCLIConfig } from "../config/types.opencli.js";
import {
  resolveCommandConversationResolution,
  type ResolveCommandConversationResolutionInput,
} from "./conversation-resolution.js";

export type ConversationBindingContext = {
  channel: string;
  accountId: string;
  conversationId: string;
  parentConversationId?: string;
  threadId?: string;
};

export type ResolveConversationBindingContextInput = Omit<
  ResolveCommandConversationResolutionInput,
  "includePlacementHint"
> & {
  cfg: OpenCLIConfig;
};

export function resolveConversationBindingContext(
  params: ResolveConversationBindingContextInput,
): ConversationBindingContext | null {
  const resolution = resolveCommandConversationResolution({
    ...params,
    includePlacementHint: false,
  });
  if (!resolution) {
    return null;
  }
  return {
    channel: resolution.canonical.channel,
    accountId: resolution.canonical.accountId,
    conversationId: resolution.canonical.conversationId,
    ...(resolution.canonical.parentConversationId
      ? { parentConversationId: resolution.canonical.parentConversationId }
      : {}),
    ...(resolution.threadId ? { threadId: resolution.threadId } : {}),
  };
}
