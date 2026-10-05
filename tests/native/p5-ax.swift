// SPDX-License-Identifier: AGPL-3.0-or-later
// Kleiner manueller AX-Treiber für die echte macOS-Tauri-Laufzeit.
import AppKit
import ApplicationServices
let app = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == "wimm-desktop" })!
let root = AXUIElementCreateApplication(app.processIdentifier)
func attribute(_ element: AXUIElement, _ name: String) -> AnyObject? { var value: CFTypeRef?; AXUIElementCopyAttributeValue(element, name as CFString, &value); return value }
func children(_ element: AXUIElement) -> [AXUIElement] { attribute(element, kAXChildrenAttribute as String) as? [AXUIElement] ?? [] }
func find(_ element: AXUIElement, _ label: String, _ role: String) -> AXUIElement? {
    if attribute(element, kAXRoleAttribute as String) as? String == role && (attribute(element, kAXTitleAttribute as String) as? String == label || attribute(element, kAXDescriptionAttribute as String) as? String == label) { return element }
    for child in children(element) { if let found = find(child, label, role) { return found } }
    return nil
}
func dump(_ element: AXUIElement, _ depth: Int = 0) {
    let role = attribute(element, kAXRoleAttribute as String) as? String ?? ""
    let title = attribute(element, kAXTitleAttribute as String) as? String ?? ""
    let description = attribute(element, kAXDescriptionAttribute as String) as? String ?? ""
    let value = attribute(element, kAXValueAttribute as String) ?? "" as AnyObject
    print(String(repeating: " ", count: depth) + role + " | " + title + " | " + description + " | " + String(describing: value))
    for child in children(element) { dump(child, depth + 1) }
}
let args = CommandLine.arguments
let window = (attribute(root, kAXWindowsAttribute as String) as? [AXUIElement])!.first!
switch args[1] {
case "dump": dump(window)
case "focused":
    if let element = attribute(root, kAXFocusedUIElementAttribute as String) { let focused = element as! AXUIElement; print(attribute(focused, kAXTitleAttribute as String) ?? "" as AnyObject) }
case "press", "focus":
    let role = args[1] == "focus" ? "AXTextField" : (args.count > 3 ? args[3] : "AXButton")
    guard let element = find(root, args[2], role) else { fatalError("Element fehlt: \(args[2])") }
    AXUIElementPerformAction(element, "AXScrollToVisible" as CFString)
    Thread.sleep(forTimeInterval: 0.15)
    let result = args[1] == "focus" ? AXUIElementSetAttributeValue(element, kAXFocusedAttribute as CFString, kCFBooleanTrue) : AXUIElementPerformAction(element, kAXPressAction as CFString)
    print(result.rawValue)
case "menu":
    let bar = attribute(root, kAXMenuBarAttribute as String) as! AXUIElement
    let group = find(bar, args[2], "AXMenuBarItem")!
    guard let item = find(group, args[3], "AXMenuItem") else { fatalError("Menübefehl fehlt") }
    print(AXUIElementPerformAction(item, kAXPressAction as CFString).rawValue)
default: fatalError("Unbekannter Auftrag")
}
