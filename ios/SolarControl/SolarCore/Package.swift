// swift-tools-version: 6.0

import PackageDescription

// Núcleo sem SwiftUI: modelos, cliente da API e regras de negócio.
// Compila no Linux, então `swift test` roda no Ubuntu/WSL.
let package = Package(
    name: "SolarCore",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(name: "SolarCore", targets: ["SolarCore"]),
    ],
    targets: [
        .target(name: "SolarCore"),
        .testTarget(name: "SolarCoreTests", dependencies: ["SolarCore"]),
    ],
    swiftLanguageModes: [.v5]
)
