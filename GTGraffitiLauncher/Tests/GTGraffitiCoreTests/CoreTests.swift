import XCTest
@testable import GTGraffitiCore

final class CoreTests: XCTestCase {
    func temporaryFolder() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("GTGraffitiLauncherTests-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        addTeardownBlock { try? FileManager.default.removeItem(at: url) }
        return url
    }

    func testOnlyLoopbackHTTPAddressesAreAccepted() {
        for address in ["http://localhost:3000", "http://127.0.0.1:5173/a?q=1", "http://[::1]:8000"] { XCTAssertNotNil(LocalAddress.parse(address), address) }
        for address in ["https://localhost:3000", "http://example.com", "file:///tmp/a", "http://localhost.evil.com", "http://user:password@localhost:3000", "http://localhost:0", "http://localhost:65536", "javascript:alert(1)", "http://0.0.0.0:3000"] { XCTAssertNil(LocalAddress.parse(address), address) }
        XCTAssertEqual(LocalAddress.endpoint(URL(string: "http://localhost:3000")!), LocalAddress.endpoint(URL(string: "http://127.0.0.1:3000/path")!))
    }

    func testDetectsPackageRunnerAndExplicitPortWithoutExecutingProject() throws {
        let folder = try temporaryFolder()
        try Data(#"{"scripts":{"dev":"vite --port=4872"},"description":"A useful tool"}"#.utf8).write(to: folder.appendingPathComponent("package.json"))
        try Data().write(to: folder.appendingPathComponent("pnpm-lock.yaml"))
        let app = ProjectDetector.suggest(folder: folder)
        XCTAssertEqual(app.command, "pnpm run dev")
        XCTAssertEqual(app.address, "http://localhost:4872")
        XCTAssertEqual(app.summary, "A useful tool")
        try Data(#"{"scripts":{"dev":"vite"}}"#.utf8).write(to: folder.appendingPathComponent("package.json"))
        XCTAssertEqual(ProjectDetector.suggest(folder: folder).address, "http://localhost:5173")
    }

    func testUnknownProjectKeepsManualSetupAvailable() throws {
        let app = ProjectDetector.suggest(folder: try temporaryFolder())
        XCTAssertEqual(app.command, "")
        XCTAssertFalse(app.name.isEmpty)
    }

    func testStorageRoundTripAndCorruptionDoesNotOverwrite() throws {
        let folder = try temporaryFolder(), url = folder.appendingPathComponent("library.json")
        XCTAssertEqual(try LibraryStorage.read(from: url), [])
        let app = Applet(name: "Notebook", folder: folder.path, command: "npm run dev", favorite: true, lastOpened: Date(timeIntervalSince1970: 1234))
        try LibraryStorage.write([app], to: url)
        XCTAssertEqual(try LibraryStorage.read(from: url), [app])
        let bad = Data("broken".utf8)
        try bad.write(to: url)
        XCTAssertThrowsError(try LibraryStorage.read(from: url))
        XCTAssertEqual(try Data(contentsOf: url), bad)
    }

    func testProcessCapturesOutputWorkingDirectoryAndExitCode() throws {
        let folder = try temporaryFolder(), exited = expectation(description: "exit")
        let output = LockedText()
        let process = try OwnedProcess(folder: folder.path, command: "pwd; echo stderr-message >&2; exit 7", onOutput: { output.append($0) }, onExit: { code in
            XCTAssertEqual(code, 7); exited.fulfill()
        })
        withExtendedLifetime(process) { wait(for: [exited], timeout: 8) }
        XCTAssertTrue(output.value.contains(folder.lastPathComponent))
        XCTAssertTrue(output.value.contains("stderr-message"))
    }

    func testStopKillsTermResistantChildren() throws {
        let folder = try temporaryFolder(), ready = expectation(description: "child running"), exited = expectation(description: "group exited")
        let output = LockedText()
        let process = try OwnedProcess(folder: folder.path, command: "(trap '' TERM; echo child-ready; exec /bin/sleep 60) & wait", onOutput: { text in
            output.append(text)
            if text.contains("child-ready") { ready.fulfill() }
        }, onExit: { _ in exited.fulfill() })
        wait(for: [ready], timeout: 5)
        process.stop()
        wait(for: [exited], timeout: 10)
        XCTAssertEqual(kill(-process.pid, 0), -1)
    }
}

final class LockedText: @unchecked Sendable {
    private let lock = NSLock()
    private var text = ""
    func append(_ value: String) { lock.lock(); text += value; lock.unlock() }
    var value: String { lock.lock(); defer { lock.unlock() }; return text }
}
