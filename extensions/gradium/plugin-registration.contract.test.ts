import { describePluginRegistrationContract } from "opencli/plugin-sdk/plugin-test-contracts";

describePluginRegistrationContract({
  pluginId: "gradium",
  speechProviderIds: ["gradium"],
});
