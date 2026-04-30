import type { OpenCLIConfig } from "../../config/types.opencli.js";
import type { GetReplyOptions } from "../get-reply-options.types.js";
import type { ReplyPayload } from "../reply-payload.js";
import type { MsgContext } from "../templating.js";

export type GetReplyFromConfig = (
  ctx: MsgContext,
  opts?: GetReplyOptions,
  configOverride?: OpenCLIConfig,
) => Promise<ReplyPayload | ReplyPayload[] | undefined>;
