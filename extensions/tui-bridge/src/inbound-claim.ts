import type {
  PluginHookInboundClaimContext,
  PluginHookInboundClaimEvent,
} from "openclaw/plugin-sdk/plugin-entry";
import type { ReplyPayload } from "openclaw/plugin-sdk/reply-payload";
import { readBindingData } from "./binding-data.js";
import { defaultLogRoot } from "./persistence.js";
import { getSession, readReply, startSession, waitForSettle, writeStdin } from "./process-pool.js";
import { resolveConfig } from "./types.js";

export async function handleTuiInboundClaim(
  event: PluginHookInboundClaimEvent,
  ctx: PluginHookInboundClaimContext,
  options: { pluginConfig?: unknown } = {},
): Promise<{ handled: boolean; reply?: ReplyPayload } | undefined> {
  const data = readBindingData(ctx.pluginBinding);
  if (!data) return undefined;

  if (event.commandAuthorized !== true) {
    return { handled: true };
  }

  const sessionKey = ctx.sessionKey ?? event.sessionKey;
  if (!sessionKey) {
    return {
      handled: true,
      reply: { text: "TUI bridge: no sessionKey on inbound message; cannot route." },
    };
  }

  const cfg = resolveConfig(options.pluginConfig);
  let session = getSession(sessionKey);
  if (!session) {
    try {
      session = await startSession({
        sessionKey,
        command: data.command,
        args: data.args,
        cwd: data.cwd,
        mode: data.mode,
        cols: cfg.cols,
        rows: cfg.rows,
        logRoot: cfg.logDir ?? defaultLogRoot(),
      });
    } catch (error) {
      return {
        handled: true,
        reply: {
          text: `TUI bridge: failed to respawn ${data.command}: ${(error as Error).message}`,
        },
      };
    }
  }

  const text = (event.bodyForAgent ?? event.content ?? "").trim();
  if (!text) return { handled: true };

  writeStdin(session, `${text}\n`);
  await waitForSettle(session, { idleMs: cfg.settleIdleMs, maxMs: cfg.settleMaxMs });

  if (session.exitInfo) {
    const reply = readReply(session) || "(TUI exited with no output)";
    return {
      handled: true,
      reply: { text: `${reply}\n\n[TUI exited code=${session.exitInfo.code ?? "?"}]` },
    };
  }

  const reply = readReply(session);
  return { handled: true, reply: { text: reply || "(no output)" } };
}
