import Testing
@testable import OpenCLI

@Suite(.serialized) struct OpenCLIAppDelegateTests {
    @Test @MainActor func resolvesRegistryModelBeforeViewTaskAssignsDelegateModel() {
        let registryModel = NodeAppModel()
        OpenCLIAppModelRegistry.appModel = registryModel
        defer { OpenCLIAppModelRegistry.appModel = nil }

        let delegate = OpenCLIAppDelegate()

        #expect(delegate._test_resolvedAppModel() === registryModel)
    }

    @Test @MainActor func prefersExplicitDelegateModelOverRegistryFallback() {
        let registryModel = NodeAppModel()
        let explicitModel = NodeAppModel()
        OpenCLIAppModelRegistry.appModel = registryModel
        defer { OpenCLIAppModelRegistry.appModel = nil }

        let delegate = OpenCLIAppDelegate()
        delegate.appModel = explicitModel

        #expect(delegate._test_resolvedAppModel() === explicitModel)
    }
}
