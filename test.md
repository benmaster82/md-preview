# MD Preview test document

A short file that exercises the common Markdown features, so you can check both the pane and the app.

## Text

Plain text with **bold**, _italic_, ~~strikethrough~~ and `inline code`.
A [link to the Rust book](https://doc.rust-lang.org/book/) and a jump to the [table section](#table).

> A blockquote, the kind used for notes and quotes.

> [!NOTE]
> A GitHub-style alert. The app renders it as a callout; the terminal pane shows it as a quote.

## Lists

1. First step
2. Second step
   - a nested bullet
   - another one
3. Third step

- [x] Build the viewer
- [x] Package it as a .dmg
- [ ] Review this file

## Table

| Feature        | MD Preview app | Claude Code pane |
|----------------|:--------------:|:----------------:|
| Live reload    | yes            | yes              |
| Raw view       | side by side   | toggle with `r`  |
| Images         | yes            | no               |
| GitHub styling | yes            | terminal theme   |

## Code

```rust
fn main() {
    let files = ["README.md", "test.md"];
    for f in files {
        println!("previewing {f}");
    }
}
```

```bash
./build-dmg.sh && open dist/MD-Preview.dmg
```

## Footnote

The viewer uses pulldown-cmark for rendering.[^1]

[^1]: A CommonMark parser written in Rust.

---

_End of test file._
