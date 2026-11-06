import AppKit

/// Original vector artwork shared by the workspace and packaged application icon.
public enum GTArtwork {
    public static func draw(in context: CGContext) {
        context.saveGState()
        defer { context.restoreGState() }
        let charcoal = CGColor(red: 0.10, green: 0.11, blue: 0.13, alpha: 1)
        let lime = CGColor(red: 0.76, green: 0.98, blue: 0.18, alpha: 1)
        let pink = CGColor(red: 0.98, green: 0.17, blue: 0.57, alpha: 1)
        context.setFillColor(charcoal)
        context.addPath(CGPath(roundedRect: CGRect(x: 60, y: 60, width: 904, height: 904), cornerWidth: 205, cornerHeight: 205, transform: nil))
        context.fillPath()
        // Deterministic overspray keeps the mark identical at every icon size.
        context.setFillColor(lime.copy(alpha: 0.18)!)
        for i in 0..<43 {
            let x = CGFloat(150 + (i * 97) % 730)
            let y = CGFloat(170 + (i * 157) % 680)
            let r = CGFloat(3 + i % 7)
            context.fillEllipse(in: CGRect(x: x, y: y, width: r, height: r))
        }
        func polygon(_ points: [(CGFloat, CGFloat)], _ color: CGColor) {
            context.beginPath()
            context.move(to: CGPoint(x: points[0].0, y: points[0].1))
            for p in points.dropFirst() { context.addLine(to: CGPoint(x: p.0, y: p.1)) }
            context.closePath(); context.setFillColor(color); context.fillPath()
        }
        // Slashed underline and paint drips.
        polygon([(178, 260), (835, 325), (785, 255), (160, 205)], pink)
        polygon([(736, 291), (760, 291), (745, 170), (728, 185)], pink)
        polygon([(290, 244), (305, 244), (297, 184), (283, 194)], pink)
        // Angular G: open upper-right corner, inset crossbar.
        polygon([(215, 715), (495, 755), (460, 665), (290, 646), (258, 438), (391, 455), (405, 515), (337, 506), (352, 581), (490, 601), (455, 382), (159, 343)], lime)
        // Angular T with a forward slash stem.
        polygon([(516, 756), (884, 803), (854, 703), (727, 687), (671, 394), (558, 377), (615, 672), (494, 656)], lime)
        polygon([(817, 612), (862, 655), (852, 566), (808, 529)], pink)
    }

    public static func image(size: Int) -> NSImage {
        let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        let context = NSGraphicsContext.current!.cgContext
        context.scaleBy(x: CGFloat(size) / 1024, y: CGFloat(size) / 1024)
        draw(in: context)
        NSGraphicsContext.restoreGraphicsState()
        let image = NSImage(size: NSSize(width: size, height: size))
        image.addRepresentation(bitmap)
        return image
    }
}
