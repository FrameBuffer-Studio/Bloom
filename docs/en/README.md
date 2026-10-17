# Documentation map

Hi! This is the documentation for the **Bloom** library. Everything here is explained simply and step by step, as if we were building a construction set together.

> [!TIP]
> If you are new, read chapters 1 → 2 → 3 in order. After that you can already draw. Open the other chapters when you need them.

## Where to start

| № | Chapter | What it is about |
|---|---------|------------------|
| 1 | [What is Bloom](01-what-is-bloom.md) | What the library is and how it works - explained with a squared notebook |
| 2 | [Setup and check](02-setup.md) | How to add Bloom and enable EditableImage in the game settings |
| 3 | [First picture](03-first-picture.md) | Drawing your first picture in 5 minutes |

## Main tools

| № | Chapter | What it is about |
|---|---------|------------------|
| 4 | [Canvas](04-canvas.md) | Creating, updating, clearing, resizing and destroying a canvas |
| 5 | [Colors](05-colors.md) | How a color works and how to mix colors |
| 6 | [Drawing](06-drawing.md) | Dots, lines, rectangles, triangles |
| 7 | [Textures](07-textures.md) | Ready-made pictures: stickers you can put on the canvas |
| 8 | [Shaders](08-shaders.md) | Magic filters that recolor pixels |
| 9 | [Fonts and text](09-fonts.md) | How to write letters on the canvas |

## For those who want more

| № | Chapter | What it is about |
|---|---------|------------------|
| 10 | [Task scheduler](10-scheduler.md) | A to-do queue so the game does not lag |
| 11 | [Stage pipeline](11-pipeline.md) | Your own code at the right moment of a frame |
| 12 | [Stats and speed](12-performance.md) | How to find what is slow and speed the game up |
| 13 | [All errors](13-errors.md) | Every error message: what it means and how to fix it |
| 14 | [Types](14-types.md) | Luau types for strict code checking |
| 15 | [FAQ](15-faq.md) | Short answers to common questions |

## Three rules to remember right away

1. **Cells are counted from one.** The top-left pixel is `(1, 1)`, not `(0, 0)`.
2. **Edges are part of the shape.** A rectangle from `1` to `10` is 10 pixels, not 9.
3. **Drew it - show it.** Drawing only changes memory. To make the picture appear on screen, call `canvas:Update()` or `canvas:EndFrame()`.

## Documentation site

This documentation also has a terminal-style site in the `site` folder. You can type commands there, like in Telegram or Discord: `/help`, `/canvas`, `/fn DrawLine`.
