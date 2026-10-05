// SPDX-License-Identifier: AGPL-3.0-or-later
// Nur für die ausdrücklich isolierte synthetische Tauri-Abnahme.
import AppKit
import ApplicationServices
let args = CommandLine.arguments
let app = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == "wimm-desktop" })!
let root = AXUIElementCreateApplication(app.processIdentifier)
func attribute(_ element: AXUIElement, _ name: String) -> AnyObject? { var value: CFTypeRef?; AXUIElementCopyAttributeValue(element, name as CFString, &value); return value }
func children(_ element: AXUIElement) -> [AXUIElement] { attribute(element, kAXChildrenAttribute as String) as? [AXUIElement] ?? [] }
func find(_ element: AXUIElement, _ label: String, _ role: String) -> AXUIElement? {
    if attribute(element, kAXRoleAttribute as String) as? String == role && (attribute(element, kAXTitleAttribute as String) as? String == label || attribute(element, kAXDescriptionAttribute as String) as? String == label) { return element }
    for child in children(element) { if let result = find(child, label, role) { return result } }
    return nil
}
func key(_ code: CGKeyCode, _ flags: CGEventFlags = []) {
    for down in [true, false] { let event = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: down)!; event.flags = flags; event.post(tap: .cghidEventTap) }
}
func text(_ value: String) {
    let units = Array(value.utf16)
    for down in [true, false] { let event = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: down)!; event.flags = []; event.keyboardSetUnicodeString(stringLength: units.count, unicodeString: units); event.post(tap: .cghidEventTap) }
}
app.activate()
Thread.sleep(forTimeInterval: 0.1)
switch args[1] {
case "fill":
    guard let field = find(root, args[2], "AXTextField") else { fatalError("Feld fehlt: \(args[2])") }
    let result = AXUIElementSetAttributeValue(field, kAXFocusedAttribute as CFString, kCFBooleanTrue)
    guard result == .success else { fatalError("Fokus abgewiesen") }
    let escaped = args[3].replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
    let process = Process(); process.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
    process.arguments = ["-e", "tell application \"System Events\" to tell process \"wimm-desktop\"", "-e", "set frontmost to true", "-e", "keystroke \"a\" using command down", "-e", "keystroke \"\(escaped)\"", "-e", "end tell"]
    try process.run(); process.waitUntilExit()
    guard process.terminationStatus == 0 else { fatalError("Tastatureingabe abgewiesen") }
case "choose":
    guard let field = find(root, args[2], "AXPopUpButton") else { fatalError("Auswahl fehlt: \(args[2])") }
    AXUIElementPerformAction(field, kAXPressAction as CFString)
    Thread.sleep(forTimeInterval: 0.1)
    text(args[3]); key(36)
case "key": key(CGKeyCode(args[2])!, args.count > 3 && args[3] == "cmd" ? .maskCommand : [])
default: fatalError("Unbekannter Auftrag")
}
Thread.sleep(forTimeInterval: 0.2)
