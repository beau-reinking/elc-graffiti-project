import SwiftUI
import GTGraffitiCore

let accent = Color(nsColor: NSColor(name: nil) { appearance in
    appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        ? NSColor(calibratedRed: 0.76, green: 0.98, blue: 0.18, alpha: 1)
        : NSColor(calibratedRed: 0.28, green: 0.42, blue: 0.02, alpha: 1)
})

struct ContentView: View {
    @EnvironmentObject private var library: Library
    @StateObject private var webPool = WebPool()
    var body: some View {
        HStack(spacing: 0) {
            sidebar.frame(width: 246)
            Divider()
            ZStack {
                Dashboard().opacity(library.selected == nil ? 1 : 0)
                    .allowsHitTesting(library.selected == nil).accessibilityHidden(library.selected != nil)
                ForEach(library.applets.filter { library.openIDs.contains($0.id) }) { applet in
                    workspace(applet)
                        .opacity(library.selected == applet.id ? 1 : 0)
                        .allowsHitTesting(library.selected == applet.id)
                        .accessibilityHidden(library.selected != applet.id)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(nsColor: .controlBackgroundColor))
        }
        .tint(accent)
        .onAppear { library.openSuite() }
        .sheet(isPresented: $library.showAdd) { AppletEditor(applet: Applet(), isNew: true).environmentObject(library) }
        .sheet(item: $library.editing) { applet in AppletEditor(applet: applet, isNew: false).environmentObject(library) }
        .sheet(item: $library.inspecting) { applet in LogView(applet: applet).environmentObject(library) }
        .alert("Couldn’t complete that", isPresented: Binding(get: { library.error != nil }, set: { if !$0 { library.error = nil } })) {
            Button("OK") { library.error = nil }
        } message: { Text(library.error ?? "") }
        .alert("Remove \(library.removing?.name ?? "applet")?", isPresented: Binding(get: { library.removing != nil }, set: { if !$0 { library.removing = nil } })) {
            Button("Cancel", role: .cancel) { library.removing = nil }
            Button("Remove", role: .destructive) { if let applet = library.removing { webPool.clear(applet.id); library.remove(applet) }; library.removing = nil }
        } message: { Text("This removes the Graffiti app from GT Graffiti Launcher. Its project folder and data will stay in place.") }
        .onChange(of: library.sessions.mapValues { $0.state }) { _, states in
            for (id, state) in states where state != .running { webPool.clear(id) }
        }
        .onChange(of: library.openIDs) { old, new in
            for id in old where !new.contains(id) { webPool.clear(id) }
        }
    }

    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                BrandMark().frame(width: 45, height: 45)
                VStack(alignment: .leading, spacing: 2) {
                    Text("GT Graffiti").font(.system(size: 19, weight: .heavy, design: .rounded))
                    Text("Launcher").font(.system(size: 13, weight: .medium)).foregroundStyle(.secondary)
                }.accessibilityElement(children: .ignore).accessibilityLabel("GT Graffiti Launcher")
            }.padding(.horizontal, 23).padding(.top, 43).padding(.bottom, 30)
            ForEach([("Home", "house", "home"), ("Yudo", "person.2", "yudo"), ("Sylt", "waveform", "sylt"), ("OurScene", "map", "ourscene")], id: \.0) { item in
                Button { library.openSuite(item.2) } label: {
                    HStack(spacing: 12) { Image(systemName: item.1).frame(width: 18); Text(item.0); Spacer() }.padding(.horizontal, 12).padding(.vertical, 11)
                }.buttonStyle(.plain).padding(.horizontal, 12)
            }
            Divider().padding(.vertical, 12).padding(.horizontal, 24)
            Button { library.selected = nil } label: {
                HStack(spacing: 11) {
                    Image(systemName: "square.grid.2x2").font(.system(size: 15))
                    Text("Other apps").fontWeight(.medium)
                    Spacer()
                    Text("\(library.applets.count)").font(.system(size: 11, weight: .medium)).foregroundStyle(.secondary)
                }.padding(.horizontal, 12).padding(.vertical, 11)
                    .background(library.selected == nil ? accent.opacity(0.10) : .clear, in: RoundedRectangle(cornerRadius: 8))
                    .foregroundStyle(library.selected == nil ? accent : .primary)
            }.buttonStyle(.plain).padding(.horizontal, 12)
            HStack {
                Text("WORKSPACE").font(.system(size: 10, weight: .semibold)).tracking(1.3)
                Spacer()
            }.foregroundStyle(.tertiary).padding(.horizontal, 24).padding(.top, 30).padding(.bottom, 10)
            ScrollView {
                VStack(spacing: 4) {
                    ForEach(library.openIDs, id: \.self) { id in
                        if let applet = library.applets.first(where: { $0.id == id }) {
                            Button { library.selected = id } label: {
                                HStack(spacing: 10) {
                                    Image(systemName: applet.symbol).frame(width: 18).foregroundStyle(library.selected == id ? accent : .secondary)
                                    Text(applet.name).lineLimit(1)
                                    Spacer(minLength: 2)
                                    StatusDot(state: library.session(id).state)
                                }.padding(.horizontal, 12).padding(.vertical, 10)
                                    .background(library.selected == id ? Color.primary.opacity(0.06) : .clear, in: RoundedRectangle(cornerRadius: 8))
                            }.buttonStyle(.plain).contextMenu { AppletMenu(applet: applet); Divider(); Button("Close View") { library.close(id) } }
                        }
                    }
                    if library.openIDs.isEmpty {
                        Text("Your open Graffiti apps\nappear here.").font(.system(size: 12)).foregroundStyle(.tertiary)
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 12).padding(.top, 4)
                    }
                }.padding(.horizontal, 12)
            }
            Spacer(minLength: 12)
            Button { library.showAdd = true } label: {
                HStack(spacing: 9) {
                    Image(systemName: "plus")
                    Text("Add Graffiti app")
                    Spacer()
                    Text("⌘N").font(.system(size: 11)).foregroundStyle(.tertiary)
                }.padding(12)
            }.buttonStyle(.plain).padding(.horizontal, 12)
            Divider().padding(.horizontal, 24).padding(.vertical, 12)
            HStack(spacing: 7) {
                Circle().fill(library.activeCount > 0 ? Color.green : Color.secondary.opacity(0.4)).frame(width: 5, height: 5)
                Text(library.activeCount > 0 ? "\(library.activeCount) Graffiti app\(library.activeCount == 1 ? "" : "s") active" : "Your Graffiti workspace")
                    .font(.system(size: 11)).foregroundStyle(.secondary)
            }.padding(.horizontal, 24).padding(.bottom, 20)
        }.frame(maxHeight: .infinity).background(.regularMaterial)
    }

    private func workspace(_ applet: Applet) -> some View {
        let session = library.session(applet.id)
        return VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button { library.selected = nil } label: { Image(systemName: "chevron.left") }.help("Back to library (⌘1)")
                Image(systemName: applet.symbol).foregroundStyle(accent)
                Text(applet.name).fontWeight(.semibold).lineLimit(1)
                StatusBadge(state: session.state)
                Spacer()
                Button { if applet.id == SuiteConfiguration.id { library.openSuite(library.suiteRoute) } else { webPool.reload(applet.id) } } label: { Image(systemName: "arrow.clockwise") }.disabled(session.state != .running).help(applet.id == SuiteConfiguration.id ? "Open workspace in browser" : "Reload page")
                Menu { AppletMenu(applet: applet); Divider(); Button("Close View") { library.close(applet.id) } } label: { Image(systemName: "ellipsis") }.menuStyle(.borderlessButton).frame(width: 25)
            }.buttonStyle(.borderless).padding(.horizontal, 24).frame(height: 65)
            Divider()
            if session.state == .running && applet.id == SuiteConfiguration.id {
                VStack(spacing: 18) {
                    Image(systemName: "globe").font(.system(size: 44, weight: .light)).foregroundStyle(accent)
                    Text("Your workspace runs in your browser").font(.system(size: 23, weight: .semibold))
                    Text("Use Safari or Chrome for Graffiti sign-in, passkeys, and recording. Keep this launcher open to run the local server.")
                        .foregroundStyle(.secondary).multilineTextAlignment(.center).frame(maxWidth: 460)
                    Text(applet.address).font(.system(.body, design: .monospaced)).textSelection(.enabled)
                    Button("Open workspace in browser") { library.openSuite(library.suiteRoute) }.buttonStyle(.borderedProminent)
                    HStack(spacing: 16) {
                        Button("View Logs") { library.inspecting = applet }
                        Button("Restart Server") { library.restart(applet) }
                        Button("Stop Server") { library.stop(applet) }
                    }
                    Text("Browser sessions and drafts are separate from the previous embedded view.").font(.caption).foregroundStyle(.secondary)
                }.padding().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if session.state == .running {
                ZStack {
                    AppletWebView(applet: applet, pool: webPool)
                    if let error = webPool.errors[applet.id] {
                        VStack(spacing: 16) {
                            Image(systemName: "wifi.exclamationmark").font(.system(size: 30)).foregroundStyle(.secondary)
                            Text(error).multilineTextAlignment(.center).frame(maxWidth: 380)
                            Button("Reload") { webPool.reload(applet.id) }.buttonStyle(.borderedProminent)
                            Button("View Logs") { library.inspecting = applet }
                        }.frame(maxWidth: .infinity, maxHeight: .infinity).background(.background)
                    }
                }
            } else {
                VStack(spacing: 16) {
                    if session.state == .starting || session.stopping { ProgressView().controlSize(.large) }
                    else { Image(systemName: session.state == .attention ? "exclamationmark.circle" : applet.symbol).font(.system(size: 38, weight: .light)).foregroundStyle(session.state == .attention ? Color.orange : accent) }
                    Text(session.stopping ? "Stopping \(applet.name)" : session.state == .starting ? "Opening \(applet.name)" : session.state == .attention ? "Let’s get this running" : "Ready when you are")
                        .font(.system(size: 23, weight: .semibold))
                    Text(session.message.isEmpty ? "Open this Graffiti app to start its local server." : session.message)
                        .font(.system(size: 13)).foregroundStyle(.secondary).multilineTextAlignment(.center).frame(maxWidth: 430)
                    if session.slow && session.state == .starting { Text("Taking a little longer. Your Graffiti app may still be warming up.").font(.caption).foregroundStyle(.secondary) }
                    HStack(spacing: 12) {
                        if session.state == .starting {
                            Button("Cancel") { library.stop(applet) }.disabled(session.stopping)
                        } else {
                            Button(session.state == .attention ? "Try Again" : "Open Graffiti app") { library.start(applet) }.buttonStyle(.borderedProminent).disabled(session.stopping || library.isManaged(applet.id))
                            Button("Settings") { library.editing = applet }
                        }
                        Button("View Logs") { library.inspecting = applet }
                    }.padding(.top, 7)
                }.frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}

struct Dashboard: View {
    @EnvironmentObject private var library: Library
    @State private var query = ""
    @State private var favoritesOnly = false
    @FocusState private var searchFocused: Bool
    private var filtered: [Applet] {
        library.applets.filter { $0.id != SuiteConfiguration.id && (!favoritesOnly || $0.favorite) && (query.isEmpty || "\($0.name) \($0.summary)".localizedCaseInsensitiveContains(query)) }
            .sorted {
                if $0.favorite != $1.favorite { return $0.favorite }
                if $0.lastOpened != $1.lastOpened { return ($0.lastOpened ?? .distantPast) > ($1.lastOpened ?? .distantPast) }
                return $0.name.localizedStandardCompare($1.name) == .orderedAscending
            }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("YOUR WORKSPACE").font(.system(size: 10, weight: .semibold)).tracking(1.7).foregroundStyle(.tertiary)
                Spacer()
                HStack(spacing: 7) {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("Search Graffiti apps", text: $query).textFieldStyle(.plain).focused($searchFocused)
                    if !query.isEmpty { Button { query = "" } label: { Image(systemName: "xmark.circle.fill") }.buttonStyle(.plain).foregroundStyle(.secondary) }
                }.padding(9).frame(width: 225).background(Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 8))
            }.padding(.top, 33)
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Your apps. Your mark.").font(.system(size: 30, weight: .semibold)).tracking(-0.8)
                    Text("Graffiti tools, together. Ready to create.").font(.system(size: 13)).foregroundStyle(.secondary)
                }
                Spacer()
                Button { library.showAdd = true } label: { Label("Add Graffiti app", systemImage: "plus").padding(.vertical, 3) }.buttonStyle(.borderedProminent)
            }.padding(.top, 36).padding(.bottom, 32)
            HStack(spacing: 16) {
                filterButton("All Graffiti apps", selected: !favoritesOnly) { favoritesOnly = false }
                filterButton("Favorites", selected: favoritesOnly) { favoritesOnly = true }
                Spacer()
                Text("\(filtered.count) Graffiti app\(filtered.count == 1 ? "" : "s")").font(.system(size: 11)).foregroundStyle(.tertiary)
            }.padding(.bottom, 15)
            Divider()
            if library.applets.isEmpty { emptyLibrary }
            else if filtered.isEmpty {
                ContentUnavailableView(favoritesOnly && query.isEmpty ? "No favorites yet" : "No matching Graffiti apps", systemImage: favoritesOnly && query.isEmpty ? "star" : "magnifyingglass", description: Text(favoritesOnly && query.isEmpty ? "Star an Graffiti app to keep it close at hand." : "Try a different name or description."))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 18)], spacing: 18) {
                        ForEach(filtered) { applet in AppletCard(applet: applet) }
                    }.padding(.top, 24).padding(.bottom, 30)
                }
            }
            HStack(spacing: 6) {
                Image(systemName: "externaldrive").font(.system(size: 10))
                Text("Runs on your Mac. Built around your projects.").font(.system(size: 11))
                Spacer()
            }.foregroundStyle(.tertiary).padding(.vertical, 20)
        }.padding(.horizontal, 36)
            .onReceive(NotificationCenter.default.publisher(for: .searchLibrary)) { _ in searchFocused = true }
    }
    private func filterButton(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) { Text(title).font(.system(size: 12, weight: selected ? .semibold : .regular)).foregroundStyle(selected ? Color.primary : .secondary) }.buttonStyle(.plain)
    }
    private var emptyLibrary: some View {
        VStack(spacing: 16) {
            BrandMark().frame(width: 100, height: 100).padding(.bottom, 7)
            Text("Make your first mark.").font(.system(size: 22, weight: .semibold)).tracking(-0.4)
            Text("Bring your local Graffiti projects together.\nLaunch, switch, and keep creating.")
                .font(.system(size: 13)).foregroundStyle(.secondary).multilineTextAlignment(.center).lineSpacing(4)
            Button { library.showAdd = true } label: { Label("Add your first Graffiti app", systemImage: "plus").padding(.horizontal, 5).padding(.vertical, 4) }
                .buttonStyle(.borderedProminent).padding(.top, 8)
            Text("Choose a local folder to get started.").font(.system(size: 11)).foregroundStyle(.tertiary)
        }.frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct AppletCard: View {
    @EnvironmentObject private var library: Library
    let applet: Applet
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                Image(systemName: applet.symbol).font(.system(size: 23, weight: .regular)).foregroundStyle(accent)
                    .frame(width: 49, height: 49).background(accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 13))
                Spacer()
                Button { library.toggleFavorite(applet) } label: { Image(systemName: applet.favorite ? "star.fill" : "star").foregroundStyle(applet.favorite ? accent : Color.secondary.opacity(0.6)) }
                    .buttonStyle(.plain).help(applet.favorite ? "Remove from favorites" : "Add to favorites").accessibilityLabel(applet.favorite ? "Unfavorite \(applet.name)" : "Favorite \(applet.name)")
                Menu { AppletMenu(applet: applet) } label: { Image(systemName: "ellipsis") }.menuStyle(.borderlessButton).frame(width: 20).help("Graffiti app actions")
            }
            Text(applet.name).font(.system(size: 15, weight: .semibold)).lineLimit(1).padding(.top, 18)
            Text(applet.summary.isEmpty ? "Your local Graffiti app" : applet.summary).font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(2).frame(height: 34, alignment: .top).padding(.top, 5)
            HStack {
                StatusBadge(state: library.session(applet.id).state)
                Spacer()
                Button { library.open(applet) } label: { HStack(spacing: 5) { Text("Open"); Image(systemName: "arrow.up.right").font(.system(size: 9, weight: .semibold)) } }
                    .buttonStyle(.borderless).font(.system(size: 12, weight: .medium))
                    .accessibilityLabel("Open \(applet.name)")
            }.padding(.top, 21)
        }.padding(20)
            .background(Color(nsColor: .windowBackgroundColor), in: RoundedRectangle(cornerRadius: 13))
            .overlay(RoundedRectangle(cornerRadius: 13).strokeBorder(Color.primary.opacity(0.07), lineWidth: 1))
            .contextMenu { AppletMenu(applet: applet) }
    }
}

struct StatusDot: View {
    let state: AppletState
    var body: some View {
        Image(systemName: state == .attention ? "exclamationmark.circle.fill" : state == .starting ? "circle.dotted" : state == .running ? "circle.fill" : "circle")
            .font(.system(size: 7, weight: .semibold)).foregroundStyle(state == .running ? Color.green : state == .attention ? .orange : .secondary)
            .accessibilityLabel(state.rawValue)
    }
}
struct StatusBadge: View {
    let state: AppletState
    var body: some View {
        HStack(spacing: 5) { StatusDot(state: state); Text(state.rawValue).font(.system(size: 10, weight: .medium)) }.foregroundStyle(.secondary)
            .accessibilityElement(children: .ignore).accessibilityLabel(state.rawValue)
    }
}

struct AppletMenu: View {
    @EnvironmentObject private var library: Library
    let applet: Applet
    var body: some View {
        Button("Open Graffiti app") { library.open(applet) }
        Button("Start") { library.start(applet) }.disabled([.running, .starting].contains(library.session(applet.id).state) || library.session(applet.id).stopping)
        Button("Stop") { library.stop(applet) }.disabled((!library.isManaged(applet.id) && library.session(applet.id).state != .starting) || library.session(applet.id).stopping)
        Button("Restart") { library.restart(applet) }.disabled(library.session(applet.id).stopping)
        Divider()
        Button("Settings…") { library.editing = applet }
        Button("View Logs…") { library.inspecting = applet }
        Button("Open in Browser") { if let url = LocalAddress.parse(applet.address) { NSWorkspace.shared.open(url) } }
            .disabled(library.session(applet.id).state != .running)
        Button("Show Project in Finder") { NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: applet.folder) }
        Divider()
        Button("Remove from Library…", role: .destructive) { library.removing = applet }
            .disabled(library.isManaged(applet.id) || library.session(applet.id).state == .starting || library.session(applet.id).stopping)
    }
}

struct BrandMark: View {
    var body: some View {
        Image(nsImage: GTArtwork.image(size: 256))
            .resizable().aspectRatio(contentMode: .fit)
            .accessibilityHidden(true)
    }
}
