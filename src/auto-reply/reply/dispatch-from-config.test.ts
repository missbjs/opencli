import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import {
  clearApprovalNativeRouteStateForTest,
  createApprovalNativeRouteReporter,
} from "../../infra/approval-native-route-coordinator.js";
import type { SessionBindingRecord } from "../../infra/outbound/session-binding-service.js";
import type {
  AcpRuntime,
  AcpRuntimeEnsureInput,
  AcpRuntimeEvent,
  AcpRuntimeHandle,
  AcpRuntimeTurnInput,
} from "../../plugin-sdk/acp-runtime.js";
import type {
  PluginHookBeforeDispatchResult,
  PluginHookReplyDispatchResult,
  PluginTargetedInboundClaimOutcome,
} from "../../plugins/hooks.js";
import { setActivePluginRegistry } from "../../plugins/runtime.js";
import {
  createChannelTestPluginBase,
  createTestRegistry,
} from "../../test-utils/channel-plugins.js";
import { createInternalHookEventPayload } from "../../test-utils/internal-hook-event-payload.js";
import type { MsgContext } from "../templating.js";
import type { GetReplyOptions, ReplyPayload } from "../types.js";
import type { ReplyDispatcher } from "./reply-dispatcher.js";
import { buildTestCtx } from "./test-ctx.js";

type AbortResult = { handled: boolean; aborted: boolean; stoppedSubagents?: number };

const mocks = vi.hoisted(() => ({
  routeReply: vi.fn(async (_params: unknown) => ({ ok: true, messageId: "mock" })),
  tryFastAbortFromMessage: vi.fn<() => Promise<AbortResult>>(async () => ({
    handled: false,
    aborted: false,
  })),
}));
const diagnosticMocks = vi.hoisted(() => ({
  logMessageQueued: vi.fn(),
  logMessageProcessed: vi.fn(),
  logSessionStateChange: vi.fn(),
}));
const hookMocks = vi.hoisted(() => ({
  registry: {
    plugins: [] as Array<{
      id: string;
      status: "loaded" | "disabled" | "error";
    }>,
  },
  runner: {
    hasHooks: vi.fn<(hookName?: string) => boolean>(() => false),
    runInboundClaim: vi.fn(async () => undefined),
    runInboundClaimForPlugin: vi.fn(async () => undefined),
    runInboundClaimForPluginOutcome: vi.fn<() => Promise<PluginTargetedInboundClaimOutcome>>(
      async () => ({ status: "no_handler" as const }),
    ),
    runMessageReceived: vi.fn(async () => {}),
    runBeforeDispatch: vi.fn<
      (_event: unknown, _ctx: unknown) => Promise<PluginHookBeforeDispatchResult | undefined>
    >(async () => undefined),
    runReplyDispatch: vi.fn<
      (_event: unknown, _ctx: unknown) => Promise<PluginHookReplyDispatchResult | undefined>
    >(async () => undefined),
  },
}));
const internalHookMocks = vi.hoisted(() => ({
  createInternalHookEvent: vi.fn(),
  triggerInternalHook: vi.fn(async () => {}),
}));
const acpMocks = vi.hoisted(() => ({
  listAcpSessionEntries: vi.fn(async () => []),
  readAcpSessionEntry: vi.fn<(params: { sessionKey: string; cfg?: OpenClawConfig }) => unknown>(
    () => null,
  ),
  getAcpRuntimeBackend: vi.fn<() => unknown>(() => null),
  upsertAcpSessionMeta: vi.fn<
    (params: {
      sessionKey: string;
      cfg?: OpenClawConfig;
      mutate: (
        current: Record<string, unknown> | undefined,
        entry: { acp?: Record<string, unknown> } | undefined,
      ) => Record<string, unknown> | null | undefined;
    }) => Promise<unknown>
  >(async () => null),
  requireAcpRuntimeBackend: vi.fn<() => unknown>(),
}));
const sessionBindingMocks = vi.hoisted(() => ({
  listBySession: vi.fn<(targetSessionKey: string) => SessionBindingRecord[]>(() => []),
  resolveByConversation: vi.fn<
    (ref: {
      channel: string;
      accountId: string;
      conversationId: string;
      parentConversationId?: string;
    }) => SessionBindingRecord | null
  >(() => null),
  touch: vi.fn(),
}));
const pluginConversationBindingMocks = vi.hoisted(() => ({
  shownFallbackNoticeBindingIds: new Set<string>(),
}));
const sessionStoreMocks = vi.hoisted(() => ({
  currentEntry: undefined as Record<string, unknown> | undefined,
  loadSessionStore: vi.fn(() => ({})),
  resolveStorePath: vi.fn(() => "/tmp/mock-sessions.json"),
  resolveSessionStoreEntry: vi.fn(() => ({ existing: sessionStoreMocks.currentEntry })),
}));
const acpManagerRuntimeMocks = vi.hoisted(() => ({
  getAcpSessionManager: vi.fn(),
}));
const agentEventMocks = vi.hoisted(() => ({
  emitAgentEvent: vi.fn(),
  onAgentEvent: vi.fn<(listener: unknown) => () => void>(() => () => {}),
}));
const ttsMocks = vi.hoisted(() => {
  const state = {
    synthesizeFinalAudio: false,
  };
  return {
    state,
    maybeApplyTtsToPayload: vi.fn(async (paramsUnknown: unknown) => {
      const params = paramsUnknown as {
        payload: ReplyPayload;
        kind: "tool" | "block" | "final";
      };
      if (
        state.synthesizeFinalAudio &&
        params.kind === "final" &&
        typeof params.payload?.text === "string" &&
        params.payload.text.trim()
      ) {
        return {
          ...params.payload,
          mediaUrl: "https://example.com/tts-synth.opus",
          audioAsVoice: true,
        };
      }
      return params.payload;
    }),
    normalizeTtsAutoMode: vi.fn((value: unknown) =>
      typeof value === "string" ? value : undefined,
    ),
    resolveTtsConfig: vi.fn((_cfg: OpenClawConfig) => ({ mode: "final" })),
  };
});
const replyMediaPathMocks = vi.hoisted(() => ({
  createReplyMediaPathNormalizer: vi.fn(
    (_params?: unknown) => async (payload: ReplyPayload) => payload,
  ),
}));
const runtimePluginMocks = vi.hoisted(() => ({
  ensureRuntimePluginsLoaded: vi.fn(),
}));
const conversationBindingMocks = vi.hoisted(() => {
  type BindingMsgContext = {
    OriginatingChannel?: string | null;
    Surface?: string | null;
    Provider?: string | null;
    AccountId?: string | null;
    MessageThreadId?: string | number | null;
    ThreadParentId?: string | null;
    SenderId?: string | null;
    SessionKey?: string | null;
    ParentSessionKey?: string | null;
    OriginatingTo?: string | null;
    To?: string | null;
    From?: string | null;
    NativeChannelId?: string | null;
  };
  type BindingConfig = {
    channels?: Record<string, { defaultAccount?: string | null } | undefined>;
  };

  const normalizeText = (value: string | number | null | undefined) =>
    typeof value === "number" ? `${value}` : (value ?? "").trim();
  const normalizeChannel = (value: string | null | undefined) => normalizeText(value).toLowerCase();
  const resolveChannel = (ctx: BindingMsgContext, commandChannel?: string | null) =>
    normalizeChannel(ctx.OriginatingChannel ?? commandChannel ?? ctx.Surface ?? ctx.Provider);
  const resolveAccountId = (ctx: BindingMsgContext, cfg: BindingConfig, channel: string) =>
    normalizeText(ctx.AccountId) ||
    normalizeText(cfg.channels?.[channel]?.defaultAccount) ||
    "default";
  const resolveTarget = (channel: string, value: string | null | undefined) => {
    const target = normalizeText(value);
    if (!target) {
      return undefined;
    }
    const channelPrefix = `${channel}:`;
    return target.toLowerCase().startsWith(channelPrefix)
      ? target.slice(channelPrefix.length)
      : target;
  };
  const resolveThreadId = (ctx: BindingMsgContext) =>
    normalizeText(ctx.MessageThreadId) || undefined;

  const resolveConversationBindingContextFromMessage = vi.fn(
    (params: { cfg: BindingConfig; ctx: BindingMsgContext }) => {
      const channel = resolveChannel(params.ctx);
      if (!channel) {
        return null;
      }
      const threadId = resolveThreadId(params.ctx);
      const baseConversationId =
        resolveTarget(channel, params.ctx.OriginatingTo) ?? resolveTarget(channel, params.ctx.To);
      const conversationId = threadId ?? baseConversationId;
      if (!conversationId) {
        return null;
      }
      const parentConversationId =
        threadId && baseConversationId && baseConversationId !== threadId
          ? baseConversationId
          : resolveTarget(channel, params.ctx.ThreadParentId);
      return {
        channel,
        accountId: resolveAccountId(params.ctx, params.cfg, channel),
        conversationId,
        ...(parentConversationId ? { parentConversationId } : {}),
        ...(threadId ? { threadId } : {}),
      };
    },
  );

  return {
    resolveConversationBindingAccountIdFromMessage: (params: {
      ctx: BindingMsgContext;
      cfg: BindingConfig;
      commandChannel?: string | null;
    }) =>
      resolveAccountId(params.ctx, params.cfg, resolveChannel(params.ctx, params.commandChannel)),
    resolveConversationBindingChannelFromMessage: (
      ctx: BindingMsgContext,
      commandChannel?: string | null,
    ) => resolveChannel(ctx, commandChannel),
    resolveConversationBindingContextFromAcpCommand: (params: {
      cfg: BindingConfig;
      ctx: BindingMsgContext;
      command?: { to?: string | null; senderId?: string | null };
      sessionKey?: string | null;
      parentSessionKey?: string | null;
    }) =>
      resolveConversationBindingContextFromMessage({
        cfg: params.cfg,
        ctx: {
          ...params.ctx,
          SenderId: params.command?.senderId ?? params.ctx.SenderId,
          SessionKey: params.sessionKey ?? params.ctx.SessionKey,
          ParentSessionKey: params.parentSessionKey ?? params.ctx.ParentSessionKey,
          To: params.command?.to ?? params.ctx.To,
        },
      }),
    resolveConversationBindingContextFromMessage,
    resolveConversationBindingThreadIdFromMessage: (ctx: BindingMsgContext) => resolveThreadId(ctx),
  };
});
const threadInfoMocks = vi.hoisted(() => ({
  parseSessionThreadInfo: vi.fn<
    (sessionKey: string | undefined) => {
      baseSessionKey: string | undefined;
      threadId: string | undefined;
    }
  >(),
}));

function parseGenericThreadSessionInfo(sessionKey: string | undefined) {
  const trimmed = sessionKey?.trim();
  if (!trimmed) {
    return { baseSessionKey: undefined, threadId: undefined };
  }
  const threadMarker = ":thread:";
  const topicMarker = ":topic:";
  const marker = trimmed.includes(threadMarker)
    ? threadMarker
    : trimmed.includes(topicMarker)
      ? topicMarker
      : undefined;
  if (!marker) {
    return { baseSessionKey: trimmed, threadId: undefined };
  }
  const index = trimmed.lastIndexOf(marker);
  if (index < 0) {
    return { baseSessionKey: trimmed, threadId: undefined };
  }
  const baseSessionKey = trimmed.slice(0, index).trim() || undefined;
  const threadId = trimmed.slice(index + marker.length).trim() || undefined;
  return { baseSessionKey, threadId };
}

vi.mock("./route-reply.runtime.js", () => ({
  isRoutableChannel: (channel: string | undefined) =>
    Boolean(
      channel &&
      [
        "telegram",
        "slack",
        "discord",
        "signal",
        "imessage",
        "whatsapp",
        "feishu",
        "mattermost",
      ].includes(channel),
    ),
  routeReply: mocks.routeReply,
}));

vi.mock("./route-reply.js", () => ({
  isRoutableChannel: (channel: string | undefined) =>
    Boolean(
      channel &&
      [
        "telegram",
        "slack",
        "discord",
        "signal",
        "imessage",
        "whatsapp",
        "feishu",
        "mattermost",
      ].includes(channel),
    ),
  routeReply: mocks.routeReply,
}));

vi.mock("./abort.runtime.js", () => ({
  tryFastAbortFromMessage: mocks.tryFastAbortFromMessage,
  formatAbortReplyText: (stoppedSubagents?: number) => {
    if (typeof stoppedSubagents !== "number" || stoppedSubagents <= 0) {
      return "⚙️ Agent was aborted.";
    }
    const label = stoppedSubagents === 1 ? "sub-agent" : "sub-agents";
    return `⚙️ Agent was aborted. Stopped ${stoppedSubagents} ${label}.`;
  },
}));

vi.mock("../../logging/diagnostic.js", () => ({
  logMessageQueued: diagnosticMocks.logMessageQueued,
  logMessageProcessed: diagnosticMocks.logMessageProcessed,
  logSessionStateChange: diagnosticMocks.logSessionStateChange,
}));
vi.mock("../../config/sessions/thread-info.js", () => ({
  parseSessionThreadInfo: (sessionKey: string | undefined) =>
    threadInfoMocks.parseSessionThreadInfo(sessionKey),
  parseSessionThreadInfoFast: (sessionKey: string | undefined) =>
    threadInfoMocks.parseSessionThreadInfo(sessionKey),
}));
vi.mock("./dispatch-from-config.runtime.js", () => ({
  createInternalHookEvent: internalHookMocks.createInternalHookEvent,
  loadSessionStore: sessionStoreMocks.loadSessionStore,
  resolveSessionStoreEntry: sessionStoreMocks.resolveSessionStoreEntry,
  resolveStorePath: sessionStoreMocks.resolveStorePath,
  triggerInternalHook: internalHookMocks.triggerInternalHook,
}));

vi.mock("../../plugins/hook-runner-global.js", () => ({
  initializeGlobalHookRunner: vi.fn(),
  getGlobalHookRunner: () => hookMocks.runner,
  getGlobalPluginRegistry: () => hookMocks.registry,
  resetGlobalHookRunner: vi.fn(),
}));
vi.mock("../../acp/runtime/session-meta.js", () => ({
  listAcpSessionEntries: acpMocks.listAcpSessionEntries,
  readAcpSessionEntry: acpMocks.readAcpSessionEntry,
  upsertAcpSessionMeta: acpMocks.upsertAcpSessionMeta,
}));
vi.mock("../../acp/runtime/registry.js", () => ({
  getAcpRuntimeBackend: acpMocks.getAcpRuntimeBackend,
  requireAcpRuntimeBackend: acpMocks.requireAcpRuntimeBackend,
}));
vi.mock("../../infra/outbound/session-binding-service.js", () => ({
  getSessionBindingService: () => ({
    bind: vi.fn(async () => {
      throw new Error("bind not mocked");
    }),
    getCapabilities: vi.fn(() => ({
      adapterAvailable: true,
      bindSupported: true,
      unbindSupported: true,
      placements: ["current", "child"] as const,
    })),
    listBySession: (targetSessionKey: string) =>
      sessionBindingMocks.listBySession(targetSessionKey),
    resolveByConversation: sessionBindingMocks.resolveByConversation,
    touch: sessionBindingMocks.touch,
    unbind: vi.fn(async () => []),
  }),
}));
vi.mock("../../infra/agent-events.js", () => ({
  emitAgentEvent: (params: unknown) => agentEventMocks.emitAgentEvent(params),
  onAgentEvent: (listener: unknown) => agentEventMocks.onAgentEvent(listener),
}));
vi.mock("../../plugins/conversation-binding.js", () => ({
  buildPluginBindingDeclinedText: () => "Plugin binding request was declined.",
  buildPluginBindingErrorText: () => "Plugin binding request failed.",
  buildPluginBindingUnavailableText: (binding: { pluginName?: string; pluginId: string }) =>
    `${binding.pluginName ?? binding.pluginId} is not currently loaded.`,
  hasShownPluginBindingFallbackNotice: (bindingId: string) =>
    pluginConversationBindingMocks.shownFallbackNoticeBindingIds.has(bindingId),
  isPluginOwnedSessionBindingRecord: (
    record: SessionBindingRecord | null | undefined,
  ): record is SessionBindingRecord =>
    record?.metadata != null &&
    typeof record.metadata === "object" &&
    (record.metadata as { pluginBindingOwner?: string }).pluginBindingOwner === "plugin",
  markPluginBindingFallbackNoticeShown: (bindingId: string) => {
    pluginConversationBindingMocks.shownFallbackNoticeBindingIds.add(bindingId);
  },
  toPluginConversationBinding: (record: SessionBindingRecord) => {
    const metadata = (record.metadata ?? {}) as {
      pluginId?: string;
      pluginName?: string;
      pluginRoot?: string;
      data?: Record<string, unknown>;
    };
    return {
      bindingId: record.bindingId,
      pluginId: metadata.pluginId ?? "unknown-plugin",
      pluginName: metadata.pluginName,
      pluginRoot: metadata.pluginRoot ?? "",
      channel: record.conversation.channel,
      accountId: record.conversation.accountId,
      conversationId: record.conversation.conversationId,
      parentConversationId: record.conversation.parentConversationId,
      data: metadata.data,
    };
  },
}));
vi.mock("./dispatch-acp-manager.runtime.js", () => ({
  getAcpSessionManager: () => acpManagerRuntimeMocks.getAcpSessionManager(),
  getSessionBindingService: () => ({
    listBySession: (targetSessionKey: string) =>
      sessionBindingMocks.listBySession(targetSessionKey),
    unbind: vi.fn(async () => []),
  }),
}));
vi.mock("../../tts/tts.js", () => ({
  maybeApplyTtsToPayload: (params: unknown) => ttsMocks.maybeApplyTtsToPayload(params),
  normalizeTtsAutoMode: (value: unknown) => ttsMocks.normalizeTtsAutoMode(value),
  resolveTtsConfig: (cfg: OpenClawConfig) => ttsMocks.resolveTtsConfig(cfg),
}));
vi.mock("../../tts/tts.runtime.js", () => ({
  maybeApplyTtsToPayload: (params: unknown) => ttsMocks.maybeApplyTtsToPayload(params),
}));
vi.mock("./reply-media-paths.runtime.js", () => ({
  createReplyMediaPathNormalizer: (params: unknown) =>
    replyMediaPathMocks.createReplyMediaPathNormalizer(params),
}));
vi.mock("./runtime-plugins.runtime.js", () => ({
  ensureRuntimePluginsLoaded: runtimePluginMocks.ensureRuntimePluginsLoaded,
}));
vi.mock("./conversation-binding-input.js", () => ({
  resolveConversationBindingAccountIdFromMessage:
    conversationBindingMocks.resolveConversationBindingAccountIdFromMessage,
  resolveConversationBindingChannelFromMessage:
    conversationBindingMocks.resolveConversationBindingChannelFromMessage,
  resolveConversationBindingContextFromAcpCommand:
    conversationBindingMocks.resolveConversationBindingContextFromAcpCommand,
  resolveConversationBindingContextFromMessage:
    conversationBindingMocks.resolveConversationBindingContextFromMessage,
  resolveConversationBindingThreadIdFromMessage:
    conversationBindingMocks.resolveConversationBindingThreadIdFromMessage,
}));
vi.mock("../../tts/status-config.js", () => ({
  resolveStatusTtsSnapshot: () => ({
    autoMode: "always",
    provider: "auto",
    maxLength: 1500,
    summarize: true,
  }),
}));
vi.mock("./dispatch-acp-tts.runtime.js", () => ({
  maybeApplyTtsToPayload: (params: unknown) => ttsMocks.maybeApplyTtsToPayload(params),
}));
vi.mock("./dispatch-acp-session.runtime.js", () => ({
  readAcpSessionEntry: (params: { sessionKey: string; cfg?: OpenClawConfig }) =>
    acpMocks.readAcpSessionEntry(params),
}));
vi.mock("../../tts/tts-config.js", () => ({
  normalizeTtsAutoMode: (value: unknown) => ttsMocks.normalizeTtsAutoMode(value),
  resolveConfiguredTtsMode: (cfg: OpenClawConfig) => ttsMocks.resolveTtsConfig(cfg).mode,
  shouldCleanTtsDirectiveText: () => true,
  shouldAttemptTtsPayload: () => true,
}));

const noAbortResult = { handled: false, aborted: false } as const;
const emptyConfig = {} as OpenClawConfig;
const automaticGroupReplyConfig = {
  messages: {
    groupChat: {
      visibleReplies: "automatic",
    },
  },
} as const satisfies OpenClawConfig;
let dispatchReplyFromConfig: typeof import("./dispatch-from-config.js").dispatchReplyFromConfig;
let resetInboundDedupe: typeof import("./inbound-dedupe.js").resetInboundDedupe;
let tryDispatchAcpReplyHook: typeof import("../../plugin-sdk/acp-runtime.js").tryDispatchAcpReplyHook;
type DispatchReplyArgs = Parameters<
  typeof import("./dispatch-from-config.js").dispatchReplyFromConfig
>[0];

beforeAll(async () => {
  ({ dispatchReplyFromConfig } = await import("./dispatch-from-config.js"));
  await import("./dispatch-acp.js");
  await import("./dispatch-acp-command-bypass.js");
  await import("./dispatch-acp-tts.runtime.js");
  await import("./dispatch-acp-session.runtime.js");
  ({ resetInboundDedupe } = await import("./inbound-dedupe.js"));
  ({ tryDispatchAcpReplyHook } = await import("../../plugin-sdk/acp-runtime.js"));
});

function createDispatcher(): ReplyDispatcher {
  return {
    sendToolResult: vi.fn(() => true),
    sendBlockReply: vi.fn(() => true),
    sendFinalReply: vi.fn(() => true),
    waitForIdle: vi.fn(async () => {}),
    getQueuedCounts: vi.fn(() => ({ tool: 0, block: 0, final: 0 })),
    getFailedCounts: vi.fn(() => ({ tool: 0, block: 0, final: 0 })),
    markComplete: vi.fn(),
  };
}

function shouldUseAcpReplyDispatchHook(eventUnknown: unknown): boolean {
  const event = eventUnknown as {
    sessionKey?: string;
    ctx?: {
      SessionKey?: string;
      CommandTargetSessionKey?: string;
      AcpDispatchTailAfterReset?: boolean;
    };
  };
  if (event.ctx?.AcpDispatchTailAfterReset) {
    return true;
  }
  return [event.sessionKey, event.ctx?.SessionKey, event.ctx?.CommandTargetSessionKey].some(
    (value) => {
      const key = value?.trim();
      return Boolean(key && (key.includes("acp:") || key.includes(":acp") || key.includes("-acp")));
    },
  );
}

function setNoAbort() {
  mocks.tryFastAbortFromMessage.mockResolvedValue(noAbortResult);
}

type MockAcpRuntime = AcpRuntime & {
  ensureSession: Mock<(input: AcpRuntimeEnsureInput) => Promise<AcpRuntimeHandle>>;
  runTurn: Mock<(input: AcpRuntimeTurnInput) => AsyncIterable<AcpRuntimeEvent>>;
  cancel: Mock<(input: { handle: AcpRuntimeHandle; reason?: string }) => Promise<void>>;
  close: Mock<(input: { handle: AcpRuntimeHandle; reason: string }) => Promise<void>>;
};

function createAcpRuntime(events: AcpRuntimeEvent[]): MockAcpRuntime {
  const runtime = {
    ensureSession: vi.fn<(input: AcpRuntimeEnsureInput) => Promise<AcpRuntimeHandle>>(
      async (input) => ({
        sessionKey: input.sessionKey,
        backend: "acpx",
        runtimeSessionName: `${input.sessionKey}:${input.mode}`,
      }),
    ),
    runTurn: vi.fn<(input: AcpRuntimeTurnInput) => AsyncIterable<AcpRuntimeEvent>>(
      async function* (_input) {
        for (const event of events) {
          yield event;
        }
      },
    ),
    cancel: vi.fn<(input: { handle: AcpRuntimeHandle; reason?: string }) => Promise<void>>(
      async () => {},
    ),
    close: vi.fn<(input: { handle: AcpRuntimeHandle; reason: string }) => Promise<void>>(
      async () => {},
    ),
  } satisfies AcpRuntime;
  return runtime as MockAcpRuntime;
}

function createMockAcpSessionManager() {
  return {
    resolveSession: (params: { cfg: OpenClawConfig; sessionKey: string }) => {
      const entry = acpMocks.readAcpSessionEntry({
        cfg: params.cfg,
        sessionKey: params.sessionKey,
      }) as { acp?: Record<string, unknown> } | null;
      if (entry?.acp) {
        return {
          kind: "ready" as const,
          sessionKey: params.sessionKey,
          meta: entry.acp,
        };
      }
      return params.sessionKey.startsWith("agent:")
        ? {
            kind: "stale" as const,
            sessionKey: params.sessionKey,
            error: {
              code: "ACP_SESSION_INIT_FAILED",
              message: `ACP metadata is missing for ${params.sessionKey}.`,
            },
          }
        : {
            kind: "none" as const,
            sessionKey: params.sessionKey,
          };
    },
    getObservabilitySnapshot: () => ({
      runtimeCache: {
        activeSessions: 0,
        idleTtlMs: 0,
        evictedTotal: 0,
      },
      turns: {
        active: 0,
        queueDepth: 0,
        completed: 0,
        failed: 0,
        averageLatencyMs: 0,
        maxLatencyMs: 0,
      },
      errorsByCode: {},
    }),
    runTurn: vi.fn(
      async (params: {
        cfg: OpenClawConfig;
        sessionKey: string;
        text?: string;
        attachments?: unknown[];
        mode: string;
        requestId: string;
        signal?: AbortSignal;
        onEvent: (event: Record<string, unknown>) => Promise<void>;
      }) => {
        const entry = acpMocks.readAcpSessionEntry({
          cfg: params.cfg,
          sessionKey: params.sessionKey,
        }) as {
          acp?: {
            agent?: string;
            mode?: string;
          };
        } | null;
        const runtimeBackend = acpMocks.requireAcpRuntimeBackend() as {
          runtime?: ReturnType<typeof createAcpRuntime>;
        };
        if (!runtimeBackend.runtime) {
          throw new Error("ACP runtime backend not mocked");
        }
        const handle = await runtimeBackend.runtime.ensureSession({
          sessionKey: params.sessionKey,
          mode: (entry?.acp?.mode || "persistent") as AcpRuntimeEnsureInput["mode"],
          agent: entry?.acp?.agent || "codex",
        });
        const stream = runtimeBackend.runtime.runTurn({
          handle,
          text: params.text ?? "",
          attachments: params.attachments as AcpRuntimeTurnInput["attachments"],
          mode: params.mode as AcpRuntimeTurnInput["mode"],
          requestId: params.requestId,
          signal: params.signal,
        });
        for await (const event of stream) {
          await params.onEvent(event);
        }
        if (entry?.acp?.mode === "oneshot") {
          await runtimeBackend.runtime.close({
            handle,
            reason: "oneshot-complete",
          });
        }
      },
    ),
  };
}

function firstToolResultPayload(dispatcher: ReplyDispatcher): ReplyPayload | undefined {
  return (dispatcher.sendToolResult as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
    | ReplyPayload
    | undefined;
}

async function dispatchTwiceWithFreshDispatchers(params: Omit<DispatchReplyArgs, "dispatcher">) {
  await dispatchReplyFromConfig({
    ...params,
    dispatcher: createDispatcher(),
  });
  await dispatchReplyFromConfig({
    ...params,
    dispatcher: createDispatcher(),
  });
}

describe("dispatchReplyFromConfig", () => {
  beforeEach(() => {
    const discordTestPlugin = {
      ...createChannelTestPluginBase({
        id: "discord",
        capabilities: {
          chatTypes: ["direct"],
          nativeCommands: true,
        },
      }),
      outbound: {
        deliveryMode: "direct",
        shouldSuppressLocalPayloadPrompt: ({
          payload,
          hint,
        }: {
          payload: ReplyPayload;
          hint?: { nativeRouteActive?: boolean };
        }) =>
          hint?.nativeRouteActive === true &&
          Boolean(
            payload.channelData &&
            typeof payload.channelData === "object" &&
            !Array.isArray(payload.channelData) &&
            payload.channelData.execApproval,
          ),
      },
    };
    setActivePluginRegistry(
      createTestRegistry([
        {
          pluginId: "discord",
          source: "test",
          plugin: discordTestPlugin,
        },
      ]),
    );
    clearApprovalNativeRouteStateForTest();
    acpManagerRuntimeMocks.getAcpSessionManager.mockReset();
    acpManagerRuntimeMocks.getAcpSessionManager.mockReturnValue(createMockAcpSessionManager());
    resetInboundDedupe();
    mocks.routeReply.mockReset();
    mocks.routeReply.mockResolvedValue({ ok: true, messageId: "mock" });
    acpMocks.listAcpSessionEntries.mockReset().mockResolvedValue([]);
    diagnosticMocks.logMessageQueued.mockClear();
    diagnosticMocks.logMessageProcessed.mockClear();
    diagnosticMocks.logSessionStateChange.mockClear();
    hookMocks.runner.hasHooks.mockClear();
    hookMocks.runner.hasHooks.mockImplementation(
      (hookName?: string) => hookName === "reply_dispatch",
    );
    hookMocks.runner.runInboundClaim.mockClear();
    hookMocks.runner.runInboundClaim.mockResolvedValue(undefined);
    hookMocks.runner.runInboundClaimForPlugin.mockClear();
    hookMocks.runner.runInboundClaimForPlugin.mockResolvedValue(undefined);
    hookMocks.runner.runInboundClaimForPluginOutcome.mockClear();
    hookMocks.runner.runInboundClaimForPluginOutcome.mockResolvedValue({
      status: "no_handler",
    });
    hookMocks.runner.runMessageReceived.mockClear();
    hookMocks.runner.runBeforeDispatch.mockClear();
    hookMocks.runner.runBeforeDispatch.mockResolvedValue(undefined);
    hookMocks.runner.runReplyDispatch.mockClear();
    hookMocks.runner.runReplyDispatch.mockImplementation(async (event: unknown, ctx: unknown) => {
      if (!shouldUseAcpReplyDispatchHook(event)) {
        return undefined;
      }
      return (await tryDispatchAcpReplyHook(event as never, ctx as never)) ?? undefined;
    });
    hookMocks.registry.plugins = [];
    internalHookMocks.createInternalHookEvent.mockClear();
    internalHookMocks.createInternalHookEvent.mockImplementation(createInternalHookEventPayload);
    internalHookMocks.triggerInternalHook.mockClear();
    acpMocks.readAcpSessionEntry.mockReset();
    acpMocks.readAcpSessionEntry.mockReturnValue(null);
    acpMocks.upsertAcpSessionMeta.mockReset();
    acpMocks.upsertAcpSessionMeta.mockResolvedValue(null);
    acpMocks.getAcpRuntimeBackend.mockReset();
    acpMocks.requireAcpRuntimeBackend.mockReset();
    agentEventMocks.emitAgentEvent.mockReset();
    agentEventMocks.onAgentEvent.mockReset();
    agentEventMocks.onAgentEvent.mockReturnValue(() => {});
    sessionBindingMocks.listBySession.mockReset();
    sessionBindingMocks.listBySession.mockReturnValue([]);
    pluginConversationBindingMocks.shownFallbackNoticeBindingIds.clear();
    sessionBindingMocks.resolveByConversation.mockReset();
    sessionBindingMocks.resolveByConversation.mockReturnValue(null);
    sessionBindingMocks.touch.mockReset();
    sessionStoreMocks.currentEntry = undefined;
    sessionStoreMocks.loadSessionStore.mockClear();
    sessionStoreMocks.resolveStorePath.mockClear();
    sessionStoreMocks.resolveSessionStoreEntry.mockClear();
    threadInfoMocks.parseSessionThreadInfo.mockReset();
    threadInfoMocks.parseSessionThreadInfo.mockImplementation(parseGenericThreadSessionInfo);
    ttsMocks.state.synthesizeFinalAudio = false;
    ttsMocks.maybeApplyTtsToPayload.mockClear();
    ttsMocks.normalizeTtsAutoMode.mockClear();
    ttsMocks.resolveTtsConfig.mockClear();
    ttsMocks.resolveTtsConfig.mockReturnValue({
      mode: "final",
    });
    replyMediaPathMocks.createReplyMediaPathNormalizer.mockReset();
    replyMediaPathMocks.createReplyMediaPathNormalizer.mockReturnValue(
      async (payload: ReplyPayload) => payload,
    );
    runtimePluginMocks.ensureRuntimePluginsLoaded.mockClear();
  });

  it("loads runtime plugins before reading inbound hook state", async () => {
    setNoAbort();
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "whatsapp",
      SessionKey: "agent:main:main",
    });

    const replyResolver = async () => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(runtimePluginMocks.ensureRuntimePluginsLoaded).toHaveBeenCalledWith({
      config: cfg,
      workspaceDir: expect.any(String),
    });
    expect(runtimePluginMocks.ensureRuntimePluginsLoaded.mock.invocationCallOrder[0]).toBeLessThan(
      hookMocks.runner.hasHooks.mock.invocationCallOrder[0],
    );
  });

  it("does not route when Provider matches OriginatingChannel (even if Surface is missing)", async () => {
    setNoAbort();
    mocks.routeReply.mockClear();
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "slack",
      Surface: undefined,
      OriginatingChannel: "slack",
      OriginatingTo: "channel:C123",
    });

    const replyResolver = async (
      _ctx: MsgContext,
      _opts?: GetReplyOptions,
      _cfg?: OpenClawConfig,
    ) => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(mocks.routeReply).not.toHaveBeenCalled();
    expect(dispatcher.sendFinalReply).toHaveBeenCalledTimes(1);
  });

  it("routes when OriginatingChannel differs from Provider", async () => {
    setNoAbort();
    mocks.routeReply.mockClear();
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "slack",
      AccountId: "acc-1",
      MessageThreadId: 123,
      GroupChannel: "ops-room",
      OriginatingChannel: "telegram",
      OriginatingTo: "telegram:999",
    });

    const replyResolver = async (
      _ctx: MsgContext,
      _opts?: GetReplyOptions,
      _cfg?: OpenClawConfig,
    ) => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(dispatcher.sendFinalReply).not.toHaveBeenCalled();
    expect(mocks.routeReply).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "telegram",
        to: "telegram:999",
        accountId: "acc-1",
        threadId: 123,
        isGroup: true,
        groupId: "telegram:999",
      }),
    );
  });

  it("routes exec-event replies using last route fields when delivery context is missing", async () => {
    setNoAbort();
    mocks.routeReply.mockClear();
    sessionStoreMocks.currentEntry = {
      lastChannel: "discord",
      lastTo: "channel:123",
      lastAccountId: "default",
    };
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "exec-event",
      Surface: "exec-event",
      SessionKey: "agent:main:main",
      AccountId: undefined,
      OriginatingChannel: undefined,
      OriginatingTo: undefined,
    });

    const replyResolver = async () => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(dispatcher.sendFinalReply).not.toHaveBeenCalled();
    expect(mocks.routeReply).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "discord",
        to: "channel:123",
        accountId: "default",
      }),
    );
  });

  it("falls back to thread-scoped session key when current ctx has no MessageThreadId", async () => {
    setNoAbort();
    mocks.routeReply.mockClear();
    sessionStoreMocks.currentEntry = {
      deliveryContext: {
        channel: "discord",
        to: "channel:CHAN1",
        accountId: "default",
      },
      origin: {
        threadId: "stale-origin-root",
      },
      lastThreadId: "stale-origin-root",
    };
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "webchat",
      Surface: "webchat",
      SessionKey: "agent:main:discord:channel:CHAN1:thread:post-root",
      AccountId: "default",
      MessageThreadId: undefined,
      OriginatingChannel: "discord",
      OriginatingTo: "channel:CHAN1",
      ExplicitDeliverRoute: true,
    });

    const replyResolver = async () => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(mocks.routeReply).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "discord",
        to: "channel:CHAN1",
        threadId: "post-root",
      }),
    );
  });

  it("does not resurrect a cleared route thread from origin metadata", async () => {
    setNoAbort();
    mocks.routeReply.mockClear();
    // Simulate the real store: lastThreadId and deliveryContext.threadId may be normalised from
    // origin.threadId on read, but a non-thread session key must still route to channel root.
    sessionStoreMocks.currentEntry = {
      deliveryContext: {
        channel: "mattermost",
        to: "channel:CHAN1",
        accountId: "default",
        threadId: "stale-root",
      },
      lastThreadId: "stale-root",
      origin: {
        threadId: "stale-root",
      },
    };
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "webchat",
      Surface: "webchat",
      SessionKey: "agent:main:mattermost:channel:CHAN1",
      AccountId: "default",
      MessageThreadId: undefined,
      OriginatingChannel: "mattermost",
      OriginatingTo: "channel:CHAN1",
      ExplicitDeliverRoute: true,
    });

    const replyResolver = async () => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    const routeCall = mocks.routeReply.mock.calls[0]?.[0] as
      | { channel?: string; to?: string; threadId?: string | number }
      | undefined;
    expect(routeCall).toMatchObject({
      channel: "mattermost",
      to: "channel:CHAN1",
    });
    expect(routeCall?.threadId).toBeUndefined();
  });

  it("forces suppressTyping when routing to a different originating channel", async () => {
    setNoAbort();
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "slack",
      OriginatingChannel: "telegram",
      OriginatingTo: "telegram:999",
    });

    const replyResolver = async (_ctx: MsgContext, opts?: GetReplyOptions) => {
      expect(opts?.suppressTyping).toBe(true);
      expect(opts?.typingPolicy).toBe("system_event");
      return { text: "hi" } satisfies ReplyPayload;
    };

    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });
  });

  it("forces suppressTyping for internal webchat turns", async () => {
    setNoAbort();
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "webchat",
      Surface: "webchat",
      OriginatingChannel: "webchat",
      OriginatingTo: "session:abc",
    });

    const replyResolver = async (_ctx: MsgContext, opts?: GetReplyOptions) => {
      expect(opts?.suppressTyping).toBe(true);
      expect(opts?.typingPolicy).toBe("internal_webchat");
      return { text: "hi" } satisfies ReplyPayload;
    };

    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });
  });

  it("routes when provider is webchat but surface carries originating channel metadata", async () => {
    setNoAbort();
    mocks.routeReply.mockClear();
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "webchat",
      Surface: "telegram",
      OriginatingChannel: "telegram",
      OriginatingTo: "telegram:999",
    });

    const replyResolver = async () => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(dispatcher.sendFinalReply).not.toHaveBeenCalled();
    expect(mocks.routeReply).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "telegram",
        to: "telegram:999",
      }),
    );
  });

  it("routes Feishu replies when provider is webchat and origin metadata points to Feishu", async () => {
    setNoAbort();
    mocks.routeReply.mockClear();
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "webchat",
      Surface: "feishu",
      OriginatingChannel: "feishu",
      OriginatingTo: "ou_feishu_direct_123",
    });

    const replyResolver = async () => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(dispatcher.sendFinalReply).not.toHaveBeenCalled();
    expect(mocks.routeReply).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "feishu",
        to: "ou_feishu_direct_123",
      }),
    );
  });

  it("does not route when provider already matches originating channel", async () => {
    setNoAbort();
    mocks.routeReply.mockClear();
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "telegram",
      Surface: "webchat",
      OriginatingChannel: "telegram",
      OriginatingTo: "telegram:999",
    });

    const replyResolver = async () => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(mocks.routeReply).not.toHaveBeenCalled();
    expect(dispatcher.sendFinalReply).toHaveBeenCalledTimes(1);
  });

  it("does not route external origin replies when current surface is internal webchat without explicit delivery", async () => {
    setNoAbort();
    mocks.routeReply.mockClear();
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "webchat",
      Surface: "webchat",
      OriginatingChannel: "imessage",
      OriginatingTo: "imessage:+15550001111",
    });

    const replyResolver = async (
      _ctx: MsgContext,
      _opts?: GetReplyOptions,
      _cfg?: OpenClawConfig,
    ) => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(mocks.routeReply).not.toHaveBeenCalled();
    expect(dispatcher.sendFinalReply).toHaveBeenCalledTimes(1);
  });

  it("routes external origin replies for internal webchat turns when explicit delivery is set", async () => {
    setNoAbort();
    mocks.routeReply.mockClear();
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "webchat",
      Surface: "webchat",
      OriginatingChannel: "imessage",
      OriginatingTo: "imessage:+15550001111",
      ExplicitDeliverRoute: true,
    });

    const replyResolver = async (
      _ctx: MsgContext,
      _opts?: GetReplyOptions,
      _cfg?: OpenClawConfig,
    ) => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(dispatcher.sendFinalReply).not.toHaveBeenCalled();
    expect(mocks.routeReply).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "imessage",
        policyConversationType: "direct",
        to: "imessage:+15550001111",
      }),
    );
  });

  it("fast-abort reply includes stopped subagent count when provided", async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: true,
      aborted: true,
      stoppedSubagents: 2,
    });
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "telegram",
      Body: "/stop",
    });

    await dispatchReplyFromConfig({
      ctx,
      cfg,
      dispatcher,
      replyResolver: vi.fn(async () => ({ text: "hi" }) as ReplyPayload),
    });

    expect(dispatcher.sendFinalReply).toHaveBeenCalledWith({
      text: "⚙️ Agent was aborted. Stopped 2 sub-agents.",
    });
  });

  it("emits lifecycle end for ACP turns using the current run id", async () => {
    setNoAbort();
    const runtime = createAcpRuntime([{ type: "text_delta", text: "done" }, { type: "done" }]);
    acpMocks.readAcpSessionEntry.mockReturnValue({
      sessionKey: "agent:codex-acp:session-1",
      storeSessionKey: "agent:codex-acp:session-1",
      cfg: {},
      storePath: "/tmp/mock-sessions.json",
      entry: {},
      acp: {
        backend: "acpx",
        agent: "codex",
        runtimeSessionName: "runtime:1",
        mode: "persistent",
        state: "idle",
        lastActivityAt: Date.now(),
      },
    });
    acpMocks.requireAcpRuntimeBackend.mockReturnValue({
      id: "acpx",
      runtime,
    });

    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "discord",
      Surface: "discord",
      SessionKey: "agent:codex-acp:session-1",
      BodyForAgent: "write a test",
    });

    await dispatchReplyFromConfig({
      ctx,
      cfg: {
        acp: {
          enabled: true,
          dispatch: { enabled: true },
          stream: { coalesceIdleMs: 0, maxChunkChars: 128 },
        },
      } as OpenClawConfig,
      dispatcher,
      replyOptions: {
        runId: "run-acp-lifecycle-end",
      },
    });

    expect(agentEventMocks.emitAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-acp-lifecycle-end",
        sessionKey: "agent:codex-acp:session-1",
        stream: "lifecycle",
        data: expect.objectContaining({
          phase: "end",
        }),
      }),
    );
  });

  it("emits lifecycle error for ACP turn failures using the current run id", async () => {
    setNoAbort();
    const runtime = createAcpRuntime([]);
    runtime.runTurn.mockImplementation(async function* () {
      yield { type: "status", tag: "usage_update", text: "warming up" };
      throw new Error("ACP exploded");
    });
    acpMocks.readAcpSessionEntry.mockReturnValue({
      sessionKey: "agent:codex-acp:session-1",
      storeSessionKey: "agent:codex-acp:session-1",
      cfg: {},
      storePath: "/tmp/mock-sessions.json",
      entry: {},
      acp: {
        backend: "acpx",
        agent: "codex",
        runtimeSessionName: "runtime:1",
        mode: "persistent",
        state: "idle",
        lastActivityAt: Date.now(),
      },
    });
    acpMocks.requireAcpRuntimeBackend.mockReturnValue({
      id: "acpx",
      runtime,
    });

    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "discord",
      Surface: "discord",
      SessionKey: "agent:codex-acp:session-1",
      BodyForAgent: "write a test",
    });

    await dispatchReplyFromConfig({
      ctx,
      cfg: {
        acp: {
          enabled: true,
          dispatch: { enabled: true },
          stream: { coalesceIdleMs: 0, maxChunkChars: 128 },
        },
      } as OpenClawConfig,
      dispatcher,
      replyOptions: {
        runId: "run-acp-lifecycle-error",
      },
    });

    expect(agentEventMocks.emitAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-acp-lifecycle-error",
        sessionKey: "agent:codex-acp:session-1",
        stream: "lifecycle",
        data: expect.objectContaining({
          phase: "error",
          error: expect.stringContaining("ACP exploded"),
        }),
      }),
    );
  });

  it("posts a one-time resolved-session-id notice in thread after the first ACP turn", async () => {
    setNoAbort();
    const runtime = createAcpRuntime([{ type: "text_delta", text: "hello" }, { type: "done" }]);
    const pendingAcp = {
      backend: "acpx",
      agent: "codex",
      runtimeSessionName: "runtime:1",
      identity: {
        state: "pending" as const,
        source: "ensure" as const,
        lastUpdatedAt: Date.now(),
        acpxSessionId: "acpx-123",
        agentSessionId: "inner-123",
      },
      mode: "persistent" as const,
      state: "idle" as const,
      lastActivityAt: Date.now(),
    };
    const resolvedAcp = {
      ...pendingAcp,
      identity: {
        ...pendingAcp.identity,
        state: "resolved" as const,
        source: "status" as const,
      },
    };
    acpMocks.readAcpSessionEntry.mockImplementation(() => {
      const runTurnStarted = runtime.runTurn.mock.calls.length > 0;
      return {
        sessionKey: "agent:codex-acp:session-1",
        storeSessionKey: "agent:codex-acp:session-1",
        cfg: {},
        storePath: "/tmp/mock-sessions.json",
        entry: {},
        acp: runTurnStarted ? resolvedAcp : pendingAcp,
      };
    });
    acpMocks.requireAcpRuntimeBackend.mockReturnValue({
      id: "acpx",
      runtime,
    });

    const cfg = {
      acp: {
        enabled: true,
        dispatch: { enabled: true },
      },
    } as OpenClawConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "discord",
      Surface: "discord",
      SessionKey: "agent:codex-acp:session-1",
      MessageThreadId: "thread-1",
      BodyForAgent: "show ids",
    });

    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver: vi.fn() });

    const finalCalls = (dispatcher.sendFinalReply as ReturnType<typeof vi.fn>).mock.calls;
    expect(finalCalls.length).toBe(2);
    const noticePayload = finalCalls[1]?.[0] as ReplyPayload | undefined;
    expect(noticePayload?.text).toContain("Session ids resolved");
    expect(noticePayload?.text).toContain("agent session id: inner-123");
    expect(noticePayload?.text).toContain("acpx session id: acpx-123");
    expect(noticePayload?.text).toContain("codex resume inner-123");
  });

  it("posts resolved-session-id notice when ACP session is bound even without MessageThreadId", async () => {
    setNoAbort();
    const runtime = createAcpRuntime([{ type: "text_delta", text: "hello" }, { type: "done" }]);
    const pendingAcp = {
      backend: "acpx",
      agent: "codex",
      runtimeSessionName: "runtime:1",
      identity: {
        state: "pending" as const,
        source: "ensure" as const,
        lastUpdatedAt: Date.now(),
        acpxSessionId: "acpx-123",
        agentSessionId: "inner-123",
      },
      mode: "persistent" as const,
      state: "idle" as const,
      lastActivityAt: Date.now(),
    };
    const resolvedAcp = {
      ...pendingAcp,
      identity: {
        ...pendingAcp.identity,
        state: "resolved" as const,
        source: "status" as const,
      },
    };
    acpMocks.readAcpSessionEntry.mockImplementation(() => {
      const runTurnStarted = runtime.runTurn.mock.calls.length > 0;
      return {
        sessionKey: "agent:codex-acp:session-1",
        storeSessionKey: "agent:codex-acp:session-1",
        cfg: {},
        storePath: "/tmp/mock-sessions.json",
        entry: {},
        acp: runTurnStarted ? resolvedAcp : pendingAcp,
      };
    });
    acpMocks.requireAcpRuntimeBackend.mockReturnValue({
      id: "acpx",
      runtime,
    });
    sessionBindingMocks.listBySession.mockReturnValue([
      {
        bindingId: "default:thread-1",
        targetSessionKey: "agent:codex-acp:session-1",
        targetKind: "session",
        conversation: {
          channel: "discord",
          accountId: "default",
          conversationId: "thread-1",
        },
        status: "active",
        boundAt: Date.now(),
      },
    ]);

    const cfg = {
      acp: {
        enabled: true,
        dispatch: { enabled: true },
      },
    } as OpenClawConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "discord",
      Surface: "discord",
      AccountId: "default",
      SessionKey: "agent:codex-acp:session-1",
      MessageThreadId: undefined,
      BodyForAgent: "show ids",
    });

    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver: vi.fn() });

    const finalCalls = (dispatcher.sendFinalReply as ReturnType<typeof vi.fn>).mock.calls;
    expect(finalCalls.length).toBe(2);
    const noticePayload = finalCalls[1]?.[0] as ReplyPayload | undefined;
    expect(noticePayload?.text).toContain("Session ids resolved");
    expect(noticePayload?.text).toContain("agent session id: inner-123");
    expect(noticePayload?.text).toContain("acpx session id: acpx-123");
  });

  it("coalesces tiny ACP token deltas into normal Discord text spacing", async () => {
    setNoAbort();
    const runtime = createAcpRuntime([
      { type: "text_delta", text: "What" },
      { type: "text_delta", text: " do" },
      { type: "text_delta", text: " you" },
      { type: "text_delta", text: " want" },
      { type: "text_delta", text: " to" },
      { type: "text_delta", text: " work" },
      { type: "text_delta", text: " on?" },
      { type: "done" },
    ]);
    acpMocks.readAcpSessionEntry.mockReturnValue({
      sessionKey: "agent:codex-acp:session-1",
      storeSessionKey: "agent:codex-acp:session-1",
      cfg: {},
      storePath: "/tmp/mock-sessions.json",
      entry: {},
      acp: {
        backend: "acpx",
        agent: "codex",
        runtimeSessionName: "runtime:1",
        mode: "persistent",
        state: "idle",
        lastActivityAt: Date.now(),
      },
    });
    acpMocks.requireAcpRuntimeBackend.mockReturnValue({
      id: "acpx",
      runtime,
    });

    const cfg = {
      acp: {
        enabled: true,
        dispatch: { enabled: true },
        stream: { coalesceIdleMs: 0, maxChunkChars: 256 },
      },
    } as OpenClawConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "discord",
      Surface: "discord",
      SessionKey: "agent:codex-acp:session-1",
      BodyForAgent: "test spacing",
    });

    await dispatchReplyFromConfig({ ctx, cfg, dispatcher });

    const blockTexts = (dispatcher.sendBlockReply as ReturnType<typeof vi.fn>).mock.calls
      .map((call) => ((call[0] as ReplyPayload).text ?? "").trim())
      .filter(Boolean);
    expect(blockTexts).toEqual(["What do you want to work on?"]);
    expect(dispatcher.sendFinalReply).toHaveBeenCalledWith(
      expect.objectContaining({ text: "What do you want to work on?" }),
    );
  });

  it("generates final-mode TTS audio after ACP block streaming completes", async () => {
    setNoAbort();
    ttsMocks.state.synthesizeFinalAudio = true;
    const runtime = createAcpRuntime([
      { type: "text_delta", text: "Hello from ACP streaming." },
      { type: "done" },
    ]);
    acpMocks.readAcpSessionEntry.mockReturnValue({
      sessionKey: "agent:codex-acp:session-1",
      storeSessionKey: "agent:codex-acp:session-1",
      cfg: {},
      storePath: "/tmp/mock-sessions.json",
      entry: {},
      acp: {
        backend: "acpx",
        agent: "codex",
        runtimeSessionName: "runtime:1",
        mode: "persistent",
        state: "idle",
        lastActivityAt: Date.now(),
      },
    });
    acpMocks.requireAcpRuntimeBackend.mockReturnValue({
      id: "acpx",
      runtime,
    });

    const cfg = {
      acp: {
        enabled: true,
        dispatch: { enabled: true },
        stream: { coalesceIdleMs: 0, maxChunkChars: 256 },
      },
    } as OpenClawConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "discord",
      Surface: "discord",
      SessionKey: "agent:codex-acp:session-1",
      BodyForAgent: "stream this",
    });

    await dispatchReplyFromConfig({ ctx, cfg, dispatcher });

    const finalPayload = (dispatcher.sendFinalReply as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as ReplyPayload | undefined;
    expect(finalPayload?.mediaUrl).toBe("https://example.com/tts-synth.opus");
    expect(finalPayload?.text).toBeUndefined();
  });

  it("closes oneshot ACP sessions after the turn completes", async () => {
    setNoAbort();
    const runtime = createAcpRuntime([{ type: "done" }]);
    acpMocks.readAcpSessionEntry.mockReturnValue({
      sessionKey: "agent:codex-acp:oneshot-1",
      storeSessionKey: "agent:codex-acp:oneshot-1",
      cfg: {},
      storePath: "/tmp/mock-sessions.json",
      entry: {},
      acp: {
        backend: "acpx",
        agent: "codex",
        runtimeSessionName: "runtime:oneshot",
        mode: "oneshot",
        state: "idle",
        lastActivityAt: Date.now(),
      },
    });
    acpMocks.requireAcpRuntimeBackend.mockReturnValue({
      id: "acpx",
      runtime,
    });

    const cfg = {
      acp: {
        enabled: true,
        dispatch: { enabled: true },
      },
    } as OpenClawConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "discord",
      Surface: "discord",
      SessionKey: "agent:codex-acp:oneshot-1",
      BodyForAgent: "run once",
    });

    await dispatchReplyFromConfig({ ctx, cfg, dispatcher });

    expect(runtime.close).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "oneshot-complete",
      }),
    );
  });

  it("emits message_received hook with originating channel metadata", async () => {
    setNoAbort();
    hookMocks.runner.hasHooks.mockReturnValue(true);
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "slack",
      Surface: "slack",
      OriginatingChannel: "Telegram",
      OriginatingTo: "telegram:999",
      CommandBody: "/search hello",
      RawBody: "raw text",
      Body: "body text",
      Timestamp: 1710000000000,
      MessageSidFull: "sid-full",
      SenderId: "user-1",
      SenderName: "Alice",
      SenderUsername: "alice",
      SenderE164: "+15555550123",
      AccountId: "acc-1",
      GroupSpace: "guild-123",
      GroupChannel: "alerts",
    });

    const replyResolver = async () => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(hookMocks.runner.runMessageReceived).toHaveBeenCalledWith(
      expect.objectContaining({
        from: ctx.From,
        content: "/search hello",
        timestamp: 1710000000000,
        metadata: expect.objectContaining({
          originatingChannel: "Telegram",
          originatingTo: "telegram:999",
          messageId: "sid-full",
          senderId: "user-1",
          senderName: "Alice",
          senderUsername: "alice",
          senderE164: "+15555550123",
          guildId: "guild-123",
          channelName: "alerts",
        }),
      }),
      expect.objectContaining({
        channelId: "telegram",
        accountId: "acc-1",
        conversationId: "telegram:999",
      }),
    );
  });

  it("emits internal message:received hook when a session key is available", async () => {
    setNoAbort();
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "telegram",
      Surface: "telegram",
      SessionKey: "agent:main:main",
      CommandBody: "/help",
      MessageSid: "msg-42",
      GroupSpace: "guild-456",
      GroupChannel: "ops-room",
    });

    const replyResolver = async () => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(internalHookMocks.createInternalHookEvent).toHaveBeenCalledWith(
      "message",
      "received",
      "agent:main:main",
      expect.objectContaining({
        from: ctx.From,
        content: "/help",
        channelId: "telegram",
        messageId: "msg-42",
        metadata: expect.objectContaining({
          guildId: "guild-456",
          channelName: "ops-room",
        }),
      }),
    );
    expect(internalHookMocks.triggerInternalHook).toHaveBeenCalledTimes(1);
  });

  it("skips internal message:received hook when session key is unavailable", async () => {
    setNoAbort();
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "telegram",
      Surface: "telegram",
      CommandBody: "/help",
    });
    (ctx as MsgContext).SessionKey = undefined;

    const replyResolver = async () => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(internalHookMocks.createInternalHookEvent).not.toHaveBeenCalled();
    expect(internalHookMocks.triggerInternalHook).not.toHaveBeenCalled();
  });

  it("falls back to CommandTargetSessionKey for internal hook when SessionKey is empty", async () => {
    setNoAbort();
    const cfg = emptyConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "discord",
      Surface: "discord",
      CommandBody: "hello",
      MessageSid: "msg-99",
    });
    (ctx as MsgContext).SessionKey = undefined;
    (ctx as MsgContext).CommandTargetSessionKey = "agent:main:discord:guild:123";

    const replyResolver = async () => ({ text: "reply" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(internalHookMocks.createInternalHookEvent).toHaveBeenCalledWith(
      "message",
      "received",
      "agent:main:discord:guild:123",
      expect.objectContaining({
        content: "hello",
        messageId: "msg-99",
      }),
    );
    expect(internalHookMocks.triggerInternalHook).toHaveBeenCalledTimes(1);
  });

  it("emits diagnostics when enabled", async () => {
    setNoAbort();
    const cfg = { diagnostics: { enabled: true } } as OpenClawConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "slack",
      Surface: "slack",
      SessionKey: "agent:main:main",
      MessageSid: "msg-1",
      To: "slack:C123",
    });

    const replyResolver = async () => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(diagnosticMocks.logMessageQueued).toHaveBeenCalledTimes(1);
    expect(diagnosticMocks.logSessionStateChange).toHaveBeenCalledWith({
      sessionKey: "agent:main:main",
      state: "processing",
      reason: "message_start",
    });
    expect(diagnosticMocks.logMessageProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "slack",
        outcome: "completed",
        sessionKey: "agent:main:main",
      }),
    );
  });
});

describe("before_dispatch hook", () => {
  const createHookCtx = (overrides: Partial<MsgContext> = {}) =>
    buildTestCtx({
      Body: "hello",
      BodyForAgent: "hello",
      BodyForCommands: "hello",
      From: "user1",
      Surface: "telegram",
      ChatType: "private",
      ...overrides,
    });

  beforeEach(() => {
    resetInboundDedupe();
    mocks.routeReply.mockReset();
    mocks.routeReply.mockResolvedValue({ ok: true, messageId: "mock" });
    threadInfoMocks.parseSessionThreadInfo.mockReset();
    threadInfoMocks.parseSessionThreadInfo.mockImplementation(parseGenericThreadSessionInfo);
    ttsMocks.state.synthesizeFinalAudio = false;
    ttsMocks.maybeApplyTtsToPayload.mockClear();
    setNoAbort();
    hookMocks.runner.runBeforeDispatch.mockClear();
    hookMocks.runner.runBeforeDispatch.mockResolvedValue(undefined);
    hookMocks.runner.runReplyDispatch.mockClear();
    hookMocks.runner.runReplyDispatch.mockResolvedValue(undefined);
    hookMocks.runner.hasHooks.mockImplementation(
      (hookName?: string) => hookName === "before_dispatch",
    );
  });

  it("skips model dispatch when hook returns handled", async () => {
    hookMocks.runner.runBeforeDispatch.mockResolvedValue({ handled: true, text: "Blocked" });
    const dispatcher = createDispatcher();
    const result = await dispatchReplyFromConfig({
      ctx: createHookCtx(),
      cfg: emptyConfig,
      dispatcher,
    });
    expect(dispatcher.sendFinalReply).toHaveBeenCalledWith({ text: "Blocked" });
    expect(result.queuedFinal).toBe(true);
  });

  it("silently short-circuits when hook returns handled without text", async () => {
    hookMocks.runner.runBeforeDispatch.mockResolvedValue({ handled: true });
    const dispatcher = createDispatcher();
    const result = await dispatchReplyFromConfig({
      ctx: createHookCtx(),
      cfg: emptyConfig,
      dispatcher,
    });
    expect(dispatcher.sendFinalReply).not.toHaveBeenCalled();
    expect(result.queuedFinal).toBe(false);
  });

  it("uses canonical hook metadata and shared routed final delivery", async () => {
    ttsMocks.state.synthesizeFinalAudio = true;
    hookMocks.runner.runBeforeDispatch.mockResolvedValue({ handled: true, text: "Blocked" });
    const dispatcher = createDispatcher();
    const ctx = createHookCtx({
      Body: "raw body",
      BodyForAgent: "agent body",
      BodyForCommands: "command body",
      Provider: "slack",
      Surface: "slack",
      OriginatingChannel: "telegram",
      OriginatingTo: "telegram:999",
      From: "signal:group:ops-room",
      SenderId: "signal:user:alice",
      GroupChannel: "ops-room",
      ChatType: "direct",
      Timestamp: 123,
    });

    const result = await dispatchReplyFromConfig({ ctx, cfg: emptyConfig, dispatcher });

    expect(hookMocks.runner.runBeforeDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "command body",
        body: "agent body",
        channel: "telegram",
        senderId: "signal:user:alice",
        isGroup: true,
        timestamp: 123,
      }),
      expect.objectContaining({
        channelId: "telegram",
        senderId: "signal:user:alice",
      }),
    );
    expect(dispatcher.sendFinalReply).not.toHaveBeenCalled();
    expect(mocks.routeReply).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "telegram",
        to: "telegram:999",
        payload: expect.objectContaining({
          text: "Blocked",
          mediaUrl: "https://example.com/tts-synth.opus",
          audioAsVoice: true,
        }),
      }),
    );
    expect(result.queuedFinal).toBe(true);
  });

  it("suppresses before_dispatch handled reply when sendPolicy is deny", async () => {
    setNoAbort();
    sessionStoreMocks.currentEntry = {
      sessionId: "s1",
      updatedAt: 0,
      sendPolicy: "deny",
    };
    hookMocks.runner.runBeforeDispatch.mockResolvedValue({ handled: true, text: "Blocked" });
    const dispatcher = createDispatcher();
    const result = await dispatchReplyFromConfig({
      ctx: createHookCtx({ SessionKey: "test:session" }),
      cfg: emptyConfig,
      dispatcher,
    });
    // Hook handled the message (no model dispatch)
    expect(hookMocks.runner.runBeforeDispatch).toHaveBeenCalled();
    // But delivery must be suppressed
    expect(dispatcher.sendFinalReply).not.toHaveBeenCalled();
    expect(mocks.routeReply).not.toHaveBeenCalled();
    expect(result.queuedFinal).toBe(false);
  });
});
