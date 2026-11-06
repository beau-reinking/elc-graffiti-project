import XCTest
import GTGraffitiCore
@testable import GTGraffitiLauncher

@MainActor final class LibraryTests: XCTestCase {
    func testRenamedProjectPathsMigrateWithoutChangingOtherEntries() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("GTMigration-" + UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        for folder in ["yudo", "sylt", "ourscene", "unrelated"] {
            let dir = root.appendingPathComponent(folder)
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try Data("{}".utf8).write(to: dir.appendingPathComponent("package.json"))
        }
        let entries = ["soundcheck", "encore", "music-venues", "unrelated"].map { Applet(name: $0, folder: root.appendingPathComponent($0).path, command: "npm start", address: "http://127.0.0.1:5178") }
        let storage = root.appendingPathComponent("library.json")
        try LibraryStorage.write(entries, to: storage)
        let library = Library(storageURL: storage)
        XCTAssertEqual(library.applets.map { URL(fileURLWithPath: $0.folder).lastPathComponent }, ["yudo", "sylt", "ourscene", "unrelated"])
        XCTAssertEqual(library.applets.map(\.id), entries.map(\.id))
        XCTAssertEqual(library.applets.last, entries.last)
    }
    private func fixture(timeout: TimeInterval = 90, slowAfter: TimeInterval = 15) throws -> (Library, URL) {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("GTGraffitiLauncherRuntime-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let library = Library(storageURL: folder.appendingPathComponent("library.json"), startupTimeout: timeout, slowAfter: slowAfter)
        addTeardownBlock {
            await MainActor.run { library.shutdown(); library.forceShutdown() }
            try? FileManager.default.removeItem(at: folder)
        }
        return (library, folder)
    }
    private func port() throws -> Int {
        let fd = socket(AF_INET, SOCK_STREAM, 0)
        defer { Darwin.close(fd) }
        var address = sockaddr_in(); address.sin_family = sa_family_t(AF_INET); address.sin_addr.s_addr = inet_addr("127.0.0.1")
        let bound = withUnsafePointer(to: &address) { ptr in ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) } }
        guard bound == 0 else { throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno)) }
        var length = socklen_t(MemoryLayout<sockaddr_in>.size)
        _ = withUnsafeMutablePointer(to: &address) { ptr in ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { getsockname(fd, $0, &length) } }
        return Int(UInt16(bigEndian: address.sin_port))
    }
    private func eventually(_ message: String, timeout: TimeInterval = 10, _ condition: () -> Bool) async {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition(), Date() < deadline { try? await Task.sleep(for: .milliseconds(100)) }
        XCTAssertTrue(condition(), message)
    }
    private func webApplet(folder: URL, name: String, port: Int) -> Applet {
        Applet(name: name, folder: folder.path, command: "/usr/bin/python3 -u -m http.server \(port) --bind 127.0.0.1", address: "http://127.0.0.1:\(port)")
    }

    func testSuiteBrowserWaitsForReadinessAndKeepsLatestRoute() async throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("GTBrowser-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var opened: [URL] = []
        let library = Library(storageURL: folder.appendingPathComponent("library.json"), browserOpener: { opened.append($0); return true })
        defer { library.shutdown(); library.forceShutdown(); try? FileManager.default.removeItem(at: folder) }
        var applet = webApplet(folder: folder, name: "Workspace", port: try port())
        applet.id = SuiteConfiguration.id
        applet.command = "sleep 1; " + applet.command
        library.suiteRoute = "yudo"
        library.open(applet)
        XCTAssertTrue(opened.isEmpty)
        library.suiteRoute = "sylt"
        library.open(applet)
        XCTAssertTrue(opened.isEmpty)
        await eventually("Browser should open after readiness") { opened.count == 1 }
        XCTAssertEqual(library.session(applet.id).state, .running)
        XCTAssertEqual(opened.first?.path, "/sylt")
        library.suiteRoute = "ourscene"
        library.open(applet)
        XCTAssertEqual(opened.last?.path, "/ourscene")
        XCTAssertEqual(library.activeCount, 1)
        library.stop(applet)
        await eventually("Server should stop") { library.activeCount == 0 }
    }

    func testCancelledSuiteStartupDoesNotOpenBrowser() async throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("GTBrowserCancel-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var opened = false
        let library = Library(storageURL: folder.appendingPathComponent("library.json"), browserOpener: { _ in opened = true; return true })
        defer { library.shutdown(); library.forceShutdown(); try? FileManager.default.removeItem(at: folder) }
        let applet = Applet(id: SuiteConfiguration.id, name: "Workspace", folder: folder.path, command: "sleep 60", address: "http://127.0.0.1:\(try port())")
        library.open(applet)
        library.stop(applet)
        try? await Task.sleep(for: .milliseconds(600))
        XCTAssertFalse(opened)
        XCTAssertFalse(library.pendingSuiteBrowser)
    }

    func testLaunchTwoSwitchRestartStopAndPersist() async throws {
        let (library, folder) = try fixture()
        let secondFolder = folder.appendingPathComponent("second")
        try FileManager.default.createDirectory(at: secondFolder, withIntermediateDirectories: true)
        let first = webApplet(folder: folder, name: "First", port: try port())
        let second = webApplet(folder: secondFolder, name: "Second", port: try port())
        XCTAssertTrue(library.save(first)); XCTAssertTrue(library.save(second))
        library.open(first)
        await eventually("First applet should be ready") { library.session(first.id).state == .running }
        library.open(second)
        await eventually("Second applet should be ready") { library.session(second.id).state == .running }
        XCTAssertEqual(library.activeCount, 2)
        library.selected = nil; library.open(first)
        XCTAssertEqual(library.session(second.id).state, .running)
        library.restart(first)
        await eventually("Restart should return to running") { library.session(first.id).state == .running && !library.session(first.id).stopping }
        library.toggleFavorite(first)
        let restored = Library(storageURL: folder.appendingPathComponent("library.json"))
        XCTAssertTrue(restored.applets.first(where: { $0.id == first.id })!.favorite)
        XCTAssertNotNil(restored.applets.first(where: { $0.id == first.id })!.lastOpened)
        library.stop(first); library.stop(second)
        await eventually("All owned processes should stop") { library.activeCount == 0 }
        XCTAssertEqual(library.session(first.id).state, .stopped)
        library.remove(first)
        XCTAssertFalse(library.applets.contains { $0.id == first.id })
        XCTAssertTrue(FileManager.default.fileExists(atPath: folder.path))
    }

    func testOccupiedPortDoesNotLaunchAnotherCommand() async throws {
        let (library, folder) = try fixture()
        let first = webApplet(folder: folder, name: "Server", port: try port())
        library.start(first)
        await eventually("Server should start") { library.session(first.id).state == .running }
        let otherFolder = folder.appendingPathComponent("other")
        try FileManager.default.createDirectory(at: otherFolder, withIntermediateDirectories: true)
        let contender = Applet(name: "Contender", folder: otherFolder.path, command: "echo must-not-run", address: first.address)
        library.start(contender)
        await eventually("Occupied port should be explained") { library.session(contender.id).state == .attention }
        XCTAssertTrue(library.session(contender.id).message.contains("already in use"))
        XCTAssertEqual(library.session(contender.id).logs, "")
        XCTAssertEqual(library.activeCount, 1)
    }

    func testMissingFolderFailedLaunchAndUnexpectedExit() async throws {
        let (library, folder) = try fixture()
        let missing = Applet(name: "Missing", folder: folder.appendingPathComponent("missing").path, command: "echo test")
        library.start(missing)
        XCTAssertEqual(library.session(missing.id).state, .attention)
        XCTAssertTrue(library.session(missing.id).message.contains("folder is missing"))
        let failed = Applet(name: "Failure", folder: folder.path, command: "echo dependency-missing >&2; exit 7", address: "http://localhost:\(try port())")
        library.start(failed)
        await eventually("Failed launch should be explained") { library.session(failed.id).state == .attention }
        XCTAssertTrue(library.session(failed.id).logs.contains("dependency-missing"))
        XCTAssertTrue(library.session(failed.id).message.contains("code 7"))
        var exits = webApplet(folder: folder, name: "Exits", port: try port())
        exits.command += " & server=$!; sleep 2; kill $server; wait $server"
        library.start(exits)
        await eventually("Applet should initially start") { library.session(exits.id).state == .running }
        await eventually("Unexpected exit should be explained") { library.session(exits.id).state == .attention }
        XCTAssertTrue(library.session(exits.id).message.contains("exited"))
    }

    func testSlowStartupTimeoutAndCancellation() async throws {
        let (library, folder) = try fixture(timeout: 1.5, slowAfter: 0.1)
        let app = Applet(name: "Slow", folder: folder.path, command: "sleep 60", address: "http://localhost:\(try port())")
        library.start(app)
        await eventually("Slow startup should be visible") { library.session(app.id).slow }
        await eventually("Timeout should give an actionable message") { library.session(app.id).state == .attention }
        await eventually("Timeout should stop the process") { library.activeCount == 0 }
        XCTAssertTrue(library.session(app.id).message.contains("didn’t respond"))
        library.start(app); library.stop(app)
        try? await Task.sleep(for: .milliseconds(500))
        XCTAssertEqual(library.session(app.id).state, .stopped)
        XCTAssertEqual(library.activeCount, 0)
    }

    func testCorruptLibraryIsPreserved() throws {
        let (library, folder) = try fixture()
        XCTAssertTrue(library.applets.isEmpty)
        let url = folder.appendingPathComponent("library.json")
        let bad = Data("broken-library".utf8)
        try bad.write(to: url)
        let restored = Library(storageURL: url)
        XCTAssertNotNil(restored.error)
        XCTAssertFalse(restored.save(Applet(name: "New", folder: folder.path, command: "echo test")))
        XCTAssertEqual(try Data(contentsOf: url), bad)
    }
}
