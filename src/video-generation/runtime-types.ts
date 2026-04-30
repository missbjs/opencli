import type { AuthProfileStore } from "../agents/auth-profiles/types.js";
import type { FallbackAttempt } from "../agents/model-fallback.types.js";
import type { OpenCLIConfig } from "../config/types.opencli.js";
import type {
  GeneratedVideoAsset,
  VideoGenerationIgnoredOverride,
  VideoGenerationNormalization,
  VideoGenerationProvider,
  VideoGenerationResolution,
  VideoGenerationSourceAsset,
} from "./types.js";

export type GenerateVideoParams = {
  cfg: OpenCLIConfig;
  prompt: string;
  agentDir?: string;
  authStore?: AuthProfileStore;
  modelOverride?: string;
  size?: string;
  aspectRatio?: string;
  resolution?: VideoGenerationResolution;
  durationSeconds?: number;
  audio?: boolean;
  watermark?: boolean;
  inputImages?: VideoGenerationSourceAsset[];
  inputVideos?: VideoGenerationSourceAsset[];
  inputAudios?: VideoGenerationSourceAsset[];
  /** Arbitrary provider-specific options forwarded as-is to provider.generateVideo. */
  providerOptions?: Record<string, unknown>;
  /** Optional per-request provider timeout in milliseconds. */
  timeoutMs?: number;
};

export type GenerateVideoRuntimeResult = {
  videos: GeneratedVideoAsset[];
  provider: string;
  model: string;
  attempts: FallbackAttempt[];
  normalization?: VideoGenerationNormalization;
  metadata?: Record<string, unknown>;
  ignoredOverrides: VideoGenerationIgnoredOverride[];
};

export type ListRuntimeVideoGenerationProvidersParams = {
  config?: OpenCLIConfig;
};

export type RuntimeVideoGenerationProvider = VideoGenerationProvider;
