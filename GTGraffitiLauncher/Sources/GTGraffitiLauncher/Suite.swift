import Foundation
import AppKit
import GTGraffitiCore

enum SuiteConfiguration {
    static let id = UUID(uuidString: "39F3646C-9814-438B-809E-A7657E585AF0")!
    static func applet() -> Applet? {
        let fm = FileManager.default
        let bundled = Bundle.main.resourceURL?.appendingPathComponent("workspace")
        let source = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("workspace")
        guard let folder = [bundled, source].compactMap({ $0 }).first(where: { fm.fileExists(atPath: $0.appendingPathComponent("server.mjs").path) && fm.fileExists(atPath: $0.appendingPathComponent("dist/index.html").path) }) else { return nil }
        let tools = folder.appendingPathComponent("tools/bin")
        let node = fm.isExecutableFile(atPath: tools.appendingPathComponent("node").path) ? tools.appendingPathComponent("node").path : "/opt/homebrew/bin/node"
        let ffmpeg = fm.isExecutableFile(atPath: tools.appendingPathComponent("ffmpeg").path) ? tools.appendingPathComponent("ffmpeg").path : "/opt/homebrew/bin/ffmpeg"
        let ffprobe = fm.isExecutableFile(atPath: tools.appendingPathComponent("ffprobe").path) ? tools.appendingPathComponent("ffprobe").path : "/opt/homebrew/bin/ffprobe"
        func quote(_ s: String) -> String { "'" + s.replacingOccurrences(of: "'", with: "'\\''") + "'" }
        return Applet(id: id, name: "GT Graffiti Workspace", summary: "Yudo · Sylt · OurScene", symbol: "music.note.house", folder: folder.path, command: "GT_FFMPEG=\(quote(ffmpeg)) GT_FFPROBE=\(quote(ffprobe)) \(quote(node)) server.mjs", address: "http://127.0.0.1:5178", favorite: true)
    }
    static func trusted(_ applet: Applet) -> Bool { applet.id == id && applet.folder == Self.applet()?.folder && applet.address == "http://127.0.0.1:5178" }
}

extension Library {
    func openSuite(_ route: String = "home") {
        guard let item = SuiteConfiguration.applet() else { error = "The workspace assets are missing. Build GT Graffiti Launcher with scripts/build.sh."; return }
        if !applets.contains(where: { $0.id == item.id }) { guard save(item) else { return } }
        suiteRoute = ["home", "yudo", "sylt", "ourscene"].contains(route) ? route : "home"
        open(applets.first(where: { $0.id == item.id }) ?? item)
    }
}
extension Notification.Name { static let suiteNavigate = Notification.Name("GTGraffitiLauncher.suiteNavigate") }
