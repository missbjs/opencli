import { describeGoogleProviderRuntimeContract } from "opencli/plugin-sdk/provider-test-contracts";

describeGoogleProviderRuntimeContract(() => import("./index.js"));
