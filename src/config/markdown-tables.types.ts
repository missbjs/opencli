import type { MarkdownTableMode } from "./types.base.js";
import type { OpenCLIConfig } from "./types.opencli.js";

export type ResolveMarkdownTableModeParams = {
  cfg?: Partial<OpenCLIConfig>;
  channel?: string | null;
  accountId?: string | null;
};

export type ResolveMarkdownTableMode = (
  params: ResolveMarkdownTableModeParams,
) => MarkdownTableMode;
