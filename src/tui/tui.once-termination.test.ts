// Verifies that once-mode termination callback fires for every terminal
// state of a chat run — final, final-empty, final-command, aborted, error.
// Without these, once-mode hangs on agent error/abort/empty-final paths.

import { describe, expect, it, vi } from "vitest";
import { createEventHandlers, type RunTerminationReason } from "./tui-event-handlers.js";
import type { ChatEvent, TuiStateAccess } from "./tui-types.js";

type RunTerminatedFn = (info: {
  runId: string;
  reason: RunTerminationReason;
  errorMessage?: string;
}) => void;
type Mock = ReturnType<typeof vi.fn<RunTerminatedFn>>;

function makeState(overrides?: Partial<TuiStateAccess>): TuiStateAccess {
  return {
    agentDefaultId: "main",
    sessionMainKey: "agent:main:main",
    sessionScope: "global",
    agents: [],
    currentAgentId: "main",
    currentSessionKey: "agent:main:main",
    currentSessionId: "session-1",
    activeChatRunId: "run-1",
    pendingOptimisticUserMessage: false,
    historyLoaded: true,
    sessionInfo: { verboseLevel: "on" },
    initialSessionApplied: true,
    isConnected: true,
    autoMessageSent: false,
    toolsExpanded: false,
    showThinking: false,
    connectionStatus: "connected",
    activityStatus: "idle",
    statusTimeout: null,
    lastCtrlCAt: 0,
    ...overrides,
  };
}

function makeChatLog() {
  return {
    startTool: vi.fn(),
    updateToolResult: vi.fn(),
    addSystem: vi.fn(),
    updateAssistant: vi.fn(),
    finalizeAssistant: vi.fn(),
    dropAssistant: vi.fn(),
  };
}

function makeHarness(opts: { onRunTerminated: Mock }) {
  const state = makeState();
  const chatLog = makeChatLog();
  const tui = { requestRender: vi.fn() };
  const btw = { showResult: vi.fn(), clear: vi.fn() };
  const handlers = createEventHandlers({
    chatLog,
    btw,
    tui,
    state,
    setActivityStatus: vi.fn(),
    loadHistory: vi.fn(),
    onRunTerminated: opts.onRunTerminated,
  });
  return { handlers, chatLog, tui, state };
}

describe("once-mode termination callback", () => {
  it("fires reason=final on a normal final reply with text", () => {
    const onRunTerminated: Mock = vi.fn<RunTerminatedFn>();
    const { handlers } = makeHarness({ onRunTerminated });
    const evt: ChatEvent = {
      runId: "run-1",
      sessionKey: "agent:main:main",
      state: "final",
      message: { role: "assistant", content: [{ type: "text", text: "hello" }] },
    };
    handlers.handleChatEvent(evt);
    expect(onRunTerminated).toHaveBeenCalledTimes(1);
    expect(onRunTerminated).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", reason: "final" }),
    );
  });

  it("fires reason=final-empty when final has no message", () => {
    const onRunTerminated: Mock = vi.fn<RunTerminatedFn>();
    const { handlers } = makeHarness({ onRunTerminated });
    handlers.handleChatEvent({
      runId: "run-1",
      sessionKey: "agent:main:main",
      state: "final",
    } as ChatEvent);
    expect(onRunTerminated).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", reason: "final-empty" }),
    );
  });

  it("fires reason=aborted on an aborted run", () => {
    const onRunTerminated: Mock = vi.fn<RunTerminatedFn>();
    const { handlers } = makeHarness({ onRunTerminated });
    handlers.handleChatEvent({
      runId: "run-1",
      sessionKey: "agent:main:main",
      state: "aborted",
    });
    expect(onRunTerminated).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", reason: "aborted" }),
    );
  });

  it("fires reason=error with errorMessage on an errored run", () => {
    const onRunTerminated: Mock = vi.fn<RunTerminatedFn>();
    const { handlers } = makeHarness({ onRunTerminated });
    handlers.handleChatEvent({
      runId: "run-1",
      sessionKey: "agent:main:main",
      state: "error",
      errorMessage: "model auth failed",
    });
    expect(onRunTerminated).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-1",
        reason: "error",
        errorMessage: "model auth failed",
      }),
    );
  });

  it("does not fire on streaming delta events", () => {
    const onRunTerminated: Mock = vi.fn<RunTerminatedFn>();
    const { handlers } = makeHarness({ onRunTerminated });
    handlers.handleChatEvent({
      runId: "run-1",
      sessionKey: "agent:main:main",
      state: "delta",
      message: { role: "assistant", content: [{ type: "text", text: "partial" }] },
    });
    expect(onRunTerminated).not.toHaveBeenCalled();
  });
});
