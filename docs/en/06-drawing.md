# Drawing

Here are all of Bloom's "pencils": a dot, lines, a rectangle and a triangle.

## Rules for everything

1. **Counting from one.** The top-left pixel is `(1, 1)`, the bottom-right is `(canvas.res_x, canvas.res_y)`.
2. **Edges are included.** `DrawRectangle(1, 1, 3, 3, ...)` paints a 3 × 3 square, that is 9 pixels.
3. **Order does not matter.** `(10, 10, 1, 1)` draws the same as `(1, 1, 10, 10)`.
4. **Going past the edge is fine.** Everything that sticks out of the canvas or the window (`SetViewport`) is simply clipped. There is no error.
5. **The color is replaced.** All functions here, except `DrawLineAA`, put the color as is, transparency included, and mix nothing.
6. **Tiles get dirty by themselves.** Bloom marks the changed places, and after `Update()` they appear on screen.

## Dots

### `canvas:DrawPixel(x, y, color)`

**What it does:** paints one square.

| Name | Type | What it is |
|------|------|------------|
| `x` | `number` | Column number, from 1 |
| `y` | `number` | Row number, from 1 |
| `color` | `number` | A color from `Color4.New32Bit` |

```lua
canvas:DrawPixel(10, 20, Color4.New32Bit(255, 0, 0))
```

**All outcomes:**

- ✅ The pixel is painted, its tile becomes dirty.
- ✂️ Fractional coordinates are rounded **down**: `(10.9, 20.2)` → `(10, 20)`.
- 🙈 The dot is outside the canvas or the window - nothing happens, no error.

> [!TIP]
> If you need to paint many pixels in a row, `DrawRectangle` and `DrawHorizontalLine` are dozens of times faster than thousands of `DrawPixel` calls.

### `canvas:ReadPixel(x, y)`

**What it does:** finds out the color of a square in the draft.

**Returns:** `number` - the color. You can split it into parts with `Color4.Unpack`.

```lua
local color = canvas:ReadPixel(10, 20)
local r, g, b, a = Color4.Unpack(color)
```

**All outcomes:**

- ✅ Returns the color from the **draft**, even if it has not been sent to the screen yet.
- ✂️ Fractional coordinates are rounded down.
- 0️⃣ The dot is outside the canvas - returns `0`.
- ℹ️ The window (`SetViewport`) is ignored: you can read anywhere.

### `canvas:DrawPixelUnsafe(x, y, color)`

**What it does:** the same as `DrawPixel`, but **without checks**. It is faster, but more dangerous.

**All outcomes:**

- ✅ Whole coordinates inside the canvas - the pixel is painted.
- 🚫 No rounding, no window, no edge check.
- 💥 `x` is bigger than the width - the pixel lands **at the start of the next row**, not outside the edge.
- 💥 The dot is completely outside the draft - the error `buffer access out of bounds`.
- 💥 Fractional coordinates - the pixel may land in the wrong place. The tile may also be marked wrongly.

Use this function only when you are sure about the coordinates, for example in your own loop `for x = 1, canvas.res_x`.

### `canvas:ReadPixelUnsafe(x, y)`

**What it does:** reads a pixel without checks.

**All outcomes:** ✅ correct coordinates - the color. 💥 Wrong ones - someone else's pixel or the error `buffer access out of bounds`.

## Lines

### `canvas:DrawLine(x0, y0, x1, y1, color)`

**What it does:** draws a thin line, 1 pixel thick, from the point `(x0, y0)` to the point `(x1, y1)`.

```lua
canvas:DrawLine(1, 1, 100, 50, Color4.New32Bit(255, 255, 255))
```

```text
 ■ ■ . . . . . .
 . . ■ ■ . . . .
 . . . . ■ ■ . .
 . . . . . . ■ ■
```

**All outcomes:**

- ✅ Both end points are painted. The line goes between them in "steps" (this is Bresenham's algorithm).
- ✂️ Fractional ends are rounded to the **nearest** whole number: 2.5 → 3, 2.4 → 2.
- ✂️ The part of the line outside the window is cut off in advance, so even a very long line is drawn fast.
- 🙈 The line is completely outside the window - nothing happens.
- 🔹 Start and end are the same - one dot is drawn.

### `canvas:DrawLineAA(x0, y0, x1, y1, thickness, color)`

**What it does:** draws a **thick soft** line, like a felt-tip pen. Its edges are half transparent and blend smoothly with the background.

| Name | Type | What it is |
|------|------|------------|
| `thickness` | `number` | Thickness in pixels |
| `color` | `number` | The color. Its alpha is taken into account too |

```lua
canvas:DrawLineAA(20, 20, 200, 120, 6, Color4.New32Bit(255, 80, 160))
```

**All outcomes:**

- ✅ A round brush with radius `floor(thickness / 2)` is "stamped" along the line. The middle is solid, the edges are soft.
- ✅ Every pixel is blended **once**, using the most solid stamp, so there are no dark stripes at the joints.
- ✅ A half-transparent color (`A < 255`) gives a half-transparent line.
- 🔹 `thickness` below 2 - the radius is 0, and the line is 1 pixel thick.
- ✂️ The part outside the window is clipped.
- 🙈 The line is completely outside the window - nothing happens.
- 🐢 This is slower than `DrawLine`: the thicker the line, the more work.

> [!NOTE]
> This is a brush, not "real" mathematical anti-aliasing. It looks good for interfaces and painting, but it is not suited for very precise graphics.

### `canvas:DrawHorizontalLine(x0, y, x1, color)`

**What it does:** draws a straight horizontal line on row `y` from `x0` to `x1`.

```lua
canvas:DrawHorizontalLine(1, 50, canvas.res_x, Color4.New32Bit(0, 0, 0))
```

**All outcomes:**

- ✅ All pixels from `x0` to `x1` inclusive are painted, in any order.
- ✂️ Numbers are rounded **down**.
- ✂️ The line is clipped by the window.
- 🙈 Row `y` is outside the window - nothing happens.

### `canvas:DrawVerticalLine(x, y0, y1, color)`

**What it does:** draws a straight vertical line in column `x` from `y0` to `y1`.

**All outcomes:** the same as for the horizontal line, only vertical.

## Shapes

### `canvas:DrawRectangle(x0, y0, x1, y1, color)`

**What it does:** draws a **filled** rectangle. `(x0, y0)` and `(x1, y1)` are two opposite corners.

```lua
canvas:DrawRectangle(10, 10, 60, 40, Color4.New32Bit(40, 180, 255))
```

**All outcomes:**

- ✅ Everything is painted, edges included.
- ✂️ Corners are rounded down, order does not matter.
- ✂️ The rectangle is clipped by the window.
- 🙈 Completely outside the window - nothing happens.
- ⚡ Very fast: one row is prepared once and copied whole.

**How to draw just a frame (without filling):**

```lua
local function drawFrame(canvas, x0, y0, x1, y1, color)
	canvas:DrawHorizontalLine(x0, y0, x1, color)
	canvas:DrawHorizontalLine(x0, y1, x1, color)
	canvas:DrawVerticalLine(x0, y0, y1, color)
	canvas:DrawVerticalLine(x1, y0, y1, color)
end
```

### `canvas:DrawTriangle(x0, y0, x1, y1, x2, y2, color)`

**What it does:** draws a filled triangle from three corners.

```lua
canvas:DrawTriangle(50, 10, 10, 90, 90, 90, Color4.New32Bit(255, 200, 0))
```

```text
         ▲ (50, 10)
        ███
       █████
      ███████
 (10, 90)   (90, 90)
```

**All outcomes:**

- ✅ The triangle is filled row by row from top to bottom. Corners can be given in any order.
- ✂️ Corners are rounded down, and row edges to the nearest whole number.
- 🔹 All three corners are on one row - a horizontal line is drawn.
- 🔹 All three corners are on one straight line - a thin strip along it is drawn.
- ✂️ Clipped by the window.

**How to draw a polygon:** cut it into triangles like a "fan" from the first corner:

```lua
local function drawPolygon(canvas, points, color)
	for i = 2, #points - 1 do
		local a, b, c = points[1], points[i], points[i + 1]
		canvas:DrawTriangle(a.X, a.Y, b.X, b.Y, c.X, c.Y, color)
	end
end
```

This works for convex shapes: squares, hexagons, circles made of many points.

## Recipe: a circle

There is no separate circle function, but it is easy to build one from horizontal lines:

```lua
local function drawCircle(canvas, cx, cy, radius, color)
	for dy = -radius, radius do
		local half = math.floor(math.sqrt(radius * radius - dy * dy))
		canvas:DrawHorizontalLine(cx - half, cy + dy, cx + half, color)
	end
end

drawCircle(canvas, 100, 100, 30, Color4.New32Bit(255, 220, 0))
```

Next: [Textures →](07-textures.md)
