import fs from "node:fs";
import path from "node:path";
import { resolveOpenCLIPackageRoot } from "../infra/opencli-root.js";

export const OPENCLI_DOCS_URL = "https://docs.opencli.ai";
export const OPENCLI_SOURCE_URL = "https://github.com/opencli/opencli";

type ResolveOpenCLIReferencePathParams = {
  workspaceDir?: string;
  argv1?: string;
  cwd?: string;
  moduleUrl?: string;
};

function isUsableDocsDir(docsDir: string): boolean {
  return fs.existsSync(path.join(docsDir, "docs.json"));
}

function isGitCheckout(rootDir: string): boolean {
  return fs.existsSync(path.join(rootDir, ".git"));
}

export async function resolveOpenCLIDocsPath(params: {
  workspaceDir?: string;
  argv1?: string;
  cwd?: string;
  moduleUrl?: string;
}): Promise<string | null> {
  const workspaceDir = params.workspaceDir?.trim();
  if (workspaceDir) {
    const workspaceDocs = path.join(workspaceDir, "docs");
    if (isUsableDocsDir(workspaceDocs)) {
      return workspaceDocs;
    }
  }

  const packageRoot = await resolveOpenCLIPackageRoot({
    cwd: params.cwd,
    argv1: params.argv1,
    moduleUrl: params.moduleUrl,
  });
  if (!packageRoot) {
    return null;
  }

  const packageDocs = path.join(packageRoot, "docs");
  return isUsableDocsDir(packageDocs) ? packageDocs : null;
}

export async function resolveOpenCLISourcePath(
  params: ResolveOpenCLIReferencePathParams,
): Promise<string | null> {
  const packageRoot = await resolveOpenCLIPackageRoot({
    cwd: params.cwd,
    argv1: params.argv1,
    moduleUrl: params.moduleUrl,
  });
  if (!packageRoot || !isGitCheckout(packageRoot)) {
    return null;
  }
  return packageRoot;
}

export async function resolveOpenCLIReferencePaths(
  params: ResolveOpenCLIReferencePathParams,
): Promise<{
  docsPath: string | null;
  sourcePath: string | null;
}> {
  const [docsPath, sourcePath] = await Promise.all([
    resolveOpenCLIDocsPath(params),
    resolveOpenCLISourcePath(params),
  ]);
  return { docsPath, sourcePath };
}
