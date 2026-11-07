import AppKit

let output = CommandLine.arguments[1]
var entries = Data()
func lengthBytes(_ value: Int) -> Data {
    var length = UInt32(value).bigEndian
    return withUnsafeBytes(of: &length) { Data($0) }
}
for size in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let pixels = size * scale
        let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        bitmap.size = NSSize(width: pixels, height: pixels)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        let context = NSGraphicsContext.current!.cgContext
        context.scaleBy(x: CGFloat(pixels) / 1024, y: CGFloat(pixels) / 1024)
        GTArtwork.draw(in: context)
        NSGraphicsContext.restoreGraphicsState()
        let types = ["16-1": "icp4", "16-2": "ic11", "32-1": "icp5", "32-2": "ic12", "128-1": "ic07", "128-2": "ic13", "256-1": "ic08", "256-2": "ic14", "512-1": "ic09", "512-2": "ic10"]
        let png = bitmap.representation(using: .png, properties: [:])!
        entries.append(Data(types["\(size)-\(scale)"]!.utf8))
        entries.append(lengthBytes(png.count + 8))
        entries.append(png)
    }
}
var icon = Data("icns".utf8)
icon.append(lengthBytes(entries.count + 8)); icon.append(entries)
try icon.write(to: URL(fileURLWithPath: output))
