import { describeGithubCopilotProviderRuntimeContract } from "opencli/plugin-sdk/provider-test-contracts";

describeGithubCopilotProviderRuntimeContract(() => import("./index.js"));
