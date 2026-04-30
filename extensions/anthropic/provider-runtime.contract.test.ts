import { describeAnthropicProviderRuntimeContract } from "opencli/plugin-sdk/provider-test-contracts";

describeAnthropicProviderRuntimeContract(() => import("./index.js"));
