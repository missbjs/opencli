import type { OpenCLIConfig } from "../../config/types.js";

export type DirectoryConfigParams = {
  cfg: OpenCLIConfig;
  accountId?: string | null;
  query?: string | null;
  limit?: number | null;
};
