import AppKit
import Combine
import Foundation
import Darwin
import GTGraffitiCore

struct AppletSession {
    var state: AppletState = .stopped
    var message = ""
    var logs = ""
    var slow = false
    var stopping = false
    var token = UUID()
}

@MainActor final class Library: ObservableObject {
    @Published var applets: [Applet] = []
    @Published var sessions: [UUID: AppletSession] = [:]
    @Published var selected: UUID?
    @Published var openIDs: [UUID] = []
    @Published var error: String?
    @Published var showAdd = false
    @Published var editing: Applet?
    @Published var inspecting: Applet?
    @Published var removing: Applet?
    private var processes: [UUID: OwnedProcess] = [:]
    private var jobs: [UUID: Task<Void, Never>] = [:]
    private var restartIDs: Set<UUID> = []
    private var storageHealthy = true
    private let storageURL: URL
    private let health: URLSession
    private let startupTimeout: TimeInterval
    private let slowAfter: TimeInterval
    private let browserOpener: (URL) -> Bool
    var suiteRoute = "home"
    var pendingSuiteBrowser = false

    init(storageURL: URL? = nil, startupTimeout: TimeInterval = 90, slowAfter: TimeInterval = 15, browserOpener: @escaping (URL) -> Bool = { NSWorkspace.shared.open($0) }) {
        self.browserOpener = browserOpener
        self.startupTimeout = startupTimeout
        self.slowAfter = slowAfter
        self.storageURL = storageURL ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("GT Graffiti Launcher/library.json")
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 2
        configuration.timeoutIntervalForResource = 3
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.connectionProxyDictionary = [:]
        health = URLSession(configuration: configuration, delegate: LocalHealthDelegate(), delegateQueue: nil)
        do {
            applets = try LibraryStorage.read(from: self.storageURL)
            var changed = false
            for index in applets.indices {
                for (old, new, name) in [("soundcheck", "yudo", "Yudo"), ("encore", "sylt", "Sylt"), ("music-venues", "ourscene", "OurScene")] {
                    let oldURL = URL(fileURLWithPath: applets[index].folder)
                    let replacement = oldURL.deletingLastPathComponent().appendingPathComponent(new)
                    if oldURL.lastPathComponent == old && FileManager.default.fileExists(atPath: replacement.appendingPathComponent("package.json").path) {
                        applets[index].folder = replacement.path; applets[index].name = name; changed = true
                    }
                }
                if applets[index].id == SuiteConfiguration.id, let current = SuiteConfiguration.applet() { applets[index] = current; changed = true }
            }
            if changed { try LibraryStorage.write(applets, to: self.storageURL) }
        }
        catch {
            storageHealthy = false
            self.error = "Your library couldn’t be read. It has been preserved at \(self.storageURL.path). Restore or repair that file, then reopen GT Graffiti Launcher. \(error.localizedDescription)"
        }
    }

    var activeCount: Int { processes.count }
    func isManaged(_ id: UUID) -> Bool { processes[id] != nil }
    var current: Applet? { applets.first { $0.id == selected } }
    func session(_ id: UUID) -> AppletSession { sessions[id] ?? AppletSession() }

    func save(_ applet: Applet) -> Bool {
        guard storageHealthy else { error = "Restore your existing library and reopen GT Graffiti Launcher before making changes."; return false }
        if let problem = validate(applet) { error = problem; return false }
        var next = applets
        if let index = next.firstIndex(where: { $0.id == applet.id }) { next[index] = applet }
        else { next.append(applet) }
        return persist(next)
    }

    func validate(_ applet: Applet) -> String? {
        if applet.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Give this Graffiti app a name." }
        if applet.command.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Enter the command you use to start this Graffiti app." }
        var directory: ObjCBool = false
        if !FileManager.default.fileExists(atPath: applet.folder, isDirectory: &directory) || !directory.boolValue { return "The project folder is missing. Choose an existing folder in Settings." }
        if LocalAddress.parse(applet.address) == nil { return "Use a local HTTP address, such as http://localhost:3000. Only localhost, 127.0.0.1, and ::1 are supported." }
        if applets.contains(where: { $0.id != applet.id && $0.folder == applet.folder }) { return "This project is already in your library." }
        return nil
    }

    @discardableResult private func persist(_ next: [Applet]) -> Bool {
        guard storageHealthy else { return false }
        do { try LibraryStorage.write(next, to: storageURL); applets = next; return true }
        catch { self.error = "Couldn’t save your library. \(error.localizedDescription)"; return false }
    }

    func toggleFavorite(_ applet: Applet) {
        var next = applets
        if let index = next.firstIndex(where: { $0.id == applet.id }) { next[index].favorite.toggle(); persist(next) }
    }

    func remove(_ applet: Applet) {
        guard processes[applet.id] == nil else { error = "Stop this Graffiti app before removing it."; return }
        if persist(applets.filter { $0.id != applet.id }) {
            close(applet.id); sessions.removeValue(forKey: applet.id)
        }
    }

    func open(_ applet: Applet) {
        if applet.id == SuiteConfiguration.id { pendingSuiteBrowser = true }
        if !openIDs.contains(applet.id) { openIDs.append(applet.id) }
        selected = applet.id
        var next = applets
        if let index = next.firstIndex(where: { $0.id == applet.id }) { next[index].lastOpened = Date(); persist(next) }
        if processes[applet.id] == nil && session(applet.id).state != .starting { start(applet) }
        openPendingSuiteBrowser(applet)
    }

    func close(_ id: UUID) {
        openIDs.removeAll { $0 == id }
        if selected == id { selected = nil }
    }

    func start(_ applet: Applet) {
        guard processes[applet.id] == nil, session(applet.id).state != .starting else { return }
        if let problem = validate(applet) { fail(applet.id, problem); return }
        guard let url = LocalAddress.parse(applet.address) else { return }
        let duplicate = applets.first { other in
            other.id != applet.id && (processes[other.id] != nil || session(other.id).state == .starting)
            && LocalAddress.parse(other.address).map { LocalAddress.endpoint($0) == LocalAddress.endpoint(url) } == true
        }
        if let duplicate { fail(applet.id, "This port is being used by \(duplicate.name). Stop that Graffiti app or choose a different port in Settings."); return }
        let token = UUID()
        sessions[applet.id] = AppletSession(state: .starting, message: "Checking the local address…", token: token)
        jobs[applet.id] = Task { [weak self] in
            guard let self else { return }
            if await Self.portOccupied(url) {
                guard valid(applet.id, token) else { return }
                fail(applet.id, "Port \(url.port ?? 80) is already in use. Stop the other server, or change the launch command and address in Settings.")
                return
            }
            guard valid(applet.id, token), !Task.isCancelled else { return }
            do {
                let process = try OwnedProcess(folder: applet.folder, command: applet.command, onOutput: { [weak self] text in
                    Task { @MainActor in
                        guard let self, self.sessions[applet.id]?.token == token else { return }
                        self.sessions[applet.id]?.logs.append(text)
                        if let logs = self.sessions[applet.id]?.logs, logs.utf8.count > 120_000 {
                            self.sessions[applet.id]?.logs = String(logs.suffix(80_000))
                        }
                    }
                }, onExit: { [weak self] code in
                    Task { @MainActor in self?.didExit(applet, token: token, code: code) }
                })
                processes[applet.id] = process
                sessions[applet.id]?.message = "Waiting for your Graffiti app…"
                let began = Date()
                while valid(applet.id, token), !Task.isCancelled {
                    let isReady = await ready(url)
                    guard valid(applet.id, token), !Task.isCancelled else { return }
                    if isReady {
                        sessions[applet.id]?.state = .running
                        sessions[applet.id]?.message = ""
                        jobs.removeValue(forKey: applet.id)
                        openPendingSuiteBrowser(applet)
                        return
                    }
                    if Date().timeIntervalSince(began) > slowAfter { sessions[applet.id]?.slow = true }
                    if Date().timeIntervalSince(began) > startupTimeout {
                        fail(applet.id, "The Graffiti app didn’t respond within \(Int(startupTimeout)) seconds. Check the address and logs, then try again.")
                        processes[applet.id]?.stop()
                        return
                    }
                    try? await Task.sleep(for: .milliseconds(500))
                }
            } catch { fail(applet.id, "Couldn’t start the Graffiti app. \(error.localizedDescription)") }
        }
    }

    private func valid(_ id: UUID, _ token: UUID) -> Bool {
        sessions[id]?.token == token && sessions[id]?.state == .starting && sessions[id]?.stopping == false
    }

    private func ready(_ url: URL) async -> Bool {
        var request = URLRequest(url: url); request.timeoutInterval = 2
        do {
            let (_, response) = try await health.data(for: request)
            guard let http = response as? HTTPURLResponse else { return false }
            return (200..<400).contains(http.statusCode)
        } catch { return false }
    }

    // A TCP check also catches servers that accept connections but don't speak HTTP.
    private static func portOccupied(_ url: URL) async -> Bool {
        await Task.detached(priority: .utility) {
            let port = UInt16(url.port ?? 80)
            let ipv4 = url.host != "[::1]" && url.host != "::1"
            let families: [Int32] = url.host == "localhost" ? [AF_INET, AF_INET6] : [ipv4 ? AF_INET : AF_INET6]
            for family in families {
                let fd = socket(family, SOCK_STREAM, 0)
                guard fd >= 0 else { continue }
                defer { Darwin.close(fd) }
                _ = fcntl(fd, F_SETFL, O_NONBLOCK)
                var result: Int32 = -1
                if family == AF_INET {
                    var address = sockaddr_in(); address.sin_family = sa_family_t(AF_INET); address.sin_port = port.bigEndian
                    address.sin_addr.s_addr = inet_addr("127.0.0.1")
                    result = withUnsafePointer(to: &address) { ptr in ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { connect(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) } }
                } else {
                    var address = sockaddr_in6(); address.sin6_family = sa_family_t(AF_INET6); address.sin6_port = port.bigEndian; address.sin6_addr = in6addr_loopback
                    result = withUnsafePointer(to: &address) { ptr in ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { connect(fd, $0, socklen_t(MemoryLayout<sockaddr_in6>.size)) } }
                }
                if result == 0 { return true }
                if errno == EINPROGRESS {
                    var pollFD = pollfd(fd: fd, events: Int16(POLLOUT), revents: 0)
                    if poll(&pollFD, 1, 300) > 0 {
                        var error: Int32 = 0; var size = socklen_t(MemoryLayout<Int32>.size)
                        if getsockopt(fd, SOL_SOCKET, SO_ERROR, &error, &size) == 0 && error == 0 { return true }
                    }
                }
            }
            return false
        }.value
    }

    private func fail(_ id: UUID, _ message: String) {
        if sessions[id] == nil { sessions[id] = AppletSession() }
        sessions[id]?.state = .attention; sessions[id]?.message = message
    }

    func openPendingSuiteBrowser(_ applet: Applet) {
        guard applet.id == SuiteConfiguration.id, pendingSuiteBrowser, session(applet.id).state == .running,
              !session(applet.id).stopping, var url = LocalAddress.parse(applet.address) else { return }
        pendingSuiteBrowser = false
        url.appendPathComponent(suiteRoute == "home" ? "" : suiteRoute + "/")
        if !browserOpener(url) { error = "Couldn’t open your default browser. Open \(url.absoluteString) in Safari or Chrome." }
    }

    func stop(_ applet: Applet) {
        if applet.id == SuiteConfiguration.id { pendingSuiteBrowser = false }
        restartIDs.remove(applet.id)
        stopProcess(applet.id)
    }
    private func stopProcess(_ id: UUID) {
        jobs.removeValue(forKey: id)?.cancel()
        if let process = processes[id] {
            sessions[id]?.stopping = true
            sessions[id]?.message = "Stopping…"
            process.stop()
        } else { sessions[id] = AppletSession() }
    }
    func restart(_ applet: Applet) {
        if processes[applet.id] != nil { restartIDs.insert(applet.id); stopProcess(applet.id) }
        else { start(applet) }
    }
    private func didExit(_ applet: Applet, token: UUID, code: Int32) {
        guard sessions[applet.id]?.token == token else { return }
        processes.removeValue(forKey: applet.id)
        jobs.removeValue(forKey: applet.id)?.cancel()
        if session(applet.id).stopping {
            sessions[applet.id]?.state = .stopped; sessions[applet.id]?.message = ""; sessions[applet.id]?.stopping = false
        } else if session(applet.id).state != .attention {
            fail(applet.id, "The Graffiti app exited\(code == 0 ? "" : " with code \(code)"). Check its logs and launch command, then try again.")
        }
        if restartIDs.remove(applet.id) != nil, let latest = applets.first(where: { $0.id == applet.id }) { start(latest) }
    }
    func shutdown() {
        restartIDs.removeAll()
        for job in jobs.values { job.cancel() }
        for id in Array(processes.keys) { stopProcess(id) }
    }
    func forceShutdown() { processes.values.forEach { $0.forceStop() } }
}

private final class LocalHealthDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}
