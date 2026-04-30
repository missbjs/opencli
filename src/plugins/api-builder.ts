import type { OpenCLIConfig } from "../config/types.opencli.js";
import type { PluginRuntime } from "./runtime/types.js";
import type { OpenCLIPluginApi, PluginLogger } from "./types.js";

export type BuildPluginApiParams = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  source: string;
  rootDir?: string;
  registrationMode: OpenCLIPluginApi["registrationMode"];
  config: OpenCLIConfig;
  pluginConfig?: Record<string, unknown>;
  runtime: PluginRuntime;
  logger: PluginLogger;
  resolvePath: (input: string) => string;
  handlers?: Partial<
    Pick<
      OpenCLIPluginApi,
      | "registerTool"
      | "registerHook"
      | "registerHttpRoute"
      | "registerChannel"
      | "registerGatewayMethod"
      | "registerCli"
      | "registerReload"
      | "registerNodeHostCommand"
      | "registerSecurityAuditCollector"
      | "registerService"
      | "registerGatewayDiscoveryService"
      | "registerCliBackend"
      | "registerTextTransforms"
      | "registerConfigMigration"
      | "registerMigrationProvider"
      | "registerAutoEnableProbe"
      | "registerProvider"
      | "registerSpeechProvider"
      | "registerRealtimeTranscriptionProvider"
      | "registerRealtimeVoiceProvider"
      | "registerMediaUnderstandingProvider"
      | "registerImageGenerationProvider"
      | "registerVideoGenerationProvider"
      | "registerMusicGenerationProvider"
      | "registerWebFetchProvider"
      | "registerWebSearchProvider"
      | "registerInteractiveHandler"
      | "onConversationBindingResolved"
      | "registerCommand"
      | "registerContextEngine"
      | "registerCompactionProvider"
      | "registerAgentHarness"
      | "registerCodexAppServerExtensionFactory"
      | "registerAgentToolResultMiddleware"
      | "registerSessionExtension"
      | "enqueueNextTurnInjection"
      | "registerTrustedToolPolicy"
      | "registerToolMetadata"
      | "registerControlUiDescriptor"
      | "registerRuntimeLifecycle"
      | "registerAgentEventSubscription"
      | "setRunContext"
      | "getRunContext"
      | "clearRunContext"
      | "registerSessionSchedulerJob"
      | "registerDetachedTaskRuntime"
      | "registerMemoryCapability"
      | "registerMemoryPromptSection"
      | "registerMemoryPromptSupplement"
      | "registerMemoryCorpusSupplement"
      | "registerMemoryFlushPlan"
      | "registerMemoryRuntime"
      | "registerMemoryEmbeddingProvider"
      | "on"
    >
  >;
};

const noopRegisterTool: OpenCLIPluginApi["registerTool"] = () => {};
const noopRegisterHook: OpenCLIPluginApi["registerHook"] = () => {};
const noopRegisterHttpRoute: OpenCLIPluginApi["registerHttpRoute"] = () => {};
const noopRegisterChannel: OpenCLIPluginApi["registerChannel"] = () => {};
const noopRegisterGatewayMethod: OpenCLIPluginApi["registerGatewayMethod"] = () => {};
const noopRegisterCli: OpenCLIPluginApi["registerCli"] = () => {};
const noopRegisterReload: OpenCLIPluginApi["registerReload"] = () => {};
const noopRegisterNodeHostCommand: OpenCLIPluginApi["registerNodeHostCommand"] = () => {};
const noopRegisterSecurityAuditCollector: OpenCLIPluginApi["registerSecurityAuditCollector"] =
  () => {};
const noopRegisterService: OpenCLIPluginApi["registerService"] = () => {};
const noopRegisterGatewayDiscoveryService: OpenCLIPluginApi["registerGatewayDiscoveryService"] =
  () => {};
const noopRegisterCliBackend: OpenCLIPluginApi["registerCliBackend"] = () => {};
const noopRegisterTextTransforms: OpenCLIPluginApi["registerTextTransforms"] = () => {};
const noopRegisterConfigMigration: OpenCLIPluginApi["registerConfigMigration"] = () => {};
const noopRegisterMigrationProvider: OpenCLIPluginApi["registerMigrationProvider"] = () => {};
const noopRegisterAutoEnableProbe: OpenCLIPluginApi["registerAutoEnableProbe"] = () => {};
const noopRegisterProvider: OpenCLIPluginApi["registerProvider"] = () => {};
const noopRegisterSpeechProvider: OpenCLIPluginApi["registerSpeechProvider"] = () => {};
const noopRegisterRealtimeTranscriptionProvider: OpenCLIPluginApi["registerRealtimeTranscriptionProvider"] =
  () => {};
const noopRegisterRealtimeVoiceProvider: OpenCLIPluginApi["registerRealtimeVoiceProvider"] =
  () => {};
const noopRegisterMediaUnderstandingProvider: OpenCLIPluginApi["registerMediaUnderstandingProvider"] =
  () => {};
const noopRegisterImageGenerationProvider: OpenCLIPluginApi["registerImageGenerationProvider"] =
  () => {};
const noopRegisterVideoGenerationProvider: OpenCLIPluginApi["registerVideoGenerationProvider"] =
  () => {};
const noopRegisterMusicGenerationProvider: OpenCLIPluginApi["registerMusicGenerationProvider"] =
  () => {};
const noopRegisterWebFetchProvider: OpenCLIPluginApi["registerWebFetchProvider"] = () => {};
const noopRegisterWebSearchProvider: OpenCLIPluginApi["registerWebSearchProvider"] = () => {};
const noopRegisterInteractiveHandler: OpenCLIPluginApi["registerInteractiveHandler"] = () => {};
const noopOnConversationBindingResolved: OpenCLIPluginApi["onConversationBindingResolved"] =
  () => {};
const noopRegisterCommand: OpenCLIPluginApi["registerCommand"] = () => {};
const noopRegisterContextEngine: OpenCLIPluginApi["registerContextEngine"] = () => {};
const noopRegisterCompactionProvider: OpenCLIPluginApi["registerCompactionProvider"] = () => {};
const noopRegisterAgentHarness: OpenCLIPluginApi["registerAgentHarness"] = () => {};
const noopRegisterCodexAppServerExtensionFactory: OpenCLIPluginApi["registerCodexAppServerExtensionFactory"] =
  () => {};
const noopRegisterAgentToolResultMiddleware: OpenCLIPluginApi["registerAgentToolResultMiddleware"] =
  () => {};
const noopRegisterSessionExtension: OpenCLIPluginApi["registerSessionExtension"] = () => {};
const noopEnqueueNextTurnInjection: OpenCLIPluginApi["enqueueNextTurnInjection"] = async (
  injection,
) => ({ enqueued: false, id: "", sessionKey: injection.sessionKey });
const noopRegisterTrustedToolPolicy: OpenCLIPluginApi["registerTrustedToolPolicy"] = () => {};
const noopRegisterToolMetadata: OpenCLIPluginApi["registerToolMetadata"] = () => {};
const noopRegisterControlUiDescriptor: OpenCLIPluginApi["registerControlUiDescriptor"] = () => {};
const noopRegisterRuntimeLifecycle: OpenCLIPluginApi["registerRuntimeLifecycle"] = () => {};
const noopRegisterAgentEventSubscription: OpenCLIPluginApi["registerAgentEventSubscription"] =
  () => {};
const noopSetRunContext: OpenCLIPluginApi["setRunContext"] = () => false;
const noopGetRunContext: OpenCLIPluginApi["getRunContext"] = () => undefined;
const noopClearRunContext: OpenCLIPluginApi["clearRunContext"] = () => {};
const noopRegisterSessionSchedulerJob: OpenCLIPluginApi["registerSessionSchedulerJob"] = () =>
  undefined;
const noopRegisterDetachedTaskRuntime: OpenCLIPluginApi["registerDetachedTaskRuntime"] = () => {};
const noopRegisterMemoryCapability: OpenCLIPluginApi["registerMemoryCapability"] = () => {};
const noopRegisterMemoryPromptSection: OpenCLIPluginApi["registerMemoryPromptSection"] = () => {};
const noopRegisterMemoryPromptSupplement: OpenCLIPluginApi["registerMemoryPromptSupplement"] =
  () => {};
const noopRegisterMemoryCorpusSupplement: OpenCLIPluginApi["registerMemoryCorpusSupplement"] =
  () => {};
const noopRegisterMemoryFlushPlan: OpenCLIPluginApi["registerMemoryFlushPlan"] = () => {};
const noopRegisterMemoryRuntime: OpenCLIPluginApi["registerMemoryRuntime"] = () => {};
const noopRegisterMemoryEmbeddingProvider: OpenCLIPluginApi["registerMemoryEmbeddingProvider"] =
  () => {};
const noopOn: OpenCLIPluginApi["on"] = () => {};

export function buildPluginApi(params: BuildPluginApiParams): OpenCLIPluginApi {
  const handlers = params.handlers ?? {};
  return {
    id: params.id,
    name: params.name,
    version: params.version,
    description: params.description,
    source: params.source,
    rootDir: params.rootDir,
    registrationMode: params.registrationMode,
    config: params.config,
    pluginConfig: params.pluginConfig,
    runtime: params.runtime,
    logger: params.logger,
    registerTool: handlers.registerTool ?? noopRegisterTool,
    registerHook: handlers.registerHook ?? noopRegisterHook,
    registerHttpRoute: handlers.registerHttpRoute ?? noopRegisterHttpRoute,
    registerChannel: handlers.registerChannel ?? noopRegisterChannel,
    registerGatewayMethod: handlers.registerGatewayMethod ?? noopRegisterGatewayMethod,
    registerCli: handlers.registerCli ?? noopRegisterCli,
    registerReload: handlers.registerReload ?? noopRegisterReload,
    registerNodeHostCommand: handlers.registerNodeHostCommand ?? noopRegisterNodeHostCommand,
    registerSecurityAuditCollector:
      handlers.registerSecurityAuditCollector ?? noopRegisterSecurityAuditCollector,
    registerService: handlers.registerService ?? noopRegisterService,
    registerGatewayDiscoveryService:
      handlers.registerGatewayDiscoveryService ?? noopRegisterGatewayDiscoveryService,
    registerCliBackend: handlers.registerCliBackend ?? noopRegisterCliBackend,
    registerTextTransforms: handlers.registerTextTransforms ?? noopRegisterTextTransforms,
    registerConfigMigration: handlers.registerConfigMigration ?? noopRegisterConfigMigration,
    registerMigrationProvider: handlers.registerMigrationProvider ?? noopRegisterMigrationProvider,
    registerAutoEnableProbe: handlers.registerAutoEnableProbe ?? noopRegisterAutoEnableProbe,
    registerProvider: handlers.registerProvider ?? noopRegisterProvider,
    registerSpeechProvider: handlers.registerSpeechProvider ?? noopRegisterSpeechProvider,
    registerRealtimeTranscriptionProvider:
      handlers.registerRealtimeTranscriptionProvider ?? noopRegisterRealtimeTranscriptionProvider,
    registerRealtimeVoiceProvider:
      handlers.registerRealtimeVoiceProvider ?? noopRegisterRealtimeVoiceProvider,
    registerMediaUnderstandingProvider:
      handlers.registerMediaUnderstandingProvider ?? noopRegisterMediaUnderstandingProvider,
    registerImageGenerationProvider:
      handlers.registerImageGenerationProvider ?? noopRegisterImageGenerationProvider,
    registerVideoGenerationProvider:
      handlers.registerVideoGenerationProvider ?? noopRegisterVideoGenerationProvider,
    registerMusicGenerationProvider:
      handlers.registerMusicGenerationProvider ?? noopRegisterMusicGenerationProvider,
    registerWebFetchProvider: handlers.registerWebFetchProvider ?? noopRegisterWebFetchProvider,
    registerWebSearchProvider: handlers.registerWebSearchProvider ?? noopRegisterWebSearchProvider,
    registerInteractiveHandler:
      handlers.registerInteractiveHandler ?? noopRegisterInteractiveHandler,
    onConversationBindingResolved:
      handlers.onConversationBindingResolved ?? noopOnConversationBindingResolved,
    registerCommand: handlers.registerCommand ?? noopRegisterCommand,
    registerContextEngine: handlers.registerContextEngine ?? noopRegisterContextEngine,
    registerCompactionProvider:
      handlers.registerCompactionProvider ?? noopRegisterCompactionProvider,
    registerAgentHarness: handlers.registerAgentHarness ?? noopRegisterAgentHarness,
    registerCodexAppServerExtensionFactory:
      handlers.registerCodexAppServerExtensionFactory ?? noopRegisterCodexAppServerExtensionFactory,
    registerAgentToolResultMiddleware:
      handlers.registerAgentToolResultMiddleware ?? noopRegisterAgentToolResultMiddleware,
    registerSessionExtension: handlers.registerSessionExtension ?? noopRegisterSessionExtension,
    enqueueNextTurnInjection: handlers.enqueueNextTurnInjection ?? noopEnqueueNextTurnInjection,
    registerTrustedToolPolicy: handlers.registerTrustedToolPolicy ?? noopRegisterTrustedToolPolicy,
    registerToolMetadata: handlers.registerToolMetadata ?? noopRegisterToolMetadata,
    registerControlUiDescriptor:
      handlers.registerControlUiDescriptor ?? noopRegisterControlUiDescriptor,
    registerRuntimeLifecycle: handlers.registerRuntimeLifecycle ?? noopRegisterRuntimeLifecycle,
    registerAgentEventSubscription:
      handlers.registerAgentEventSubscription ?? noopRegisterAgentEventSubscription,
    setRunContext: handlers.setRunContext ?? noopSetRunContext,
    getRunContext: handlers.getRunContext ?? noopGetRunContext,
    clearRunContext: handlers.clearRunContext ?? noopClearRunContext,
    registerSessionSchedulerJob:
      handlers.registerSessionSchedulerJob ?? noopRegisterSessionSchedulerJob,
    registerDetachedTaskRuntime:
      handlers.registerDetachedTaskRuntime ?? noopRegisterDetachedTaskRuntime,
    registerMemoryCapability: handlers.registerMemoryCapability ?? noopRegisterMemoryCapability,
    registerMemoryPromptSection:
      handlers.registerMemoryPromptSection ?? noopRegisterMemoryPromptSection,
    registerMemoryPromptSupplement:
      handlers.registerMemoryPromptSupplement ?? noopRegisterMemoryPromptSupplement,
    registerMemoryCorpusSupplement:
      handlers.registerMemoryCorpusSupplement ?? noopRegisterMemoryCorpusSupplement,
    registerMemoryFlushPlan: handlers.registerMemoryFlushPlan ?? noopRegisterMemoryFlushPlan,
    registerMemoryRuntime: handlers.registerMemoryRuntime ?? noopRegisterMemoryRuntime,
    registerMemoryEmbeddingProvider:
      handlers.registerMemoryEmbeddingProvider ?? noopRegisterMemoryEmbeddingProvider,
    resolvePath: params.resolvePath,
    on: handlers.on ?? noopOn,
  };
}
