import { describeOpenAIProviderRuntimeContract } from "opencli/plugin-sdk/provider-test-contracts";

describeOpenAIProviderRuntimeContract(() => import("./index.js"));
