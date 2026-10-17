# Colors

## What a color is made of

Every color on screen is mixed from three beams: **red** (R), **green** (G) and **blue** (B). There is also a fourth number - **transparency** (A, "alpha"). It says how solid the color is.

Every number goes from **0** to **255**:

| Number | For R, G, B | For A (alpha) |
|--------|-------------|---------------|
| 0 | this beam is off | the color is invisible |
| 128 | half | half transparent |
| 255 | full beam | the color is fully solid |

| Color | R | G | B |
|-------|---|---|---|
| Black | 0 | 0 | 0 |
| White | 255 | 255 | 255 |
| Red | 255 | 0 | 0 |
| Green | 0 | 255 | 0 |
| Blue | 0 | 0 | 255 |
| Yellow | 255 | 255 | 0 |
| Purple | 128 | 0 | 255 |

## A color as one number

Bloom stores a color as **one** big number (32 bits). It has 4 slots of 8 bits, and red sits in the lowest one:

```text
 0x AA BB GG RR
    │  │  │  └── red    (bits 0–7)
    │  │  └───── green  (bits 8–15)
    │  └──────── blue   (bits 16–23)
    └─────────── alpha  (bits 24–31)
```

For example, solid red is `0xFF0000FF`. The bytes lie in the same order in `EditableImage:ReadPixelsBuffer()`, so Bloom does not reorder anything and works fast.

> [!TIP]
> You do not have to remember the byte order. Just use `Color4.New32Bit(r, g, b, a)`.

## Where to get Color4

### `Bloom.GetColor4()`

**What it does:** gives you the module with color functions.

```lua
local Color4 = Bloom.GetColor4()
```

**All outcomes:** ✅ always returns the same module.

## Functions for number colors

### `Color4.New32Bit(R, G, B, A?)`

**What it does:** packs a color number from four parts.

| Name | Type | What it is |
|------|------|------------|
| `R`, `G`, `B` | `number` | Red, green, blue (0–255) |
| `A` | `number?` | Transparency (0–255). If you do not pass it, it is **255** (fully solid) |

```lua
local orange = Color4.New32Bit(255, 140, 0)
local glass = Color4.New32Bit(200, 230, 255, 100)
```

**All outcomes:**

- ✅ Returns a color number.
- ✂️ A number above 255 or below 0 is "cut by a mask": only its lowest 8 bits are kept. For example, 256 becomes 0, and 300 becomes 44. To get "at most 255", use `math.clamp` first.
- ✂️ A fractional number is rounded down, because that is how `bit32` works.

### `Color4.Unpack(color)`

**What it does:** splits a color number back into 4 parts.

```lua
local r, g, b, a = Color4.Unpack(orange)
```

**Returns:** `r, g, b, a` - four numbers from 0 to 255.

**All outcomes:** ✅ always four numbers.

### `Color4.SetR(color, value)`, `Color4.SetG(color, value)`, `Color4.SetB(color, value)`, `Color4.SetA(color, value)`

**What it does:** changes one part of a color and returns a **new** number. The old number does not change.

```lua
local halfOrange = Color4.SetA(orange, 128)
```

**All outcomes:**

- ✅ Returns a new color.
- ✂️ A `value` outside 0–255 is cut by a mask, like in `New32Bit`: only its lowest 8 bits are kept. Pass a whole number from 0 to 255.

### `Color4.BlendOver(destination, source)`

**What it does:** puts the color `source` **on top of** the color `destination`, like a piece of colored glass over a drawing. It takes the transparency of both colors into account.

```lua
local result = Color4.BlendOver(
	Color4.New32Bit(0, 0, 255),
	Color4.New32Bit(255, 0, 0, 128)
)
```

**All outcomes:**

- ✅ `source` is fully solid (A = 255) - the result equals `source`.
- ✅ `source` is fully invisible (A = 0) - the result equals `destination`.
- ✅ Otherwise the colors are mixed. The more solid `source` is, the more of it is in the result.
- ✅ Both colors are invisible - the result is `0`.

> [!NOTE]
> Bloom uses "straight" alpha, not "premultiplied" alpha. The color is stored as is, and alpha sits next to it separately.

### `Color4.Zero`

This is just the number `0` - fully transparent black.

## Color objects

Sometimes it is handier to work with an object that has the fields `R`, `G`, `B` and `A`.

### `Color4.New(R, G, B, A?)`

**What it does:** creates a color object.

```lua
local sky = Color4.New(135, 206, 235)
print(sky.R, sky.G, sky.B, sky.A)
```

**All outcomes:**

- ✅ Numbers are **rounded** to the nearest whole number and **clamped** to 0–255. So 300 becomes 255, and −5 becomes 0. The object is safer than `New32Bit`.
- ✅ `A` is 255 by default.

### `color:To32Bit()`

**What it does:** turns the object into a color number for drawing functions.

```lua
canvas:Clear(sky:To32Bit())
```

### `Color4.From32Bit(color)`

**What it does:** turns a color number back into an object.

### `Color4.FromColor3(color, alpha?)`

**What it does:** turns a regular Roblox `Color3` (parts from 0 to 1) into a `Color4` object.

```lua
local c = Color4.FromColor3(Color3.fromRGB(255, 100, 0))
```

**All outcomes:** ✅ parts are multiplied by 255 and rounded. `alpha` is 255 by default.

### `color:Lerp(other, t)`

**What it does:** finds a color "between" two colors. `t = 0` is the first color, `t = 1` is the second, `t = 0.5` is exactly in the middle.

```lua
local red = Color4.New(255, 0, 0)
local blue = Color4.New(0, 0, 255)

for x = 1, 100 do
	local mix = red:Lerp(blue, (x - 1) / 99)
	canvas:DrawVerticalLine(x, 1, 20, mix:To32Bit())
end
```

**All outcomes:**

- ✅ Returns a new color object.
- ✂️ `t` below 0 counts as 0, above 1 counts as 1.

## Important: drawing replaces the color

> [!WARNING]
> `DrawPixel`, `DrawLine`, `DrawHorizontalLine`, `DrawVerticalLine`, `DrawRectangle` and `DrawTriangle` **replace** the pixel completely, transparency included. A half-transparent rectangle does not mix with the background - it makes a hole.
>
> Only `DrawLineAA`, `DrawTexture` (by default) and `DrawText` mix colors. For everything else use `Color4.BlendOver` yourself.

Next: [Drawing →](06-drawing.md)
