import { describeZAIProviderRuntimeContract } from "opencli/plugin-sdk/provider-test-contracts";

describeZAIProviderRuntimeContract(() => import("./index.js"));
