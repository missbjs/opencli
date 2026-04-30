import { describeOpenRouterProviderRuntimeContract } from "opencli/plugin-sdk/provider-test-contracts";

describeOpenRouterProviderRuntimeContract(() => import("./index.js"));
