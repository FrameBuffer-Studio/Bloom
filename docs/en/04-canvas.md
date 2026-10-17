# Canvas

The canvas (`canvas`) is the main Bloom object. It holds the pixel draft, the screen tiles, the settings, the task queue and the pipeline. All drawing goes through it.

## How a frame works

```text
 BeginFrame(color?)  →  draw  →  EndFrame()
       │                              │
       ├─ stage "beginFrame"          ├─ stage "endFrame"
       └─ fill, if a color is given   └─ Update() or UpdateAsync()
```

## Useful canvas fields

You can read them, but **do not change them by hand**: there are functions for that.

| Field | What it is |
|-------|------------|
| `canvas.res_x` | Canvas width in pixels |
| `canvas.res_y` | Canvas height in pixels |
| `canvas.tile_size` | Size of one tile |
| `canvas.size_x`, `canvas.size_y` | How many tiles across and down |
| `canvas.tiles` | Tiles (number → `{x, y, w, h, editable, buffer, image}`) |
| `canvas.async` | This canvas's task scheduler ([chapter 10](10-scheduler.md)) |
| `canvas.pipeline` | Stage pipeline ([chapter 11](11-pipeline.md)) |

## Creating

### `Bloom.Create(resolution, parent?, reference?, options?)`

**What it does:** creates a new canvas. If you pass `parent` and `reference`, the picture appears on screen.

**Arguments:**

| Name | Type | Required? | What it is |
|------|------|-----------|------------|
| `resolution` | `Vector2` | yes | Canvas size in pixels, for example `Vector2.new(320, 240)`. The fractional part is dropped |
| `parent` | `Instance?` | no | Where to put the images: `Frame`, `ScreenGui`, `SurfaceGui` and so on |
| `reference` | `ImageLabel?` | no | A sample. Bloom copies it for every tile |
| `options` | `Options?` | no | Extra settings (see the table below) |

**`options` settings:**

| Field | Default | What it does |
|-------|---------|--------------|
| `tile_size` | `1024` | Tile size. The number is rounded down and clamped between 1 and 1024 |
| `async_budget` | `0.002` | How many seconds the scheduler may work per step. Never less than `0.0001` |
| `scheduler_options` | `{}` | Scheduler settings ([chapter 10](10-scheduler.md)) |
| `auto_clip` | `true` | Turn on `ClipsDescendants` on `parent` so the picture does not stick out of the frame |
| `clear_color` | `0` | The color for `Clear()` without an argument. `0` is fully transparent |

**Returns:** a canvas (`Bloom`).

**Example:**

```lua
local canvas = Bloom.Create(Vector2.new(320, 240), frame, template, {
	tile_size = 512,
	clear_color = Color4.New32Bit(20, 20, 30),
})
```

**All outcomes:**

- ✅ **`parent` and `reference` are given.** A copy of `reference` is made for every tile. It gets a size in pixels (`UDim2.fromOffset`), a position, `ImageContent` and `Visible = true`, and then it is put into `parent`. One canvas pixel equals one screen pixel.
- 🌑 **No `reference`.** The canvas draws "invisibly": everything works, but nothing appears on screen. This is handy for preparing pictures in advance or for computing something from pixels.
- 👻 **`reference` is given, but no `parent`.** The copies are created but not put anywhere, so they are not visible.
- ✂️ **`parent` is a `GuiObject`** (for example a `Frame`) and `auto_clip` is not turned off. Then `ClipsDescendants = true` is set on `parent`. A `ScreenGui` does not have this property, and Bloom leaves it alone.
- 🧩 **The canvas is bigger than `tile_size`.** It is cut into tiles. Tiles in the last column and the last row may be smaller than the others.
- 🎨 **Starting color.** A new canvas is fully transparent (all pixels are `0`), even if `clear_color` is set. To fill it with that color, call `canvas:Clear()`.
- 🧼 **Dirty tiles.** Right after creation all tiles are "dirty", so the first `Update()` sends them all to the screen.
- 🚫 **Size less than 1** (for example `Vector2.new(0, 100)`) - the error `Bloom.Create expects a positive resolution`.
- 🚫 **EditableImage is disabled in the game settings** - an error with a hint about `Allow Mesh / Image APIs` ([chapter 2](02-setup.md)).
- 🧠 **Out of memory.** The error `Bloom: EditableImage memory budget is exhausted (WxH tile)`. Bloom deletes all tiles it managed to create before the error by itself, so no memory leaks.

### `Bloom.FromEditableImage(editable_image, holder)`

**What it does:** turns an existing `EditableImage` into a canvas. The image's pixels are copied into the draft, so you can draw on top of them.

**Arguments:**

| Name | Type | What it is |
|------|------|------------|
| `editable_image` | `EditableImage` | Your image, at most 1024 × 1024 |
| `holder` | `ImageLabel` | The `ImageLabel` that already shows this image |

**Returns:** a canvas.

```lua
local editable = AssetService:CreateEditableImage({ Size = Vector2.new(128, 128) })
imageLabel.ImageContent = Content.fromObject(editable)

local canvas = Bloom.FromEditableImage(editable, imageLabel)
canvas:DrawLine(1, 1, 128, 128, Color4.New32Bit(255, 0, 0))
canvas:Update()
```

**All outcomes:**

- ✅ The canvas gets one tile - your image. Its current pixels become the draft.
- 🔒 The image and the `ImageLabel` **stay yours**: `canvas:Destroy()` does not delete them.
- 🧼 The tile is **not** dirty right away: your image is already on screen. It updates after the first drawing.
- 🚫 The image is bigger than 1024 on any side - the error `Bloom.FromEditableImage supports images up to 1024x1024`.
- 🚫 The image size is 0 - the error `Bloom.FromEditableImage expects a positive resolution`.
- 🚫 You cannot call `Resize` later - it raises an error (see below).
- ℹ️ This function does not check the game settings. If you already have an `EditableImage`, they are turned on.

## Frame

### `canvas:BeginFrame(clear_color?)`

**What it does:** starts a new frame. If you pass a color, the whole canvas is filled with it first.

| Name | Type | What it is |
|------|------|------------|
| `clear_color` | `number?` | Fill color. If you do not pass it, the canvas is not cleared |

**All outcomes:**

- ✅ A color is given - `Clear(color)` runs, then the `beginFrame` stage runs.
- ✅ No color - the old picture stays, only the `beginFrame` stage runs.
- 💤 The canvas is already destroyed - nothing happens.

> [!NOTE]
> `BeginFrame()` **without** an argument does not fill the canvas even with the color from `SetClearColor`. If you want clearing with the default color, call `canvas:Clear()`.

### `canvas:EndFrame(use_async?)`

**What it does:** finishes the frame and shows it on screen.

| Name | Type | What it is |
|------|------|------------|
| `use_async` | `boolean?` | `true` - send piece by piece with `UpdateAsync()`. Otherwise everything is sent at once with `Update()` |

**All outcomes:**

- ✅ The `endFrame` stage runs, then `Update()` or `UpdateAsync()`.
- 💤 The canvas is destroyed - nothing happens.

## Showing on screen

### `canvas:Update()`

**What it does:** sends all dirty tiles to the screen right now.

**All outcomes:**

- ✅ Stages run in this order: `beforeUpload` → uploading every dirty tile → `afterUpload`. The tiles become clean.
- ✋ If some tiles were waiting to be sent through `UpdateAsync`, that waiting is cancelled: `Update` sends them itself.
- ⚠️ A tile could not be sent (Roblox raised an error) - the warning `[Bloom] Failed to upload tile N: ...` appears. The tile stays dirty and tries again next time. Other tiles are sent as usual.
- 💤 No dirty tiles - the stages still run, but nothing is uploaded.
- 💤 The canvas is destroyed - nothing happens.
- 🐢 Roblox updates **one** `EditableImage` on screen per frame. If there are 4 dirty tiles, the picture may need 4 frames to catch up. This is a Roblox rule, not a Bloom bug.

### `canvas:UpdateAsync(budget?)`

**What it does:** puts the dirty tiles into the scheduler queue. Every tile is a separate task. The work is spread over time, and the game does not freeze.

| Name | Type | What it is |
|------|------|------------|
| `budget` | `number?` | How many seconds the scheduler may work per step. Remembered forever (minimum `0.0001`) |

**All outcomes:**

- ✅ `beforeUpload` runs, every dirty tile joins the queue, and the scheduler starts.
- 📦 After every uploaded tile the `tileUploaded` stage runs. After the last one - `afterUpload`.
- 🔁 A tile is already in the queue - it is not added a second time. The pixels are taken at the moment of sending, so the freshest ones go out.
- 💤 No dirty tiles - `afterUpload` runs right away and the scheduler does not start.
- ✋ `Update()`, `Resize()` or `Destroy()` cancel this queue.
- ⚠️ The scheduler is shared: together with tiles it also runs your tasks from `canvas:Submit`.
- 💤 The canvas is destroyed - nothing happens.

## Clearing and background color

### `canvas:Clear(color?)`

**What it does:** fills the **whole** canvas with one color.

| Name | Type | What it is |
|------|------|------------|
| `color` | `number?` | The color. If you do not pass it, the color from `SetClearColor` (or `clear_color` from the settings) is used |

**All outcomes:**

- ✅ The whole canvas is painted, all tiles are dirty.
- 🖼️ The drawing window (`SetViewport`) does **not** apply: everything is cleared.
- ⚡ The color `0` is filled especially fast.
- 💤 The canvas is destroyed - nothing happens.

### `canvas:SetClearColor(color)`

**What it does:** remembers the color that `Clear()` uses without an argument.

```lua
canvas:SetClearColor(Color4.New32Bit(0, 0, 0))
canvas:Clear()
```

**All outcomes:** ✅ the color is remembered. The canvas itself does not change.

## Drawing window (viewport)

A viewport is a stencil frame. Everything drawn outside of it is clipped.

```text
 ┌────────────── canvas ─────────────┐
 │                                   │
 │     ┌── viewport ──┐              │
 │     │  you can     │              │
 │     │  draw here   │              │
 │     └──────────────┘              │
 └───────────────────────────────────┘
```

### `canvas:SetViewport(x, y, width, height)`

| Name | Type | What it is |
|------|------|------------|
| `x`, `y` | `number` | Top-left corner of the window (from 1) |
| `width`, `height` | `number` | Width and height of the window |

```lua
canvas:SetViewport(10, 10, 100, 50)
canvas:DrawRectangle(1, 1, 500, 500, RED)
canvas:ResetViewport()
```

**All outcomes:**

- ✅ The window is set. Numbers are rounded down.
- ✂️ The window sticks out of the canvas - it is cut to the canvas edges.
- 🕳️ Width or height is 0 or less, or the window is fully outside the canvas - the window is empty, and **nothing is drawn** until you call `ResetViewport`.
- ℹ️ These respect the window: `DrawPixel`, all lines, rectangles, triangles, textures, text and shaders.
- ℹ️ These **ignore** the window: `Clear`, `ReadPixel`, `DrawPixelUnsafe`, `ReadPixelUnsafe` and direct writes into `GetBuffer()`.

### `canvas:ResetViewport()`

**What it does:** sets the window back to the whole canvas.

**All outcomes:** ✅ you can draw everywhere again.

## State and direct access

### `canvas:GetState()`

**What it does:** returns the **live** state table `{ clear_color, viewport = { x, y, w, h } }`.

**All outcomes:** ✅ the table is not a copy but the original. If you change its fields, the canvas changes too. Better use `SetViewport` and `SetClearColor`.

### `canvas:GetBuffer()`

**What it does:** gives you the draft itself - the `buffer` that holds all pixels.

**How to find a pixel in the buffer:** `offset = ((y - 1) * canvas.res_x + (x - 1)) * 4`.

```lua
local pixels = canvas:GetBuffer()
local offset = ((5 - 1) * canvas.res_x + (3 - 1)) * 4
buffer.writeu32(pixels, offset, Color4.New32Bit(255, 0, 0))
canvas:MarkDirty(3, 5, 3, 5)
canvas:Update()
```

**All outcomes:**

- ✅ You can read and write directly. This is the fastest way.
- ⚠️ Bloom **does not know** that you changed something. Always call `MarkDirty`, otherwise the changes do not appear on screen.
- ⚠️ After `Resize()` a **new** buffer is created. The old reference is no longer connected to the canvas - get the buffer again.
- 🚫 An offset outside the buffer - the Luau error `buffer access out of bounds`.

### `canvas:MarkDirty(x0, y0, x1, y1)`

**What it does:** tells Bloom: "I changed something in this rectangle, send it to the screen".

**All outcomes:**

- ✅ All tiles touched by the rectangle become dirty. Corners can be given in any order.
- ✂️ The rectangle is clipped to the canvas.
- 💤 The rectangle is fully outside the canvas - nothing happens.

## Size and destruction

### `canvas:Resize(resolution)`

**What it does:** changes the canvas size.

```lua
canvas:Resize(Vector2.new(640, 480))
```

**All outcomes:**

- ✅ Old tiles are deleted, new ones are created. The draft becomes new and fully transparent. The window is reset to the whole canvas. All tiles are dirty.
- 🧹 Uploads waiting in `UpdateAsync` are cancelled.
- 🗑️ **The old picture disappears.** If you need it, draw it again.
- 🚫 The canvas was made with `FromEditableImage` - the error `Resize is not supported for contexts created with FromEditableImage`.
- 🚫 Size less than 1 - the error `Bloom.Resize expects a positive resolution`.
- 🧠 Not enough memory for the new tiles - a memory budget error. The canvas stays without tiles. Try a smaller size or destroy the canvas.
- 💤 The canvas is destroyed - nothing happens.

### `canvas:Destroy()`

**What it does:** turns the canvas off forever and frees memory.

**All outcomes:**

- ✅ The scheduler stops, all tasks are cancelled.
- ✅ Own `EditableImage` objects and `ImageLabel` copies are deleted (if the canvas was made with `Create`).
- 🔒 If the canvas was made with `FromEditableImage`, your image and `ImageLabel` stay.
- 🔁 Calling it again does nothing.
- 💤 After destruction `Update`, `Clear`, `BeginFrame`, `EndFrame`, `Resize`, `DrawTexture`, `DrawText` and `ApplyShader` do nothing. Lines and shapes still write into the old draft, but it never reaches the screen again. Just do not use a destroyed canvas.

> [!TIP]
> Destroy the canvas when you no longer need it, for example when leaving a menu. `EditableImage` takes a lot of memory, especially on phones.

Next: [Colors →](05-colors.md)
