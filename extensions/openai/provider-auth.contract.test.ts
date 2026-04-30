import { describeOpenAICodexProviderAuthContract } from "opencli/plugin-sdk/provider-test-contracts";

describeOpenAICodexProviderAuthContract(() => import("./index.js"));
