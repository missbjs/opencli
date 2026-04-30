import { pluginRegistrationContractCases } from "opencli/plugin-sdk/plugin-test-contracts";
import { describePluginRegistrationContract } from "opencli/plugin-sdk/plugin-test-contracts";

describePluginRegistrationContract({
  ...pluginRegistrationContractCases.openai,
  videoGenerationProviderIds: ["openai"],
  requireGenerateImage: true,
  requireGenerateVideo: true,
});
