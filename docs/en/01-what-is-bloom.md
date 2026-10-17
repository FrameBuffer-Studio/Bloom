# What is Bloom

**Bloom** is a Roblox library that draws pictures pixel by pixel. A pixel is one tiny colored dot on the screen.

## Imagine a squared notebook

Take a squared notebook and colored pencils. If you color the right squares, you get a picture: a house, the sun, a cat.

Bloom works the same way:

- **The canvas** (`canvas`) is the notebook.
- **A pixel** is one square.
- **A color** is a pencil.
- **Drawing functions** (`DrawLine`, `DrawRectangle` and others) are helpers. They color many squares at once: a whole line or a whole rectangle.

```text
   1 2 3 4 5 6 7 8   ← column number (x)
 1 . . . . . . . .
 2 . ■ ■ ■ ■ ■ . .   ← DrawRectangle(2, 2, 6, 4, ...)
 3 . ■ ■ ■ ■ ■ . .
 4 . ■ ■ ■ ■ ■ . .
 5 . . . . . . . .
 ↑
 row number (y)
```

## Where the picture lives

Bloom keeps two "copies" of the picture.

1. **The draft in memory.** This is a `buffer`, a long strip of numbers. Every square takes 4 numbers in it: red, green, blue and transparency. All drawing functions draw only here. It is very fast, but nothing is visible on screen yet.
2. **The picture on screen.** This is an `EditableImage`, a special Roblox image that can be changed from code. A regular `ImageLabel` shows it.

When you call `canvas:Update()`, Bloom moves the draft to the screen. It is like a drawing you first sketch in pencil on scrap paper and then carefully copy into your album.

```text
 DrawLine, DrawRectangle, ...      Update() / EndFrame()
 ───────────────────────────►  draft (buffer)  ─────────────►  screen (EditableImage)
```

## Why the canvas is cut into pieces

Roblox has a rule: one `EditableImage` cannot be bigger than **1024 × 1024** pixels. If you need a bigger canvas, for example 2000 × 1500, Bloom cuts it into **tiles**, like a floor made of tiles. Every tile is a separate `EditableImage` with its own `ImageLabel`. Together they look like one big picture.

```text
 canvas 2000 × 1500 with tile_size = 1024
 ┌──────────┬───────┐
 │  tile 0  │ til.1 │   1024 + 976 = 2000
 ├──────────┼───────┤
 │  tile 2  │ til.3 │   1024 + 476 = 1500
 └──────────┴───────┘
```

When you draw, Bloom remembers which tiles you touched. Such tiles are called **"dirty"**. On update, Bloom sends only the dirty tiles to the screen and leaves the rest alone. That is faster.

## What Bloom can do

| Ability | Chapter |
|---------|---------|
| Dots, lines, soft thick lines, rectangles, triangles | [Drawing](06-drawing.md) |
| Copying ready pictures, stretching, tinting, transparency | [Textures](07-textures.md) |
| Filters: invert, black and white, brightness, your own filters | [Shaders](08-shaders.md) |
| Text from `.ttf` fonts or from your own letter pictures | [Fonts and text](09-fonts.md) |
| A task queue with priorities so there is no lag | [Scheduler](10-scheduler.md) |
| Your own code at different moments of a frame | [Pipeline](11-pipeline.md) |
| Speed counters | [Stats](12-performance.md) |

## What Bloom cannot do

> [!WARNING]
> Bloom draws on the **processor** (CPU), not on the graphics card. So a big canvas where every pixel changes every frame will be slow. Bloom is good for interfaces, minimaps, pixel art, charts and effects on small areas.

- It is not a 3D engine. Bloom draws only flat 2D pictures.
- Bloom shaders are regular Luau functions. They run on the processor, not on the graphics card.
- Bloom must not be called from several threads at once for the same canvas.

## Where to put the code

Bloom is needed where the player sees the picture, that is in a **LocalScript** on the client. An `EditableImage` is not sent from the server to players. If you create it on the server, the player will not see it.

```text
StarterPlayer
└── StarterPlayerScripts
    └── MyDrawing (LocalScript)   ← call Bloom here
ReplicatedStorage
└── Bloom (ModuleScript)          ← the library lives here
```

Next: [Setup and check →](02-setup.md)
