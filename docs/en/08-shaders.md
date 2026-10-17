# Shaders

A **shader** is a magic filter. You give it a piece of the canvas, and it looks at **every** pixel in turn and decides what that pixel becomes. It is like phone camera filters: "black and white", "brighter", "inverted".

```text
 before:  ▓▓░░▒▒   →  Invert  →  after:  ░░▓▓▒▒
```

> [!WARNING]
> Bloom shaders run on the **processor**, not on the graphics card. A shader over a whole 1024 × 1024 canvas calls your function **more than a million times**. Apply shaders to small pieces and not every frame.

Shaders live in `Bloom.Shader`.

```lua
local Shader = Bloom.Shader
```

## Ready-made shaders

### `Shader.Invert()`

**What it does:** turns colors inside out: black becomes white, red becomes cyan. Transparency does not change.

```lua
canvas:ApplyShader(Shader.Invert(), 1, 1, canvas.res_x, canvas.res_y)
```

### `Shader.Grayscale()`

**What it does:** makes the picture black and white. Brightness is calculated the way the eye sees it (the Rec. 709 formula): green looks brighter than blue. Transparency does not change.

### `Shader.Brightness(amount?)`

**What it does:** makes things brighter or darker. `amount = 1` - as it was, `2` - twice as bright, `0.5` - darker, `0` - black.

```lua
local bright = Shader.Brightness(1.3)
canvas:ApplyShader(bright, 1, 1, 100, 100)

canvas:ApplyShader(bright, 1, 1, 100, 100, { amount = 0.7 })
```

**All outcomes:**

- ✅ Every channel is multiplied by `amount` and capped at 255.
- 🔹 `amount` is not given - it is 1.
- 🔹 `amount` below 0 counts as 0.
- 🔹 `uniforms` holds something other than a number - 1 is used.

## Your own shader

### `Bloom.CreateShader(name, callback, uniforms?)`

This is the same as `Shader.New(name, callback, uniforms?)`.

**What it does:** creates your own filter.

| Name | Type | What it is |
|------|------|------------|
| `name` | `string` | A name so you do not get confused (not empty) |
| `callback` | `function` | A function called for every pixel |
| `uniforms` | `table?` | Default settings that the function receives |

**The `callback` function receives:**

| Argument | What it is |
|----------|------------|
| `x`, `y` | Where the pixel is on the canvas (from 1) |
| `u`, `v` | Where the pixel is inside the piece: from 0 (left/top edge) to 1 (right/bottom edge) |
| `color32` | The pixel's current color |
| `uniforms` | Settings |

**And must return:** a new color (`number`) or `nil` if the pixel should not change.

```lua
local gradient = Bloom.CreateShader("Gradient", function(x, y, u, v, color32, uniforms)
	local red = math.floor(u * 255)
	local blue = math.floor(v * 255)
	return Color4.New32Bit(red, 0, blue, 255)
end)

canvas:ApplyShader(gradient, 1, 1, 200, 200)
```

```lua
local threshold = Bloom.CreateShader("Threshold", function(_, _, _, _, color32, uniforms)
	local r, g, b, a = Color4.Unpack(color32)
	local value = if (r + g + b) / 3 >= uniforms.level then 255 else 0
	return Color4.New32Bit(value, value, value, a)
end, { level = 128 })
```

**All outcomes when creating:**

- ✅ Returns a shader `{ name, callback, uniforms, enabled = true }`.
- 🚫 `name` is not a string or is empty - the error `Shader.New expects a name`.
- 🚫 `callback` is not a function - the error `Shader.New expects a callback`.

**How to turn a shader off without deleting it:** `myShader.enabled = false`. After that `ApplyShader` skips it.

## Applying a shader

### `canvas:ApplyShader(shader, x0, y0, x1, y1, uniforms?)`

**What it does:** runs a rectangle of the canvas through the shader.

| Name | Type | What it is |
|------|------|------------|
| `shader` | `Shader` | Which filter |
| `x0, y0, x1, y1` | `number` | Rectangle corners (inclusive, in any order) |
| `uniforms` | `table?` | Settings for this call. If given, they **fully replace** the shader's settings |

**Returns:** `number` - how many pixels were processed.

**All outcomes:**

- ✅ Every pixel went through the function. The number of pixels is returned.
- 🎬 The `beforeShader` stage runs before the work, `afterShader` after it.
- 🔹 The function returned `nil` - the pixel stayed the same.
- ✂️ The rectangle is clipped by the canvas and the window.
- 0️⃣ The rectangle is completely outside the window - returns `0`, and the stages do not run.
- 0️⃣ `shader.enabled = false` - returns `0`.
- 0️⃣ The canvas is destroyed - returns `0`.
- 📏 A rectangle 1 pixel wide - `u` is always 0. 1 pixel tall - `v` is always 0.
- 💥 The function raised an error - the error **flies out** of `ApplyShader`. Pixels processed so far are already changed, and the tiles are marked dirty. The `afterShader` stage does not run.
- 💥 The function returned something that is not a number (for example a string) - a Luau error when writing to the buffer.

## How to make a shader fast

1. **Create nothing inside the function:** no `{}`, `Vector2.new`, `Color3.new`, `function() end`. Create everything you need outside.
2. **Apply it to a small piece.** Need to darken a button - take the button's rectangle, not the whole screen.
3. **Do not apply it every frame** if the picture does not change.
4. **Return `nil`** for pixels that do not change: fewer writes to memory.

```lua
local function slow(_, _, _, _, color32)
	local parts = { Color4.Unpack(color32) }
	return Color4.New32Bit(parts[1], parts[2], parts[3], parts[4])
end

local function fast(_, _, _, _, color32)
	local r, g, b, a = Color4.Unpack(color32)
	return Color4.New32Bit(r, g, b, a)
end
```

Next: [Fonts and text →](09-fonts.md)
