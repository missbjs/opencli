import type { ModelCatalogProvider } from "../types.js";

export type OpenCLIProviderIndexPluginInstall = {
  npmSpec: string;
  defaultChoice?: "npm";
  minHostVersion?: string;
  expectedIntegrity?: string;
};

export type OpenCLIProviderIndexPlugin = {
  id: string;
  package?: string;
  source?: string;
  install?: OpenCLIProviderIndexPluginInstall;
};

export type OpenCLIProviderIndexProviderAuthChoice = {
  method: string;
  choiceId: string;
  choiceLabel: string;
  choiceHint?: string;
  assistantPriority?: number;
  assistantVisibility?: "visible" | "manual-only";
  groupId?: string;
  groupLabel?: string;
  groupHint?: string;
  optionKey?: string;
  cliFlag?: string;
  cliOption?: string;
  cliDescription?: string;
  onboardingScopes?: readonly ("text-inference" | "image-generation")[];
};

export type OpenCLIProviderIndexProvider = {
  id: string;
  name: string;
  plugin: OpenCLIProviderIndexPlugin;
  docs?: string;
  categories?: readonly string[];
  authChoices?: readonly OpenCLIProviderIndexProviderAuthChoice[];
  previewCatalog?: ModelCatalogProvider;
};

export type OpenCLIProviderIndex = {
  version: number;
  providers: Readonly<Record<string, OpenCLIProviderIndexProvider>>;
};
