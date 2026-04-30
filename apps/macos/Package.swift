// swift-tools-version: 6.2
// Package manifest for the OpenCLI macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "OpenCLI",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "OpenCLIIPC", targets: ["OpenCLIIPC"]),
        .library(name: "OpenCLIDiscovery", targets: ["OpenCLIDiscovery"]),
        .executable(name: "OpenCLI", targets: ["OpenCLI"]),
        .executable(name: "opencli-mac", targets: ["OpenCLIMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.3.0"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.4.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.10.1"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.9.0"),
        .package(url: "https://github.com/steipete/Peekaboo.git", exact: "3.0.0-beta4"),
        .package(path: "../shared/OpenCLIKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "OpenCLIIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "OpenCLIDiscovery",
            dependencies: [
                .product(name: "OpenCLIKit", package: "OpenCLIKit"),
            ],
            path: "Sources/OpenCLIDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "OpenCLI",
            dependencies: [
                "OpenCLIIPC",
                "OpenCLIDiscovery",
                .product(name: "OpenCLIKit", package: "OpenCLIKit"),
                .product(name: "OpenCLIChatUI", package: "OpenCLIKit"),
                .product(name: "OpenCLIProtocol", package: "OpenCLIKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/OpenCLI.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "OpenCLIMacCLI",
            dependencies: [
                "OpenCLIDiscovery",
                .product(name: "OpenCLIKit", package: "OpenCLIKit"),
                .product(name: "OpenCLIProtocol", package: "OpenCLIKit"),
            ],
            path: "Sources/OpenCLIMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "OpenCLIIPCTests",
            dependencies: [
                "OpenCLIIPC",
                "OpenCLI",
                "OpenCLIDiscovery",
                .product(name: "OpenCLIProtocol", package: "OpenCLIKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
