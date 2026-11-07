// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "GTGraffitiLauncher",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "GTGraffitiLauncher", targets: ["GTGraffitiLauncher"])],
    targets: [
        .target(name: "GTGraffitiCore"),
        .executableTarget(name: "GTGraffitiLauncher", dependencies: ["GTGraffitiCore"]),
        .testTarget(name: "GTGraffitiCoreTests", dependencies: ["GTGraffitiCore"]),
        .testTarget(name: "GTGraffitiLauncherTests", dependencies: ["GTGraffitiLauncher", "GTGraffitiCore"])
    ],
    swiftLanguageModes: [.v5]
)
