import { describeModelStudioProviderDiscoveryContract } from "opencli/plugin-sdk/provider-test-contracts";

describeModelStudioProviderDiscoveryContract(() => import("./index.js"));
