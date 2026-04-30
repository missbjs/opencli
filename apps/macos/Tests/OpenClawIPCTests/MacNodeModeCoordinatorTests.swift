import Foundation
import OpenCLIKit
import Testing
@testable import OpenCLI

struct MacNodeModeCoordinatorTests {
    @Test func `remote mode does not advertise browser proxy`() {
        let caps = MacNodeModeCoordinator.resolvedCaps(
            browserControlEnabled: true,
            cameraEnabled: false,
            locationMode: .off,
            connectionMode: .remote)
        let commands = MacNodeModeCoordinator.resolvedCommands(caps: caps)

        #expect(!caps.contains(OpenCLICapability.browser.rawValue))
        #expect(!commands.contains(OpenCLIBrowserCommand.proxy.rawValue))
        #expect(commands.contains(OpenCLICanvasCommand.present.rawValue))
        #expect(commands.contains(OpenCLISystemCommand.notify.rawValue))
    }

    @Test func `local mode advertises browser proxy when enabled`() {
        let caps = MacNodeModeCoordinator.resolvedCaps(
            browserControlEnabled: true,
            cameraEnabled: false,
            locationMode: .off,
            connectionMode: .local)
        let commands = MacNodeModeCoordinator.resolvedCommands(caps: caps)

        #expect(caps.contains(OpenCLICapability.browser.rawValue))
        #expect(commands.contains(OpenCLIBrowserCommand.proxy.rawValue))
    }
}
