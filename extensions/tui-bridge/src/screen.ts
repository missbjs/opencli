import stripAnsi from "strip-ansi";

export function scrubTxt(raw: string): string {
  return stripAnsi(raw).replace(/\r\n?/g, "\n");
}

export type TuiScreen = {
  feed(data: string): void;
  snapshot(): string;
  dispose(): void;
};

export async function createTuiScreen(cols: number, rows: number): Promise<TuiScreen> {
  const { Terminal } = await import("@xterm/headless");
  const term = new Terminal({ cols, rows, allowProposedApi: true, scrollback: 0 });
  return {
    feed(data) {
      term.write(data);
    },
    snapshot() {
      const buf = term.buffer.active;
      const lines: string[] = [];
      for (let y = 0; y < buf.length; y++) {
        const line = buf.getLine(y);
        lines.push(line ? line.translateToString(true) : "");
      }
      while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
      return lines.join("\n");
    },
    dispose() {
      term.dispose();
    },
  };
}
