import SwiftUI
import AppKit
import UniformTypeIdentifiers
import GTGraffitiCore

struct AppletEditor: View {
    @EnvironmentObject private var library: Library
    @Environment(\.dismiss) private var dismiss
    @State var applet: Applet
    let isNew: Bool
    @State private var validation: String?
    private let symbols = ["square.stack.3d.up", "sparkles", "doc.text", "chart.bar.xaxis", "checklist", "paintpalette", "calendar", "bolt", "leaf", "terminal", "book", "wrench.and.screwdriver"]
    private var active: Bool { library.isManaged(applet.id) || library.session(applet.id).state == .starting || library.session(applet.id).stopping }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 13) {
                Image(systemName: applet.symbol).font(.system(size: 26)).foregroundStyle(accent)
                    .frame(width: 54, height: 54).background(accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                VStack(alignment: .leading, spacing: 5) {
                    Text(isNew ? "A new addition." : "Graffiti app settings").font(.system(size: 23, weight: .semibold)).tracking(-0.5)
                    Text(isNew ? "Bring a local project into your workspace." : "Make this little corner your own.").font(.system(size: 12)).foregroundStyle(.secondary)
                }
            }.padding(.bottom, 25)
            if active {
                Label("Stop this Graffiti app before changing its settings.", systemImage: "info.circle").font(.callout).foregroundStyle(.secondary).padding(.bottom, 16)
            }
            VStack(alignment: .leading, spacing: 17) {
                VStack(alignment: .leading, spacing: 7) {
                    fieldLabel("Project folder")
                    HStack {
                        TextField("Paste a project folder path…", text: $applet.folder)
                            .textFieldStyle(.plain).font(.system(size: 12))
                            .accessibilityLabel("Project folder")
                            .onSubmit { detectFolder() }
                        Spacer()
                        Button("Detect") { detectFolder() }.disabled(applet.folder.isEmpty)
                        Button("Choose…") { chooseFolder() }
                    }.padding(10).background(Color.primary.opacity(0.035), in: RoundedRectangle(cornerRadius: 8))
                }
                HStack(alignment: .top, spacing: 16) {
                    labeledField("Name", placeholder: "My Graffiti app", value: $applet.name)
                    VStack(alignment: .leading, spacing: 7) {
                        fieldLabel("Icon")
                        Picker("Icon", selection: $applet.symbol) {
                            ForEach(symbols, id: \.self) { symbol in Image(systemName: symbol).tag(symbol) }
                        }.labelsHidden().frame(width: 76)
                    }
                }
                labeledField("Description", placeholder: "A little tool for…", value: $applet.summary)
                labeledField("Launch command", placeholder: "npm run dev", value: $applet.command, monospaced: true)
                labeledField("Local address", placeholder: "http://localhost:3000", value: $applet.address, monospaced: true)
                Text("Use the command you normally run in this folder. Dependencies must already be installed. Confirm the address matches your server’s port.")
                    .font(.system(size: 11)).foregroundStyle(.secondary).lineSpacing(3)
                Label("Only add projects and commands you trust. Launch commands run with your Mac user’s permissions.", systemImage: "hand.raised")
                    .font(.system(size: 11)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }.disabled(active)
            if let validation {
                Label(validation, systemImage: "exclamationmark.circle").font(.system(size: 12)).foregroundStyle(.orange).fixedSize(horizontal: false, vertical: true).padding(.top, 14)
            }
            HStack {
                Spacer()
                Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
                Button(isNew ? "Add Graffiti app" : "Save Changes") { save() }.buttonStyle(.borderedProminent).keyboardShortcut(.defaultAction).disabled(active)
            }.padding(.top, 25)
        }.padding(30).frame(width: 560).tint(accent)
    }

    private func fieldLabel(_ text: String) -> some View { Text(text).font(.system(size: 12, weight: .medium)) }
    private func labeledField(_ title: String, placeholder: String, value: Binding<String>, monospaced: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            fieldLabel(title)
            TextField(placeholder, text: value)
                .font(.system(size: 12, design: monospaced ? .monospaced : .default))
                .textFieldStyle(.roundedBorder).controlSize(.large).accessibilityLabel(title)
        }
    }
    private func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true; panel.canChooseFiles = false; panel.allowsMultipleSelection = false
        panel.allowedContentTypes = [.folder]
        panel.prompt = "Choose Project"; panel.message = "Select the folder containing your Graffiti app."
        if !applet.folder.isEmpty { panel.directoryURL = URL(fileURLWithPath: applet.folder) }
        // Avoid a nested modal run loop inside the SwiftUI editor sheet.
        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            applyFolder(url)
        }
    }
    private func detectFolder() {
        let path = (applet.folder.trimmingCharacters(in: .whitespacesAndNewlines) as NSString).expandingTildeInPath
        var directory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: path, isDirectory: &directory), directory.boolValue else {
            validation = "Choose an existing project folder."; return
        }
        applyFolder(URL(fileURLWithPath: path))
    }
    private func applyFolder(_ url: URL) {
        if isNew {
            let suggestion = ProjectDetector.suggest(folder: url)
            applet.folder = suggestion.folder
            if applet.name.isEmpty { applet.name = suggestion.name }
            if applet.summary.isEmpty { applet.summary = suggestion.summary }
            if applet.command.isEmpty { applet.command = suggestion.command; applet.address = suggestion.address }
        } else { applet.folder = url.path }
        validation = nil
    }
    private func save() {
        applet.name = applet.name.trimmingCharacters(in: .whitespacesAndNewlines)
        applet.address = applet.address.trimmingCharacters(in: .whitespacesAndNewlines)
        if let problem = library.validate(applet) { validation = problem; return }
        if library.save(applet) { dismiss() }
        else { validation = library.error ?? "Couldn’t save this Graffiti app."; library.error = nil }
    }
}

struct LogView: View {
    @EnvironmentObject private var library: Library
    @Environment(\.dismiss) private var dismiss
    let applet: Applet
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    Text(applet.name).font(.title2.weight(.semibold))
                    Text("Output from the most recent launch").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                StatusBadge(state: library.session(applet.id).state)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(applet.folder).lineLimit(1).truncationMode(.middle)
                Text("$ " + applet.command).textSelection(.enabled)
                Text(applet.address).foregroundStyle(.secondary)
            }.font(.system(size: 11, design: .monospaced)).foregroundStyle(.secondary)
            ScrollView([.horizontal, .vertical]) {
                Text(library.session(applet.id).logs.isEmpty ? "No output yet. Start the Graffiti app to see its logs here." : clean(library.session(applet.id).logs))
                    .font(.system(size: 11, design: .monospaced)).textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .topLeading).padding(14)
            }.background(Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 10))
            HStack {
                Text("Logs stay on this Mac and reset on relaunch.").font(.caption).foregroundStyle(.tertiary)
                Spacer()
                Button("Copy Logs") { NSPasteboard.general.clearContents(); NSPasteboard.general.setString(clean(library.session(applet.id).logs), forType: .string) }
                Button("Done") { dismiss() }.keyboardShortcut(.defaultAction)
            }
        }.padding(25).frame(width: 720, height: 500)
    }
    private func clean(_ text: String) -> String {
        text.replacingOccurrences(of: #"\u001B\[[0-?]*[ -/]*[@-~]"#, with: "", options: .regularExpression)
    }
}
