import Foundation

public struct Applet: Identifiable, Codable, Equatable {
    public var id: UUID
    public var name: String
    public var summary: String
    public var symbol: String
    public var folder: String
    public var command: String
    public var address: String
    public var favorite: Bool
    public var lastOpened: Date?

    public init(id: UUID = UUID(), name: String = "", summary: String = "", symbol: String = "square.stack.3d.up", folder: String = "", command: String = "", address: String = "http://localhost:3000", favorite: Bool = false, lastOpened: Date? = nil) {
        self.id = id; self.name = name; self.summary = summary; self.symbol = symbol
        self.folder = folder; self.command = command; self.address = address
        self.favorite = favorite; self.lastOpened = lastOpened
    }
}

public enum AppletState: String {
    case stopped = "Stopped", starting = "Starting", running = "Running", attention = "Needs attention"
}

public enum LocalAddress {
    public static func parse(_ value: String) -> URL? {
        guard let parts = URLComponents(string: value), parts.scheme == "http",
              let host = parts.host?.lowercased(),
              ["localhost", "127.0.0.1", "[::1]", "::1"].contains(host),
              parts.user == nil, parts.password == nil,
              let url = parts.url else { return nil }
        if let port = parts.port, !(1...65535).contains(port) { return nil }
        return url
    }

    public static func endpoint(_ url: URL) -> String {
        let host = url.host == "localhost" || url.host == "127.0.0.1" ? "loopback" : (url.host ?? "")
        return "\(host):\(url.port ?? 80)"
    }
}

public enum ProjectDetector {
    public static func suggest(folder: URL) -> Applet {
        var app = Applet(name: folder.lastPathComponent.replacingOccurrences(of: "-", with: " ").capitalized, folder: folder.path)
        let fm = FileManager.default
        let package = folder.appendingPathComponent("package.json")
        if let data = try? Data(contentsOf: package),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            let scripts = json["scripts"] as? [String: String] ?? [:]
            let script = scripts["dev"] != nil ? "dev" : (scripts["start"] != nil ? "start" : nil)
            let runner: String
            if fm.fileExists(atPath: folder.appendingPathComponent("pnpm-lock.yaml").path) { runner = "pnpm" }
            else if fm.fileExists(atPath: folder.appendingPathComponent("yarn.lock").path) { runner = "yarn" }
            else if fm.fileExists(atPath: folder.appendingPathComponent("bun.lock").path) || fm.fileExists(atPath: folder.appendingPathComponent("bun.lockb").path) { runner = "bun" }
            else { runner = "npm" }
            if let script { app.command = "\(runner) run \(script)" }
            if let description = json["description"] as? String { app.summary = description }
            if let script, let command = scripts[script] {
                var port = command.contains("vite") ? 5173 : (command.contains("astro") ? 4321 : 3000)
                if let regex = try? NSRegularExpression(pattern: #"(?:--port(?:=|\s+)|-p\s+|PORT=)(\d+)"#),
                   let match = regex.firstMatch(in: command, range: NSRange(command.startIndex..., in: command)),
                   let range = Range(match.range(at: 1), in: command), let explicit = Int(command[range]) { port = explicit }
                app.address = "http://localhost:\(port)"
            }
        }
        return app
    }
}

public struct LibraryDocument: Codable {
    public var version: Int = 1
    public var applets: [Applet]
    public init(applets: [Applet]) { self.applets = applets }
}

public enum LibraryStorage {
    public static func read(from url: URL) throws -> [Applet] {
        guard FileManager.default.fileExists(atPath: url.path) else { return [] }
        let document = try JSONDecoder().decode(LibraryDocument.self, from: Data(contentsOf: url))
        guard document.version == 1 else {
            throw NSError(domain: "GTGraffitiLauncher", code: 1, userInfo: [NSLocalizedDescriptionKey: "This library was created by a newer version of GT Graffiti Launcher."])
        }
        return document.applets
    }
    public static func write(_ applets: [Applet], to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(LibraryDocument(applets: applets)).write(to: url, options: .atomic)
    }
}
