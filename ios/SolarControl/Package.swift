// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "SolarControl",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        // Um projeto xtool tem exatamente um library product: o app.
        .library(name: "SolarControl", targets: ["SolarControl"]),
    ],
    dependencies: [
        .package(path: "SolarCore"),
    ],
    targets: [
        .target(
            name: "SolarControl",
            dependencies: [
                .product(name: "SolarCore", package: "SolarCore"),
            ]
        ),
    ],
    swiftLanguageModes: [.v5]
)
