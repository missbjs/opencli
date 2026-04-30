import { describe, expect, it, vi } from "vitest";
import { wrapChatLogForOnceCapture } from "./tui.js";

describe("wrapChatLogForOnceCapture", () => {
  function makeFakeChatLog() {
    return {
      finalizeAssistant: vi.fn(),
      updateAssistant: vi.fn(),
      addSystem: vi.fn(),
      dropAssistant: vi.fn(),
      startTool: vi.fn(),
      updateToolResult: vi.fn(),
    };
  }

  it("forwards finalizeAssistant to the underlying chatLog and fires the capture once", () => {
    const fake = makeFakeChatLog();
    const onFirstFinal = vi.fn();
    const wrapped = wrapChatLogForOnceCapture(fake, onFirstFinal);

    wrapped.finalizeAssistant("hello", "run-1");

    expect(fake.finalizeAssistant).toHaveBeenCalledTimes(1);
    expect(fake.finalizeAssistant).toHaveBeenCalledWith("hello", "run-1");
    expect(onFirstFinal).toHaveBeenCalledTimes(1);
    expect(onFirstFinal).toHaveBeenCalledWith({ text: "hello", runId: "run-1" });
  });

  it("does not fire the capture more than once across multiple finalizeAssistant calls", () => {
    const fake = makeFakeChatLog();
    const onFirstFinal = vi.fn();
    const wrapped = wrapChatLogForOnceCapture(fake, onFirstFinal);

    wrapped.finalizeAssistant("first", "run-1");
    wrapped.finalizeAssistant("second", "run-2");
    wrapped.finalizeAssistant("third", "run-3");

    expect(fake.finalizeAssistant).toHaveBeenCalledTimes(3);
    expect(onFirstFinal).toHaveBeenCalledTimes(1);
    expect(onFirstFinal).toHaveBeenCalledWith({ text: "first", runId: "run-1" });
  });

  it("passes through other chatLog methods unchanged", () => {
    const fake = makeFakeChatLog();
    const onFirstFinal = vi.fn();
    const wrapped = wrapChatLogForOnceCapture(fake, onFirstFinal);

    wrapped.updateAssistant("partial", "run-1");
    wrapped.addSystem("sys note");
    wrapped.dropAssistant("run-1");

    expect(fake.updateAssistant).toHaveBeenCalledWith("partial", "run-1");
    expect(fake.addSystem).toHaveBeenCalledWith("sys note");
    expect(fake.dropAssistant).toHaveBeenCalledWith("run-1");
    expect(onFirstFinal).not.toHaveBeenCalled();
  });
});
