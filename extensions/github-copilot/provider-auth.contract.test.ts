import { describeGithubCopilotProviderAuthContract } from "opencli/plugin-sdk/provider-test-contracts";

describeGithubCopilotProviderAuthContract(() => import("./index.js"));
