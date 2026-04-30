import { describePluginRegistrationContract } from "opencli/plugin-sdk/plugin-test-contracts";

describePluginRegistrationContract({
  pluginId: "together",
  providerIds: ["together"],
  videoGenerationProviderIds: ["together"],
  requireGenerateVideo: true,
});
