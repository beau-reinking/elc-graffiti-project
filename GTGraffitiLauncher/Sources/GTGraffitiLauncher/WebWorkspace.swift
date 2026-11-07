import SwiftUI
import WebKit
import GTGraffitiCore

@MainActor final class WebPool: ObservableObject {
    var views: [UUID: WKWebView] = [:]
    @Published var errors: [UUID: String] = [:]
    var suiteRoute = "home"
    func requestSuiteRoute(_ route: String) {
        guard ["home", "yudo", "sylt", "ourscene"].contains(route) else { return }
        suiteRoute = route
        if let view = views[SuiteConfiguration.id], let url = view.url, url.host == "127.0.0.1", url.port == 5178 {
            view.evaluateJavaScript("window.gtNavigate?.('\(route)')", completionHandler: nil)
        }
    }
    func clear(_ id: UUID) {
        views[id]?.configuration.userContentController.removeScriptMessageHandler(forName: "gtWorkspace"); views[id]?.stopLoading(); views.removeValue(forKey: id); errors.removeValue(forKey: id)
    }
    func reload(_ id: UUID) { errors.removeValue(forKey: id); views[id]?.reload() }
}

struct AppletWebView: NSViewRepresentable {
    let applet: Applet
    @ObservedObject var pool: WebPool
    func makeCoordinator() -> Coordinator { Coordinator(applet: applet, pool: pool) }
    func makeNSView(context: Context) -> WKWebView {
        if let view = pool.views[applet.id] { view.navigationDelegate = context.coordinator; view.uiDelegate = context.coordinator; return view }
        let configuration = WKWebViewConfiguration()
        if SuiteConfiguration.trusted(applet) {
            configuration.userContentController.add(context.coordinator, name: "gtWorkspace")
        }
        configuration.websiteDataStore = .default()
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator; view.uiDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = true
        pool.views[applet.id] = view
        if let url = LocalAddress.parse(applet.address) { view.load(URLRequest(url: url)) }
        return view
    }
    func updateNSView(_ nsView: WKWebView, context: Context) {}

    @MainActor final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        let applet: Applet
        let pool: WebPool
        init(applet: Applet, pool: WebPool) { self.applet = applet; self.pool = pool }
        var authenticationUntil: Date?
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard SuiteConfiguration.trusted(applet), message.frameInfo.isMainFrame,
                  let url = message.frameInfo.request.url, allowed(url),
                  let body = message.body as? [String: String] else { return }
            if body["type"] == "authentication-start" { authenticationUntil = Date().addingTimeInterval(600) }
            if body["type"] == "authentication-end" { authenticationUntil = nil }
            if body["type"] == "route-changed", let route = body["route"], ["home", "yudo", "sylt", "ourscene"].contains(route) { pool.suiteRoute = route }
        }
        private func allowed(_ url: URL) -> Bool {
            guard let base = LocalAddress.parse(applet.address), let candidate = LocalAddress.parse(url.absoluteString) else { return false }
            return LocalAddress.endpoint(base) == LocalAddress.endpoint(candidate)
        }
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { decisionHandler(.cancel); return }
            if action.targetFrame?.isMainFrame == false {
                // Trusted workspace views and provider subresources have no native bridge privileges.
                decisionHandler(.allow); return
            }
            if allowed(url) { decisionHandler(.allow); return }
            if SuiteConfiguration.trusted(applet), let until = authenticationUntil, until > Date(), url.scheme == "https" {
                decisionHandler(.allow); return
            }
            if action.navigationType == .linkActivated, ["https", "http", "mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
            decisionHandler(.cancel)
        }
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = action.request.url, action.navigationType == .linkActivated {
                if allowed(url) { webView.load(action.request) }
                else if ["https", "http", "mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
            }
            return nil
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed(error) }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed(error) }
        private func failed(_ error: Error) {
            guard (error as NSError).code != NSURLErrorCancelled else { return }
            pool.errors[applet.id] = "The Graffiti app’s page couldn’t load. Try reloading, or check its logs."
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            pool.errors.removeValue(forKey: applet.id)
            if SuiteConfiguration.trusted(applet), let url = webView.url, allowed(url) {
                webView.evaluateJavaScript("window.gtNavigate?.('\(pool.suiteRoute)')", completionHandler: nil)
            }
        }
        func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
            guard SuiteConfiguration.trusted(applet), let url = frame.request.url, allowed(url) else { completionHandler(nil); return }
            let panel = NSOpenPanel(); panel.canChooseDirectories = false; panel.canChooseFiles = true; panel.allowsMultipleSelection = parameters.allowsMultipleSelection
            panel.begin { result in completionHandler(result == .OK ? panel.urls : nil) }
        }
        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let alert = NSAlert(); alert.messageText = message; alert.addButton(withTitle: "Continue"); alert.addButton(withTitle: "Cancel"); completionHandler(alert.runModal() == .alertFirstButtonReturn)
        }
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let alert = NSAlert(); alert.messageText = message; alert.addButton(withTitle: "OK"); alert.runModal(); completionHandler()
        }
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { pool.errors[applet.id] = "This Graffiti app’s view closed unexpectedly. Reload to reopen it." }
        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(SuiteConfiguration.trusted(applet) && origin.protocol == "http" && origin.host == "127.0.0.1" && origin.port == 5178 && frame.request.url.map(allowed) == true ? .prompt : .deny) }
    }
}
