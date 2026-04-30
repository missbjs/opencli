import { describeVeniceProviderRuntimeContract } from "opencli/plugin-sdk/provider-test-contracts";

describeVeniceProviderRuntimeContract(() => import("./index.js"));
