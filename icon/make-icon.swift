// Draws the app icon: a document split into raw (left) and rendered (right) halves.
// Usage: swift icon/make-icon.swift <out.png>   (1024x1024)
import AppKit

let S: CGFloat = 1024
let out = CommandLine.arguments[1]

let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(S), pixelsHigh: Int(S), bitsPerSample: 8,
                           samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                           bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let ctx = NSGraphicsContext.current!.cgContext

func rgb(_ hex: UInt32, _ a: CGFloat = 1) -> NSColor {
    NSColor(srgbRed: CGFloat(hex >> 16 & 0xff) / 255, green: CGFloat(hex >> 8 & 0xff) / 255,
            blue: CGFloat(hex & 0xff) / 255, alpha: a)
}
func rounded(_ r: CGRect, _ radius: CGFloat) -> NSBezierPath { NSBezierPath(roundedRect: r, xRadius: radius, yRadius: radius) }

// Background squircle (Apple grid: 824pt body inside 1024 canvas) with soft shadow.
let body = CGRect(x: 100, y: 100, width: 824, height: 824)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -12), blur: 28, color: rgb(0x000000, 0.35).cgColor)
rgb(0x2b3a67).setFill(); rounded(body, 186).fill()
ctx.restoreGState()
NSGradient(starting: rgb(0x4f6bed), ending: rgb(0x2a2f8f))!.draw(in: rounded(body, 186), angle: -90)

// Document card.
let card = CGRect(x: 210, y: 230, width: 604, height: 564)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -10), blur: 30, color: rgb(0x000000, 0.35).cgColor)
rgb(0xffffff).setFill(); rounded(card, 44).fill()
ctx.restoreGState()

// Left half: raw source pane.
let mid = card.midX
ctx.saveGState()
rounded(card, 44).addClip()
rgb(0x1e2433).setFill(); CGRect(x: card.minX, y: card.minY, width: mid - card.minX, height: card.height).fill()
ctx.restoreGState()

// Raw pane content: "#" marker and code-ish lines.
let mono = NSFont.monospacedSystemFont(ofSize: 92, weight: .bold)
NSAttributedString(string: "#", attributes: [.font: mono, .foregroundColor: rgb(0x7aa2ff)])
    .draw(at: CGPoint(x: card.minX + 40, y: card.maxY - 140))
let rawLines: [(CGFloat, UInt32)] = [(150, 0xe6edf3), (230, 0x8d96a0), (190, 0x8d96a0), (120, 0xf0a868), (210, 0x8d96a0), (160, 0x8d96a0)]
for (i, (w, c)) in rawLines.enumerated() {
    rgb(c, 0.9).setFill()
    rounded(CGRect(x: card.minX + 44, y: card.maxY - 210 - CGFloat(i) * 52, width: min(w, mid - card.minX - 80), height: 20), 10).fill()
}
rgb(0xe6edf3).setFill()
rounded(CGRect(x: card.minX + 104, y: card.maxY - 112, width: 140, height: 26), 13).fill()

// Right half: rendered pane content: heading, paragraph lines, a block.
let rx = mid + 40, rw = card.maxX - mid - 80
rgb(0x1f2328).setFill(); rounded(CGRect(x: rx, y: card.maxY - 118, width: rw * 0.85, height: 40), 12).fill()
rgb(0xd0d7de).setFill(); CGRect(x: rx, y: card.maxY - 146, width: rw, height: 4).fill()
for (i, f) in [1.0, 0.92, 0.7].enumerated() {
    rgb(0x8c959f).setFill()
    rounded(CGRect(x: rx, y: card.maxY - 200 - CGFloat(i) * 44, width: rw * f, height: 18), 9).fill()
}
rgb(0xeef2ff).setFill(); rounded(CGRect(x: rx, y: card.minY + 60, width: rw, height: 150), 18).fill()
rgb(0x4f6bed).setFill(); rounded(CGRect(x: rx + 24, y: card.minY + 150, width: rw * 0.55, height: 18), 9).fill()
rgb(0x8c959f).setFill(); rounded(CGRect(x: rx + 24, y: card.minY + 104, width: rw * 0.75, height: 18), 9).fill()

NSGraphicsContext.current = nil
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
