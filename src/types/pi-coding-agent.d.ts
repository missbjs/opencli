export type OpenCLIPiCodingAgentSkillSourceAugmentation = never;

declare module "@mariozechner/pi-coding-agent" {
  interface Skill {
    // OpenCLI relies on the source identifier returned by pi skill loaders.
    source: string;
  }
}
