import Foundation
import Testing
@testable import OpenCLI

@Suite(.serialized) struct NodeServiceManagerTests {
    @Test func `builds node service commands with current CLI shape`() async throws {
        try await TestIsolation.withUserDefaultsValues(["opencli.gatewayProjectRootPath": nil]) {
            let tmp = try makeTempDirForTests()
            CommandResolver.setProjectRoot(tmp.path)

            let opencliPath = tmp.appendingPathComponent("node_modules/.bin/opencli")
            try makeExecutableForTests(at: opencliPath)

            let start = NodeServiceManager._testServiceCommand(["start"])
            #expect(start == [opencliPath.path, "node", "start", "--json"])

            let stop = NodeServiceManager._testServiceCommand(["stop"])
            #expect(stop == [opencliPath.path, "node", "stop", "--json"])
        }
    }
}
