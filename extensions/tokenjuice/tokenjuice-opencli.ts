declare module "tokenjuice/opencli" {
  type OpenCLIPiRuntime = {
    on(event: string, handler: (event: unknown, ctx: { cwd: string }) => unknown): void;
  };

  export function createTokenjuiceOpenCLIEmbeddedExtension(): (pi: OpenCLIPiRuntime) => void;
}
