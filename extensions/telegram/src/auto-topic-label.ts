import type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";
import { generateConversationLabel } from "opencli/plugin-sdk/reply-dispatch-runtime";
export {
  AUTO_TOPIC_LABEL_DEFAULT_PROMPT,
  resolveAutoTopicLabelConfig,
} from "./auto-topic-label-config.js";

export async function generateTelegramTopicLabel(params: {
  userMessage: string;
  prompt: string;
  cfg: OpenCLIConfig;
  agentId?: string;
  agentDir?: string;
}): Promise<string | null> {
  return await generateConversationLabel({
    ...params,
    maxLength: 128,
  });
}
