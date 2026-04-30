// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "OpenCLIKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "OpenCLIProtocol", targets: ["OpenCLIProtocol"]),
        .library(name: "OpenCLIKit", targets: ["OpenCLIKit"]),
        .library(name: "OpenCLIChatUI", targets: ["OpenCLIChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.1"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "OpenCLIProtocol",
            path: "Sources/OpenCLIProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "OpenCLIKit",
            dependencies: [
                "OpenCLIProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            path: "Sources/OpenCLIKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "OpenCLIChatUI",
            dependencies: [
                "OpenCLIKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/OpenCLIChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "OpenCLIKitTests",
            dependencies: ["OpenCLIKit", "OpenCLIChatUI"],
            path: "Tests/OpenCLIKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
