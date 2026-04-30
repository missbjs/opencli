import { resolveSendableOutboundReplyParts } from "openclaw/plugin-sdk/reply-payload";
import { isParentOwnedBackgroundAcpSession } from "../../acp/session-interaction-mode.js";
import { resolveAgentWorkspaceDir, resolveSessionAgentId } from "../../agents/agent-scope.js";
import {
  resolveConversationBindingRecord,
  touchConversationBindingRecord,
} from "../../bindings/records.js";
import { normalizeChatType } from "../../channels/chat-type.js";
import { parseSessionThreadInfoFast } from "../../config/sessions/thread-info.js";
import type { SessionEntry } from "../../config/sessions/types.js";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import { logVerbose } from "../../globals.js";
import { fireAndForgetHook } from "../../hooks/fire-and-forget.js";
import {
  deriveInboundMessageHookContext,
  toPluginInboundClaimContext,
  toPluginInboundClaimEvent,
  toInternalMessageReceivedContext,
  toPluginMessageContext,
  toPluginMessageReceivedEvent,
} from "../../hooks/message-hook-mappers.js";
import { isDiagnosticsEnabled } from "../../infra/diagnostic-events.js";
import { getSessionBindingService } from "../../infra/outbound/session-binding-service.js";
import {
  logMessageProcessed,
  logMessageQueued,
  logSessionStateChange,
} from "../../logging/diagnostic.js";
import {
  buildPluginBindingDeclinedText,
  buildPluginBindingErrorText,
  buildPluginBindingUnavailableText,
  hasShownPluginBindingFallbackNotice,
  isPluginOwnedSessionBindingRecord,
  markPluginBindingFallbackNoticeShown,
  toPluginConversationBinding,
} from "../../plugins/conversation-binding.js";
import { getGlobalHookRunner, getGlobalPluginRegistry } from "../../plugins/hook-runner-global.js";
import { isAcpSessionKey } from "../../routing/session-key.js";
import { resolveSendPolicy } from "../../sessions/send-policy.js";
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalLowercaseString,
  normalizeOptionalString,
} from "../../shared/string-coerce.js";
import { normalizeTtsAutoMode, shouldAttemptTtsPayload } from "../../tts/tts-config.js";
import { INTERNAL_MESSAGE_CHANNEL, normalizeMessageChannel } from "../../utils/message-channel.js";
import { type ReplyPayload } from "../reply-payload.js";
import type { FinalizedMsgContext } from "../templating.js";
import { resolveConversationBindingContextFromMessage } from "./conversation-binding-input.js";
import {
  createInternalHookEvent,
  loadSessionStore,
  resolveSessionStoreEntry,
  resolveStorePath,
  triggerInternalHook,
} from "./dispatch-from-config.runtime.js";
import type {
  DispatchFromConfigParams,
  DispatchFromConfigResult,
} from "./dispatch-from-config.types.js";
import { resolveEffectiveReplyRoute } from "./effective-reply-route.js";
import { claimInboundDedupe, commitInboundDedupe, releaseInboundDedupe } from "./inbound-dedupe.js";
import { resolveReplyRoutingDecision } from "./routing-policy.js";
import { resolveSourceReplyVisibilityPolicy } from "./source-reply-delivery-mode.js";

let routeReplyRuntimePromise: Promise<typeof import("./route-reply.runtime.js")> | null = null;
let abortRuntimePromise: Promise<typeof import("./abort.runtime.js")> | null = null;
let ttsRuntimePromise: Promise<typeof import("../../tts/tts.runtime.js")> | null = null;
let runtimePluginsPromise: Promise<typeof import("./runtime-plugins.runtime.js")> | null = null;
let replyMediaPathsRuntimePromise: Promise<typeof import("./reply-media-paths.runtime.js")> | null =
  null;

function loadRouteReplyRuntime() {
  routeReplyRuntimePromise ??= import("./route-reply.runtime.js");
  return routeReplyRuntimePromise;
}

function loadAbortRuntime() {
  abortRuntimePromise ??= import("./abort.runtime.js");
  return abortRuntimePromise;
}

function loadTtsRuntime() {
  ttsRuntimePromise ??= import("../../tts/tts.runtime.js");
  return ttsRuntimePromise;
}

function loadRuntimePlugins() {
  runtimePluginsPromise ??= import("./runtime-plugins.runtime.js");
  return runtimePluginsPromise;
}

function loadReplyMediaPathsRuntime() {
  replyMediaPathsRuntimePromise ??= import("./reply-media-paths.runtime.js");
  return replyMediaPathsRuntimePromise;
}

async function maybeApplyTtsToReplyPayload(
  params: Parameters<Awaited<ReturnType<typeof loadTtsRuntime>>["maybeApplyTtsToPayload"]>[0],
) {
  if (
    !shouldAttemptTtsPayload({
      cfg: params.cfg,
      ttsAuto: params.ttsAuto,
      agentId: params.agentId,
      channelId: params.channel,
      accountId: params.accountId,
    })
  ) {
    return params.payload;
  }
  const { maybeApplyTtsToPayload } = await loadTtsRuntime();
  return maybeApplyTtsToPayload(params);
}

const AUDIO_PLACEHOLDER_RE = /^<media:audio>(\s*\([^)]*\))?$/i;
const AUDIO_HEADER_RE = /^\[Audio\b/i;
const normalizeMediaType = (value: string): string =>
  normalizeOptionalLowercaseString(value.split(";")[0]) ?? "";

const isInboundAudioContext = (ctx: FinalizedMsgContext): boolean => {
  const rawTypes = [
    typeof ctx.MediaType === "string" ? ctx.MediaType : undefined,
    ...(Array.isArray(ctx.MediaTypes) ? ctx.MediaTypes : []),
  ].filter(Boolean) as string[];
  const types = rawTypes.map((type) => normalizeMediaType(type));
  if (types.some((type) => type === "audio" || type.startsWith("audio/"))) {
    return true;
  }

  const body =
    typeof ctx.BodyForCommands === "string"
      ? ctx.BodyForCommands
      : typeof ctx.CommandBody === "string"
        ? ctx.CommandBody
        : typeof ctx.RawBody === "string"
          ? ctx.RawBody
          : typeof ctx.Body === "string"
            ? ctx.Body
            : "";
  const trimmed = body.trim();
  if (!trimmed) {
    return false;
  }
  if (AUDIO_PLACEHOLDER_RE.test(trimmed)) {
    return true;
  }
  return AUDIO_HEADER_RE.test(trimmed);
};

const resolveRoutedPolicyConversationType = (
  ctx: FinalizedMsgContext,
): "direct" | "group" | undefined => {
  if (
    ctx.CommandSource === "native" &&
    ctx.CommandTargetSessionKey &&
    ctx.CommandTargetSessionKey !== ctx.SessionKey
  ) {
    return undefined;
  }
  const chatType = normalizeChatType(ctx.ChatType);
  if (chatType === "direct") {
    return "direct";
  }
  if (chatType === "group" || chatType === "channel") {
    return "group";
  }
  return undefined;
};

const resolveSessionStoreLookup = (
  ctx: FinalizedMsgContext,
  cfg: OpenClawConfig,
): {
  sessionKey?: string;
  storePath?: string;
  entry?: SessionEntry;
} => {
  const targetSessionKey =
    ctx.CommandSource === "native"
      ? normalizeOptionalString(ctx.CommandTargetSessionKey)
      : undefined;
  const sessionKey = normalizeOptionalString(targetSessionKey ?? ctx.SessionKey);
  if (!sessionKey) {
    return {};
  }
  const agentId = resolveSessionAgentId({ sessionKey, config: cfg });
  const storePath = resolveStorePath(cfg.session?.store, { agentId });
  try {
    const store = loadSessionStore(storePath);
    return {
      sessionKey,
      storePath,
      entry: resolveSessionStoreEntry({ store, sessionKey }).existing,
    };
  } catch {
    return {
      sessionKey,
      storePath,
    };
  }
};

const resolveBoundAcpDispatchSessionKey = (params: {
  ctx: FinalizedMsgContext;
  cfg: OpenClawConfig;
}): string | undefined => {
  const bindingContext = resolveConversationBindingContextFromMessage({
    cfg: params.cfg,
    ctx: params.ctx,
  });
  if (!bindingContext) {
    return undefined;
  }

  const binding = getSessionBindingService().resolveByConversation({
    channel: bindingContext.channel,
    accountId: bindingContext.accountId,
    conversationId: bindingContext.conversationId,
    ...(bindingContext.parentConversationId
      ? { parentConversationId: bindingContext.parentConversationId }
      : {}),
  });
  const targetSessionKey = normalizeOptionalString(binding?.targetSessionKey);
  if (!binding || !targetSessionKey || !isAcpSessionKey(targetSessionKey)) {
    return undefined;
  }
  if (isPluginOwnedSessionBindingRecord(binding)) {
    return undefined;
  }
  getSessionBindingService().touch(binding.bindingId);
  return targetSessionKey;
};

export type {
  DispatchFromConfigParams,
  DispatchFromConfigResult,
} from "./dispatch-from-config.types.js";

export async function dispatchReplyFromConfig(
  params: DispatchFromConfigParams,
): Promise<DispatchFromConfigResult> {
  const { ctx, cfg, dispatcher } = params;
  const diagnosticsEnabled = isDiagnosticsEnabled(cfg);
  const channel = normalizeLowercaseStringOrEmpty(ctx.Surface ?? ctx.Provider ?? "unknown");
  const chatId = ctx.To ?? ctx.From;
  const messageId = ctx.MessageSid ?? ctx.MessageSidFirst ?? ctx.MessageSidLast;
  const sessionKey =
    normalizeOptionalString(ctx.SessionKey) ?? normalizeOptionalString(ctx.CommandTargetSessionKey);
  const startTime = diagnosticsEnabled ? Date.now() : 0;
  const canTrackSession = diagnosticsEnabled && Boolean(sessionKey);

  const recordProcessed = (
    outcome: "completed" | "skipped" | "error",
    opts?: {
      reason?: string;
      error?: string;
    },
  ) => {
    if (!diagnosticsEnabled) {
      return;
    }
    logMessageProcessed({
      channel,
      chatId,
      messageId,
      sessionKey,
      durationMs: Date.now() - startTime,
      outcome,
      reason: opts?.reason,
      error: opts?.error,
    });
  };

  const markProcessing = () => {
    if (!canTrackSession || !sessionKey) {
      return;
    }
    logMessageQueued({ sessionKey, channel, source: "dispatch" });
    logSessionStateChange({
      sessionKey,
      state: "processing",
      reason: "message_start",
    });
  };

  const markIdle = (reason: string) => {
    if (!canTrackSession || !sessionKey) {
      return;
    }
    logSessionStateChange({
      sessionKey,
      state: "idle",
      reason,
    });
  };

  const inboundDedupeClaim = claimInboundDedupe(ctx);
  if (inboundDedupeClaim.status === "duplicate" || inboundDedupeClaim.status === "inflight") {
    recordProcessed("skipped", { reason: "duplicate" });
    return { queuedFinal: false, counts: dispatcher.getQueuedCounts() };
  }
  let inboundDedupeReplayUnsafe = false;
  const markInboundDedupeReplayUnsafe = () => {
    inboundDedupeReplayUnsafe = true;
  };
  const commitInboundDedupeIfClaimed = () => {
    if (inboundDedupeClaim.status === "claimed") {
      commitInboundDedupe(inboundDedupeClaim.key);
    }
  };

  const initialSessionStoreEntry = resolveSessionStoreLookup(ctx, cfg);
  const boundAcpDispatchSessionKey = resolveBoundAcpDispatchSessionKey({ ctx, cfg });
  const acpDispatchSessionKey =
    boundAcpDispatchSessionKey ?? initialSessionStoreEntry.sessionKey ?? sessionKey;
  const sessionStoreEntry = boundAcpDispatchSessionKey
    ? resolveSessionStoreLookup({ ...ctx, SessionKey: boundAcpDispatchSessionKey }, cfg)
    : initialSessionStoreEntry;
  const sessionAgentId = resolveSessionAgentId({ sessionKey: acpDispatchSessionKey, config: cfg });
  const replyRoute = resolveEffectiveReplyRoute({ ctx, entry: sessionStoreEntry.entry });
  // Restore route thread context only from the active turn or the thread-scoped session key.
  // Do not read thread ids from the normalised session store here: `origin.threadId` can be
  // folded back into lastThreadId/deliveryContext during store normalisation and resurrect a
  // stale route after thread delivery was intentionally cleared.
  const routeThreadId =
    ctx.MessageThreadId ?? parseSessionThreadInfoFast(acpDispatchSessionKey).threadId;
  const inboundAudio = isInboundAudioContext(ctx);
  const sessionTtsAuto = normalizeTtsAutoMode(sessionStoreEntry.entry?.ttsAuto);
  const workspaceDir = resolveAgentWorkspaceDir(cfg, sessionAgentId);
  const { ensureRuntimePluginsLoaded } = await loadRuntimePlugins();
  ensureRuntimePluginsLoaded({ config: cfg, workspaceDir });
  const hookRunner = getGlobalHookRunner();

  // Extract message context for hooks (plugin and internal)
  const timestamp =
    typeof ctx.Timestamp === "number" && Number.isFinite(ctx.Timestamp) ? ctx.Timestamp : undefined;
  const messageIdForHook =
    ctx.MessageSidFull ?? ctx.MessageSid ?? ctx.MessageSidFirst ?? ctx.MessageSidLast;
  const hookContext = deriveInboundMessageHookContext(ctx, { messageId: messageIdForHook });
  const { isGroup, groupId } = hookContext;
  const inboundClaimContext = toPluginInboundClaimContext(hookContext);
  const inboundClaimEvent = toPluginInboundClaimEvent(hookContext, {
    commandAuthorized:
      typeof ctx.CommandAuthorized === "boolean" ? ctx.CommandAuthorized : undefined,
    wasMentioned: typeof ctx.WasMentioned === "boolean" ? ctx.WasMentioned : undefined,
  });

  // Check if we should route replies to originating channel instead of dispatcher.
  // Only route when the originating channel is DIFFERENT from the current surface.
  // This handles cross-provider routing (e.g., message from Telegram being processed
  // by a shared session that's currently on Slack) while preserving normal dispatcher
  // flow when the provider handles its own messages.
  //
  // Debug: `pnpm test src/auto-reply/reply/dispatch-from-config.test.ts`
  const suppressAcpChildUserDelivery = isParentOwnedBackgroundAcpSession(sessionStoreEntry.entry);
  const normalizedRouteReplyChannel = normalizeMessageChannel(replyRoute.channel);
  const normalizedProviderChannel = normalizeMessageChannel(ctx.Provider);
  const normalizedSurfaceChannel = normalizeMessageChannel(ctx.Surface);
  const normalizedCurrentSurface = normalizedProviderChannel ?? normalizedSurfaceChannel;
  const isInternalWebchatTurn =
    normalizedCurrentSurface === INTERNAL_MESSAGE_CHANNEL &&
    (normalizedSurfaceChannel === INTERNAL_MESSAGE_CHANNEL || !normalizedSurfaceChannel) &&
    ctx.ExplicitDeliverRoute !== true;
  const hasRouteReplyCandidate = Boolean(
    !suppressAcpChildUserDelivery &&
    !isInternalWebchatTurn &&
    normalizedRouteReplyChannel &&
    replyRoute.to &&
    normalizedRouteReplyChannel !== normalizedCurrentSurface,
  );
  const routeReplyRuntime = hasRouteReplyCandidate ? await loadRouteReplyRuntime() : undefined;
  const {
    originatingChannel: routeReplyChannel,
    currentSurface,
    shouldRouteToOriginating,
    shouldSuppressTyping,
  } = resolveReplyRoutingDecision({
    provider: ctx.Provider,
    surface: ctx.Surface,
    explicitDeliverRoute: ctx.ExplicitDeliverRoute,
    originatingChannel: replyRoute.channel,
    originatingTo: replyRoute.to,
    suppressDirectUserDelivery: suppressAcpChildUserDelivery,
    isRoutableChannel: routeReplyRuntime?.isRoutableChannel ?? (() => false),
  });
  const routeReplyTo = replyRoute.to;
  const deliveryChannel = shouldRouteToOriginating ? routeReplyChannel : currentSurface;
  let normalizeReplyMediaPaths:
    | ReturnType<
        (typeof import("./reply-media-paths.runtime.js"))["createReplyMediaPathNormalizer"]
      >
    | undefined;
  const getNormalizeReplyMediaPaths = async () => {
    if (normalizeReplyMediaPaths) {
      return normalizeReplyMediaPaths;
    }
    const { createReplyMediaPathNormalizer } = await loadReplyMediaPathsRuntime();
    normalizeReplyMediaPaths = createReplyMediaPathNormalizer({
      cfg,
      sessionKey: acpDispatchSessionKey,
      workspaceDir,
      messageProvider: deliveryChannel,
      accountId: replyRoute.accountId,
      groupId,
      groupChannel: ctx.GroupChannel,
      groupSpace: ctx.GroupSpace,
      requesterSenderId: ctx.SenderId,
      requesterSenderName: ctx.SenderName,
      requesterSenderUsername: ctx.SenderUsername,
      requesterSenderE164: ctx.SenderE164,
    });
    return normalizeReplyMediaPaths;
  };
  const normalizeReplyMediaPayload = async (payload: ReplyPayload): Promise<ReplyPayload> => {
    if (!resolveSendableOutboundReplyParts(payload).hasMedia) {
      return payload;
    }
    const normalizeReplyMediaPayloadPaths = await getNormalizeReplyMediaPaths();
    return await normalizeReplyMediaPayloadPaths(payload);
  };

  const routeReplyToOriginating = async (
    payload: ReplyPayload,
    options?: { abortSignal?: AbortSignal; mirror?: boolean },
  ) => {
    if (!shouldRouteToOriginating || !routeReplyChannel || !routeReplyTo || !routeReplyRuntime) {
      return null;
    }
    markInboundDedupeReplayUnsafe();
    return await routeReplyRuntime.routeReply({
      payload,
      channel: routeReplyChannel,
      to: routeReplyTo,
      sessionKey: ctx.SessionKey,
      policySessionKey:
        ctx.CommandSource === "native"
          ? (ctx.CommandTargetSessionKey ?? ctx.SessionKey)
          : ctx.SessionKey,
      policyConversationType: resolveRoutedPolicyConversationType(ctx),
      accountId: replyRoute.accountId,
      requesterSenderId: ctx.SenderId,
      requesterSenderName: ctx.SenderName,
      requesterSenderUsername: ctx.SenderUsername,
      requesterSenderE164: ctx.SenderE164,
      threadId: routeThreadId,
      cfg,
      abortSignal: options?.abortSignal,
      mirror: options?.mirror,
      isGroup,
      groupId,
    });
  };

  const sendBindingNotice = async (
    payload: ReplyPayload,
    mode: "additive" | "terminal",
  ): Promise<boolean> => {
    const result = await routeReplyToOriginating(payload);
    if (result) {
      if (!result.ok) {
        logVerbose(
          `dispatch-from-config: route-reply (plugin binding notice) failed: ${result.error ?? "unknown error"}`,
        );
      }
      return result.ok;
    }
    markInboundDedupeReplayUnsafe();
    return mode === "additive"
      ? dispatcher.sendToolResult(payload)
      : dispatcher.sendFinalReply(payload);
  };

  const pluginOwnedBindingRecord =
    inboundClaimContext.conversationId && inboundClaimContext.channelId
      ? resolveConversationBindingRecord({
          channel: inboundClaimContext.channelId,
          accountId:
            inboundClaimContext.accountId ??
            ((
              cfg.channels as Record<string, { defaultAccount?: unknown } | undefined> | undefined
            )?.[inboundClaimContext.channelId]?.defaultAccount as string | undefined) ??
            "default",
          conversationId: inboundClaimContext.conversationId,
          parentConversationId: inboundClaimContext.parentConversationId,
        })
      : null;
  const pluginOwnedBinding = isPluginOwnedSessionBindingRecord(pluginOwnedBindingRecord)
    ? toPluginConversationBinding(pluginOwnedBindingRecord)
    : null;

  // Resolve automatic source-delivery suppression early so every outbound path
  // below (plugin-binding notices, fast-abort, normal dispatch) honors it. The
  // agent still processes inbound, but automatic replies/notices/indicators are
  // blocked; explicit message tool sends remain available.
  const sendPolicy = resolveSendPolicy({
    cfg,
    entry: sessionStoreEntry.entry,
    sessionKey: sessionStoreEntry.sessionKey ?? sessionKey,
    channel:
      (shouldRouteToOriginating ? routeReplyChannel : undefined) ??
      sessionStoreEntry.entry?.channel ??
      replyRoute.channel ??
      ctx.Surface ??
      ctx.Provider ??
      undefined,
    chatType: sessionStoreEntry.entry?.chatType,
  });
  const sourceReplyPolicy = resolveSourceReplyVisibilityPolicy({
    cfg,
    ctx,
    requested: params.replyOptions?.sourceReplyDeliveryMode,
    sendPolicy,
    suppressAcpChildUserDelivery,
    explicitSuppressTyping: params.replyOptions?.suppressTyping === true,
    shouldSuppressTyping,
  });
  const {
    sourceReplyDeliveryMode,
    suppressDelivery,
    deliverySuppressionReason,
    suppressHookUserDelivery,
    suppressHookReplyLifecycle,
  } = sourceReplyPolicy;

  let pluginFallbackReason:
    | "plugin-bound-fallback-missing-plugin"
    | "plugin-bound-fallback-no-handler"
    | undefined;

  if (pluginOwnedBinding) {
    touchConversationBindingRecord(pluginOwnedBinding.bindingId);
    if (suppressDelivery) {
      // Plugin-bound inbound handlers typically emit outbound replies we
      // cannot rewind. When automatic delivery is suppressed, skip the plugin
      // claim and fall through to normal suppressed agent processing.
      logVerbose(
        `plugin-bound inbound skipped under ${deliverySuppressionReason} (plugin=${pluginOwnedBinding.pluginId} session=${sessionKey ?? "unknown"}); falling through to suppressed agent processing`,
      );
    } else {
      logVerbose(
        `plugin-bound inbound routed to ${pluginOwnedBinding.pluginId} conversation=${pluginOwnedBinding.conversationId}`,
      );
      const targetedClaimOutcome = hookRunner?.runInboundClaimForPluginOutcome
        ? await hookRunner.runInboundClaimForPluginOutcome(
            pluginOwnedBinding.pluginId,
            inboundClaimEvent,
            { ...inboundClaimContext, pluginBinding: pluginOwnedBinding },
          )
        : (() => {
            const pluginLoaded =
              getGlobalPluginRegistry()?.plugins.some(
                (plugin) => plugin.id === pluginOwnedBinding.pluginId && plugin.status === "loaded",
              ) ?? false;
            return pluginLoaded
              ? ({ status: "no_handler" } as const)
              : ({ status: "missing_plugin" } as const);
          })();

      switch (targetedClaimOutcome.status) {
        case "handled": {
          if (targetedClaimOutcome.result.reply) {
            await sendBindingNotice(targetedClaimOutcome.result.reply, "terminal");
          }
          markIdle("plugin_binding_dispatch");
          recordProcessed("completed", { reason: "plugin-bound-handled" });
          commitInboundDedupeIfClaimed();
          return { queuedFinal: false, counts: dispatcher.getQueuedCounts() };
        }
        case "missing_plugin":
        case "no_handler": {
          pluginFallbackReason =
            targetedClaimOutcome.status === "missing_plugin"
              ? "plugin-bound-fallback-missing-plugin"
              : "plugin-bound-fallback-no-handler";
          if (!hasShownPluginBindingFallbackNotice(pluginOwnedBinding.bindingId)) {
            const didSendNotice = await sendBindingNotice(
              { text: buildPluginBindingUnavailableText(pluginOwnedBinding) },
              "additive",
            );
            if (didSendNotice) {
              markPluginBindingFallbackNoticeShown(pluginOwnedBinding.bindingId);
            }
          }
          break;
        }
        case "declined": {
          await sendBindingNotice(
            { text: buildPluginBindingDeclinedText(pluginOwnedBinding) },
            "terminal",
          );
          markIdle("plugin_binding_declined");
          recordProcessed("completed", { reason: "plugin-bound-declined" });
          commitInboundDedupeIfClaimed();
          return { queuedFinal: false, counts: dispatcher.getQueuedCounts() };
        }
        case "error": {
          logVerbose(
            `plugin-bound inbound claim failed for ${pluginOwnedBinding.pluginId}: ${targetedClaimOutcome.error}`,
          );
          await sendBindingNotice(
            { text: buildPluginBindingErrorText(pluginOwnedBinding) },
            "terminal",
          );
          markIdle("plugin_binding_error");
          recordProcessed("completed", { reason: "plugin-bound-error" });
          commitInboundDedupeIfClaimed();
          return { queuedFinal: false, counts: dispatcher.getQueuedCounts() };
        }
      }
    }
  }

  // Trigger plugin hooks (fire-and-forget)
  if (hookRunner?.hasHooks("message_received")) {
    fireAndForgetHook(
      hookRunner.runMessageReceived(
        toPluginMessageReceivedEvent(hookContext),
        toPluginMessageContext(hookContext),
      ),
      "dispatch-from-config: message_received plugin hook failed",
    );
  }

  // Bridge to internal hooks (HOOK.md discovery system) - refs #8807
  if (sessionKey) {
    fireAndForgetHook(
      triggerInternalHook(
        createInternalHookEvent("message", "received", sessionKey, {
          ...toInternalMessageReceivedContext(hookContext),
          timestamp,
        }),
      ),
      "dispatch-from-config: message_received internal hook failed",
    );
  }

  markProcessing();

  try {
    const abortRuntime = params.fastAbortResolver ? null : await loadAbortRuntime();
    const fastAbortResolver = params.fastAbortResolver ?? abortRuntime?.tryFastAbortFromMessage;
    const formatAbortReplyTextResolver =
      params.formatAbortReplyTextResolver ?? abortRuntime?.formatAbortReplyText;
    if (!fastAbortResolver || !formatAbortReplyTextResolver) {
      throw new Error("abort runtime unavailable");
    }
    const fastAbort = await fastAbortResolver({ ctx, cfg });
    if (fastAbort.handled) {
      let queuedFinal = false;
      let routedFinalCount = 0;
      if (!suppressDelivery) {
        const payload = {
          text: formatAbortReplyTextResolver(fastAbort.stoppedSubagents),
        } satisfies ReplyPayload;
        const result = await routeReplyToOriginating(payload);
        if (result) {
          queuedFinal = result.ok;
          if (result.ok) {
            routedFinalCount += 1;
          }
          if (!result.ok) {
            logVerbose(
              `dispatch-from-config: route-reply (abort) failed: ${result.error ?? "unknown error"}`,
            );
          }
        } else {
          markInboundDedupeReplayUnsafe();
          queuedFinal = dispatcher.sendFinalReply(payload);
        }
      } else {
        logVerbose(
          `dispatch-from-config: fast_abort reply suppressed by ${deliverySuppressionReason} (session=${sessionKey ?? "unknown"})`,
        );
      }
      const counts = dispatcher.getQueuedCounts();
      counts.final += routedFinalCount;
      recordProcessed("completed", { reason: "fast_abort" });
      markIdle("message_completed");
      commitInboundDedupeIfClaimed();
      return { queuedFinal, counts };
    }

    const isSlackNonDirectSurface =
      (ctx.Surface === "slack" || ctx.Provider === "slack") && ctx.ChatType !== "direct";
    const shouldSendToolSummaries =
      !isSlackNonDirectSurface && (ctx.ChatType !== "group" || ctx.IsForum === true);
    const sendFinalPayload = async (
      payload: ReplyPayload,
    ): Promise<{ queuedFinal: boolean; routedFinalCount: number }> => {
      if (resolveSendableOutboundReplyParts(payload).hasContent) {
        markInboundDedupeReplayUnsafe();
      }
      const ttsPayload = await maybeApplyTtsToReplyPayload({
        payload,
        cfg,
        channel: deliveryChannel,
        kind: "final",
        inboundAudio,
        ttsAuto: sessionTtsAuto,
        agentId: sessionAgentId,
        accountId: replyRoute.accountId,
      });
      const normalizedPayload = await normalizeReplyMediaPayload(ttsPayload);
      const result = await routeReplyToOriginating(normalizedPayload);
      if (result) {
        if (!result.ok) {
          logVerbose(
            `dispatch-from-config: route-reply (final) failed: ${result.error ?? "unknown error"}`,
          );
        }
        return {
          queuedFinal: result.ok,
          routedFinalCount: result.ok ? 1 : 0,
        };
      }
      markInboundDedupeReplayUnsafe();
      return {
        queuedFinal: dispatcher.sendFinalReply(normalizedPayload),
        routedFinalCount: 0,
      };
    };

    // Run before_dispatch hook — let plugins inspect or handle before model dispatch.
    if (hookRunner?.hasHooks("before_dispatch")) {
      const beforeDispatchResult = await hookRunner.runBeforeDispatch(
        {
          content: hookContext.content,
          body: hookContext.bodyForAgent ?? hookContext.body,
          channel: hookContext.channelId,
          sessionKey: sessionStoreEntry.sessionKey ?? sessionKey,
          senderId: hookContext.senderId,
          isGroup: hookContext.isGroup,
          timestamp: hookContext.timestamp,
        },
        {
          channelId: hookContext.channelId,
          accountId: hookContext.accountId,
          conversationId: inboundClaimContext.conversationId,
          sessionKey: sessionStoreEntry.sessionKey ?? sessionKey,
          senderId: hookContext.senderId,
        },
      );
      if (beforeDispatchResult?.handled) {
        const text = beforeDispatchResult.text;
        let queuedFinal = false;
        let routedFinalCount = 0;
        if (text && !suppressDelivery) {
          const handledReply = await sendFinalPayload({ text });
          queuedFinal = handledReply.queuedFinal;
          routedFinalCount += handledReply.routedFinalCount;
        }
        const counts = dispatcher.getQueuedCounts();
        counts.final += routedFinalCount;
        recordProcessed("completed", { reason: "before_dispatch_handled" });
        markIdle("message_completed");
        commitInboundDedupeIfClaimed();
        return { queuedFinal, counts };
      }
    }

    if (hookRunner?.hasHooks("reply_dispatch")) {
      const replyDispatchResult = await hookRunner.runReplyDispatch(
        {
          ctx,
          runId: params.replyOptions?.runId,
          sessionKey: acpDispatchSessionKey,
          images: params.replyOptions?.images,
          inboundAudio,
          sessionTtsAuto,
          ttsChannel: deliveryChannel,
          suppressUserDelivery: suppressHookUserDelivery,
          suppressReplyLifecycle: suppressHookReplyLifecycle,
          sourceReplyDeliveryMode,
          shouldRouteToOriginating,
          originatingChannel: routeReplyChannel,
          originatingTo: routeReplyTo,
          shouldSendToolSummaries,
          sendPolicy,
        },
        {
          cfg,
          dispatcher,
          abortSignal: params.replyOptions?.abortSignal,
          onReplyStart: params.replyOptions?.onReplyStart,
          recordProcessed,
          markIdle,
        },
      );
      if (replyDispatchResult?.handled) {
        commitInboundDedupeIfClaimed();
        return {
          queuedFinal: replyDispatchResult.queuedFinal,
          counts: replyDispatchResult.counts,
        };
      }
    }

    // §6.2 sever: agent/LLM dispatch is disabled in this fork. If no plugin
    // claimed inbound (via inbound_claim, before_dispatch, or reply_dispatch),
    // emit a static "no plugin claimed" reply and return. The replyResolver
    // and downstream agent streaming/tool code below this point is now
    // unreachable; subsequent passes will delete it.
    {
      let queuedFinal = false;
      let routedFinalCount = 0;
      const noHandlerText = pluginFallbackReason
        ? "No plugin handler available for this conversation. Use `/tui start <command>` to bind a TUI process, or rebind the plugin."
        : "No plugin claimed this message. Run `/tui start <command>` first to bind this conversation to a TUI process.";
      if (!suppressDelivery) {
        const sendResult = await sendFinalPayload({ text: noHandlerText });
        queuedFinal = sendResult.queuedFinal;
        routedFinalCount = sendResult.routedFinalCount;
      } else {
        logVerbose(
          `dispatch-from-config: no-plugin-claimed reply suppressed by ${deliverySuppressionReason} (session=${sessionStoreEntry.sessionKey ?? sessionKey ?? "unknown"})`,
        );
      }
      const counts = dispatcher.getQueuedCounts();
      counts.final += routedFinalCount;
      commitInboundDedupeIfClaimed();
      recordProcessed("completed", {
        reason: pluginFallbackReason ?? "no-plugin-claimed",
      });
      markIdle("message_completed");
      return { queuedFinal, counts };
    }
  } catch (err) {
    if (inboundDedupeClaim.status === "claimed") {
      if (inboundDedupeReplayUnsafe) {
        commitInboundDedupe(inboundDedupeClaim.key);
      } else {
        releaseInboundDedupe(inboundDedupeClaim.key);
      }
    }
    recordProcessed("error", { error: String(err) });
    markIdle("message_error");
    throw err;
  }
}
