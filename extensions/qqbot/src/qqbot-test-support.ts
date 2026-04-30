import type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";

export function makeQqbotSecretRefConfig(): OpenCLIConfig {
  return {
    channels: {
      qqbot: {
        appId: "123456",
        clientSecret: {
          source: "env",
          provider: "default",
          id: "QQBOT_CLIENT_SECRET",
        },
      },
    },
  } as OpenCLIConfig;
}

export function makeQqbotDefaultAccountConfig(): OpenCLIConfig {
  return {
    channels: {
      qqbot: {
        defaultAccount: "bot2",
        accounts: {
          bot2: { appId: "123456" },
        },
      },
    },
  } as OpenCLIConfig;
}
