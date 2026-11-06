import SwiftUI
import AppKit

@main struct GTGraffitiLauncherApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @StateObject private var library = Library(storageURL: ProcessInfo.processInfo.environment["GT_GRAFFITI_LIBRARY_PATH"].map { URL(fileURLWithPath: $0) })
    var body: some Scene {
        Window("GT Graffiti Launcher", id: "main") {
            ContentView().environmentObject(library)
                .frame(minWidth: 840, minHeight: 580)
                .onAppear { delegate.library = library }
        }
        .defaultSize(width: 1180, height: 780)
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("Add Graffiti app…") { library.showAdd = true }.keyboardShortcut("n")
            }
            CommandMenu("Workspace") {
                Button("Show Library") { library.selected = nil }.keyboardShortcut("1")
                Button("Search Graffiti apps") {
                    library.selected = nil
                    NotificationCenter.default.post(name: .searchLibrary, object: nil)
                }.keyboardShortcut("f")
            }
        }
    }
}

extension Notification.Name { static let searchLibrary = Notification.Name("GTGraffitiLauncher.searchLibrary") }

@MainActor final class AppDelegate: NSObject, NSApplicationDelegate {
    weak var library: Library?
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Optional appearance override for isolated visual verification; normal launches follow macOS.
        if let value = ProcessInfo.processInfo.environment["GT_GRAFFITI_APPEARANCE"],
           ["light", "dark"].contains(value) {
            NSApplication.shared.appearance = NSAppearance(named: value == "light" ? .aqua : .darkAqua)
        }
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard let library, library.activeCount > 0 else { return .terminateNow }
        let alert = NSAlert()
        alert.messageText = "Stop running Graffiti apps and quit?"
        alert.informativeText = "GT Graffiti Launcher will stop the \(library.activeCount) Graffiti app\(library.activeCount == 1 ? "" : "s") it started. Your projects and saved data will stay in place."
        alert.addButton(withTitle: "Stop & Quit"); alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else { return .terminateCancel }
        library.shutdown()
        Task { @MainActor in
            for _ in 0..<50 {
                if library.activeCount == 0 { break }
                try? await Task.sleep(for: .milliseconds(100))
            }
            library.forceShutdown()
            sender.reply(toApplicationShouldTerminate: true)
        }
        return .terminateLater
    }
}
