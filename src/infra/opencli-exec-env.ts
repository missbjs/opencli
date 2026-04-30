export const OPENCLI_CLI_ENV_VAR = "OPENCLI_CLI";
export const OPENCLI_CLI_ENV_VALUE = "1";

export function markOpenCLIExecEnv<T extends Record<string, string | undefined>>(env: T): T {
  return {
    ...env,
    [OPENCLI_CLI_ENV_VAR]: OPENCLI_CLI_ENV_VALUE,
  };
}

export function ensureOpenCLIExecMarkerOnProcess(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[OPENCLI_CLI_ENV_VAR] = OPENCLI_CLI_ENV_VALUE;
  return env;
}
