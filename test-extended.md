# Extended test document {#top}

Covers the features and edge cases that `test.md` does not: heading attributes, every alert type, images, raw HTML, escapes, deep nesting, wide tables and long lines.

**Contents:** [Headings](#headings) · [Alerts](#alerts) · [Images](#images) · [HTML](#html) · [Nesting](#nesting) · [Tables](#tables) · [Code](#code) · [Edge cases](#edge-cases)

## Headings {#headings}

# H1
## H2
### H3 with a custom id {#custom-id .highlight}
#### H4
##### H5
###### H6

Jump to [the custom-id heading](#custom-id).

Setext heading level 1
======================

Setext heading level 2
----------------------

## Alerts {#alerts}

> [!NOTE]
> Useful information that users should know.

> [!TIP]
> Helpful advice for doing things better.

> [!IMPORTANT]
> Key information users need to know.

> [!WARNING]
> Urgent info that needs immediate attention.

> [!CAUTION]
> Advises about risks or negative outcomes.

> A plain quote
>
> > with a nested quote
> >
> > > and a third level, containing `code` and **bold**.

## Images {#images}

Remote image:

![Rust logo](https://www.rust-lang.org/logos/rust-logo-128x128.png)

Image with a title and as a link:

[![Ferris](https://rustacean.net/assets/rustacean-flat-happy.png "Ferris the crab")](https://rustacean.net/)

Missing local image (should show alt text, not crash):

![this file does not exist](./does-not-exist.png)

Inline data URI:

![red dot](data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMCcgaGVpZ2h0PScyMCc+PGNpcmNsZSBjeD0nMTAnIGN5PScxMCcgcj0nOCcgZmlsbD0ncmVkJy8+PC9zdmc+)

## HTML {#html}

<details>
<summary>Click to expand</summary>

Hidden content with **markdown** inside.

- item one
- item two

</details>

Keyboard: <kbd>Cmd</kbd> + <kbd>R</kbd> · Sub/sup: H<sub>2</sub>O, x<sup>2</sup> · <mark>highlighted</mark>

<p align="center">Centered paragraph via HTML.</p>

<script>document.body.innerHTML = "script ran: CSP is not blocking inline scripts";</script>

## Nesting {#nesting}

1. Level one
   1. Level two
      1. Level three
         - Level four bullet
           - Level five bullet

             A paragraph inside a deep list item.

             ```js
             console.log("code inside a list");
             ```
2. Back to level one
   > A quote inside a list.

- [ ] Task with **bold** and a [link](#top)
  - [x] Nested completed task
  - [ ] Nested open task

Loose list:

* Item with two paragraphs.

  Second paragraph of the same item.

* Next item.

## Tables {#tables}

| Left | Center | Right |
|:-----|:------:|------:|
| a | b | c |
| `code` | **bold** | _italic_ |
| pipe \| escaped | [link](#top) | 1,234.56 |
| | empty first cell | |

Wide table (should scroll horizontally, not break the layout):

| Column 1 | Column 2 | Column 3 | Column 4 | Column 5 | Column 6 | Column 7 | Column 8 | Column 9 | Column 10 |
|---|---|---|---|---|---|---|---|---|---|
| a fairly long cell value | another fairly long cell value | more text here | and more | and more | and more | and more | and more | and more | last |

## Code {#code}

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

    def norm(self) -> float:
        return (self.x ** 2 + self.y ** 2) ** 0.5
```

```json
{ "name": "md-preview", "version": "0.1.0", "features": ["tables", "footnotes"] }
```

```diff
- let opts = Options::empty();
+ let opts = Options::ENABLE_TABLES | Options::ENABLE_GFM;
```

```unknownlang
Unknown language: should render as plain code without errors.
```

```
Fenced block with no language.
```

    Indented code block (four spaces).

A very long line in a code block (should scroll, not wrap the page):

```text
0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789
```

## Edge cases {#edge-cases}

Escaped characters: \*not italic\*, \`not code\`, \# not a heading, \[not a link\]

HTML entities: &copy; &amp; &lt;tag&gt; &rarr;

Autolinks: <https://example.com> and www.example.com and someone@example.com

Hard line break with two trailing spaces  
and with a backslash\
end.

Unicode: café, naïve, 日本語, Ελληνικά, עברית, emoji 🦀 🚀 ✅

A_very_long_word_without_spaces_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA

Reference-style [link][ref] and a [collapsed reference][].

[ref]: https://commonmark.org "CommonMark"
[collapsed reference]: https://spec.commonmark.org

Multiple footnotes[^a] and a named one[^long-note].

[^a]: Short footnote.
[^long-note]: A longer footnote with `code` and a second sentence.

***

___

[Back to top](#top)
