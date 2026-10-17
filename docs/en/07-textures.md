# Textures

A **texture** is a ready-made picture that lives in memory, like a sticker in an album. You can "stick" it onto the canvas many times: anywhere, at any size, with a tint and transparency.

```text
 texture 4×2           canvas
 ┌──────┐              ┌──────────────────┐
 │ ▓▓░░ │    Draw →    │   ▓▓▓▓░░░░       │
 │ ▓▓░░ │   ×2 size    │   ▓▓▓▓░░░░       │
 └──────┘              │   ▓▓▓▓░░░░       │
                       │   ▓▓▓▓░░░░       │
                       └──────────────────┘
```

Textures live in the `Bloom.Texture` module.

```lua
local Texture = Bloom.Texture
```

## Creating a texture

### `Texture.New(width, height, pixels, copy_pixels?)`

**What it does:** makes a texture from your own pixel buffer.

| Name | Type | What it is |
|------|------|------------|
| `width`, `height` | `number` | Size in pixels (rounded down) |
| `pixels` | `buffer` | Exactly `width * height * 4` bytes: R, G, B, A for every pixel, row after row |
| `copy_pixels` | `boolean?` | By default the buffer is **copied**. `false` - use your buffer without a copy |

```lua
local pixels = buffer.create(2 * 2 * 4)
buffer.writeu32(pixels, 0, Color4.New32Bit(255, 0, 0))
buffer.writeu32(pixels, 4, Color4.New32Bit(0, 255, 0))
buffer.writeu32(pixels, 8, Color4.New32Bit(0, 0, 255))
buffer.writeu32(pixels, 12, Color4.New32Bit(255, 255, 255))

local checker = Texture.New(2, 2, pixels)
```

**All outcomes:**

- ✅ The texture is created.
- 📋 `copy_pixels` is not given or is `true` - the texture has its own copy, and you can keep changing your buffer safely.
- 🔗 `copy_pixels = false` - the texture uses **your** buffer. If you change it, the texture changes too. This saves memory.
- 🚫 Width or height less than 1 - the error `Texture.New expects positive dimensions`.
- 🚫 The buffer size is not `width * height * 4` - the error `Texture.New expects width * height * 4 RGBA bytes`.

### `Texture.FromEditableImage(editable_image)`

**What it does:** copies the pixels of an `EditableImage` into a new texture.

```lua
local tex = Texture.FromEditableImage(myEditableImage)
```

**All outcomes:**

- ✅ A texture of the same size as the image.
- 🔒 The image itself is not changed or deleted.
- ℹ️ If you change the image later, the texture stays old: it is a copy.

### `Texture.FromContent(content)`

**What it does:** loads a picture from Roblox (for example by `rbxassetid://`) and makes a texture from it.

> [!WARNING]
> This function **waits** for loading (it yields). Do not call it inside `RenderStepped` - call it in advance, at startup.

```lua
local tex = Texture.FromContent(Content.fromUri("rbxassetid://1234567890"))
```

**All outcomes:**

- ✅ The picture loaded - the texture is ready. The temporary `EditableImage` is deleted right away.
- 🚫 The picture is not yours (Roblox only allows loading pictures of the game's creator or group) - an error from Roblox.
- 🚫 `Allow Mesh / Image APIs` is off - an error from Roblox.
- 🧠 Out of memory - the error `Texture.FromContent: EditableImage memory budget is exhausted`.
- 🚫 The pixels could not be read - the error is passed on, and the temporary image is deleted anyway.

## Working with a texture

### `texture:GetPixel(x, y)`

**What it does:** finds out the color of a texture pixel. Coordinates start from 1, as everywhere.

**All outcomes:**

- ✅ Returns the color.
- ✂️ Fractional coordinates are rounded down.
- 0️⃣ Outside the texture - `0`.
- 0️⃣ The texture is destroyed - `0`.

### `texture:Destroy()`

**What it does:** frees the texture's memory.

**All outcomes:**

- ✅ The buffer is replaced with an empty one, `texture.destroyed = true`.
- 🚫 A destroyed texture cannot be drawn: you get the error `Cannot draw a destroyed Texture`.
- 🔁 Calling it again is safe.

### Texture fields

| Field | What it is |
|-------|------------|
| `texture.width`, `texture.height` | Size |
| `texture.pixels` | Pixel buffer |
| `texture.destroyed` | `true` if the texture is destroyed |

## Drawing a texture

### `canvas:DrawTexture(texture, x, y, width?, height?, options?)`

**What it does:** puts the texture onto the canvas.

| Name | Type | What it is |
|------|------|------------|
| `texture` | `Texture` | What to draw |
| `x`, `y` | `number` | Where the top-left corner goes |
| `width`, `height` | `number?` | What size to draw. By default - the texture's size |
| `options` | `DrawOptions?` | Extra settings (see the table below) |

**`options` settings:**

| Field | Default | What it does |
|-------|---------|--------------|
| `source_x`, `source_y` | `1`, `1` | Where in the texture to start cutting a piece |
| `source_width`, `source_height` | the whole texture | What size of piece to cut |
| `tint` | white `0xFFFFFFFF` | Tint: every channel is multiplied by the channel of this color |
| `opacity` | `1` | Transparency from 0 (invisible) to 1 (as is) |
| `blend` | `true` | `true` - mix with the background by transparency. `false` - just replace the pixels |

**Examples:**

```lua
canvas:DrawTexture(tex, 10, 10)

canvas:DrawTexture(tex, 10, 10, tex.width * 3, tex.height * 3)

canvas:DrawTexture(tex, 50, 50, nil, nil, {
	tint = Color4.New32Bit(255, 120, 120),
	opacity = 0.5,
})

canvas:DrawTexture(spriteSheet, 100, 100, 32, 32, {
	source_x = 33,
	source_y = 1,
	source_width = 32,
	source_height = 32,
})
```

The last example is a **sprite sheet**: one big picture with many frames. A 32 × 32 frame starting at pixel 33 is cut out of it.

**All outcomes:**

- ✅ The texture is drawn. Stretching and shrinking use "nearest neighbor": pixels become little squares, without blur. That is exactly right for pixel art.
- ✂️ Coordinates and sizes are rounded down.
- ✂️ The `source_*` piece is clamped inside the texture: it cannot go past the edge.
- ✂️ The result is clipped by the canvas and the window.
- 🎨 `tint` is white and `opacity = 1` - pixels are not recolored, and drawing is faster.
- 🎨 `opacity` below 0 counts as 0, above 1 counts as 1.
- 🧱 `blend = false` - pixels are replaced completely, transparency included. This is the fastest mode for opaque pictures.
- 🙈 `width` or `height` is 0 or less - nothing happens.
- 🙈 The place is completely outside the canvas - nothing happens.
- 💤 The canvas is destroyed - nothing happens.
- 🚫 The texture is destroyed - the error `Cannot draw a destroyed Texture`.

> [!TIP]
> Create textures **once** at startup, and only draw them every frame. Creating a texture copies a lot of memory.

Next: [Shaders →](08-shaders.md)
