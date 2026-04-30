import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export function defaultLogRoot(): string {
  return join(homedir(), ".openclaw", "tui-bridge");
}

export function safeKey(sessionKey: string): string {
  const hash = createHash("sha1").update(sessionKey).digest("hex").slice(0, 12);
  const slug = sessionKey.replace(/[^a-zA-Z0-9_.-]+/g, "_").slice(0, 40);
  return `${slug}-${hash}`;
}

export async function ensureSessionDir(root: string, sessionKey: string): Promise<string> {
  const dir = join(root, safeKey(sessionKey));
  await mkdir(dir, { recursive: true });
  return dir;
}

export function sessionLogPath(root: string, sessionKey: string): string {
  return join(root, safeKey(sessionKey), "session.log");
}
