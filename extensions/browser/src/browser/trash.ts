import os from "node:os";
import { movePathToTrash as movePathToTrashWithAllowedRoots } from "opencli/plugin-sdk/browser-config";
import { resolvePreferredOpenCLITmpDir } from "opencli/plugin-sdk/temp-path";

export async function movePathToTrash(targetPath: string): Promise<string> {
  return await movePathToTrashWithAllowedRoots(targetPath, {
    allowedRoots: [os.homedir(), resolvePreferredOpenCLITmpDir()],
  });
}
