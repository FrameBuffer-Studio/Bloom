# Fonts and text

To write letters on the canvas, Bloom needs a **font**. A font in Bloom is a cheat-sheet picture with all the letters drawn on it (it is called an **atlas**), plus a table saying where each letter is on that picture.

```text
 atlas:  ┌───┬───┬───┬───┬───┐
         │ A │ B │ C │ D │ … │   DrawText("CAB") → take C, then A, then B
         └───┴───┴───┴───┴───┘                    and stick them in order
```

Fonts live in `Bloom.Font`.

```lua
local Font = Bloom.Font
```

## Way 1. From a `.ttf` file

Bloom can read TrueType font files (`.ttf`) by itself and draw an atlas from them.

### `Font.FromString(font_data, pixel_size, charset?, options?)`

**What it does:** turns the bytes of a `.ttf` file (as a string) into a font.

| Name | Type | What it is |
|------|------|------------|
| `font_data` | `string` | The **raw bytes** of the `.ttf` file. Not Base64, but the bytes themselves |
| `pixel_size` | `number` | Letter size in pixels, from 4 to 128 |
| `charset` | `string?` | Which letters to prepare. By default - all printable ASCII characters (English letters, digits and signs) |
| `options` | `Options?` | `spacing` - extra space between letters, `fallback` - the code of the replacement letter (`?` by default) |

```lua
local font = Font.FromString(fontBytes, 18)

local russian = Font.FromString(fontBytes, 16,
	" АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя0123456789.,!?-"
)
```

**All outcomes:**

- ✅ The font is ready. Letters are drawn white with soft edges, so you can tint them any color.
- ✅ The `?` letter is **always** added, even if it is not in `charset`: it is needed as a replacement for unknown letters.
- ✅ Repeated letters in `charset` do no harm: each one is prepared once.
- 🔤 Cyrillic and other letters work if they exist in the font itself and in `charset`. `charset` is written in UTF-8, like a regular Luau string.
- 🚫 The string is shorter than 12 bytes or not a string at all - the error `Font.FromString expects a non-empty binary font string`.
- 🚫 `pixel_size` is below 4 or above 128 - the error `Font.FromBuffer pixel_size must be between 4 and 128`.
- 🚫 It is not TrueType (for example `.otf` with CFF, `.woff`, `.woff2`) - the error `Font supports TrueType-outline TTF files only; CFF/WOFF/WOFF2 are not supported`.
- 🚫 The file lacks required tables - the error `TTF is missing a required TrueType table`.
- 🚫 There is no Unicode table (cmap format 4 or 12) - the error `TTF has no supported Unicode cmap (format 4 or 12)`.
- 🚫 The file is cut or broken - the error `Invalid or truncated TrueType font: ...`.
- 🚫 Strange font sizes - the error `Invalid TrueType metrics`.
- 🚫 Too many letters or too big a size (the atlas is bigger than 1024 × 1024) - the error `Font atlas is too large; reduce pixel_size or the charset`.
- 🔹 If a letter from `charset` does not exist in the font itself, the font's "unknown" sign goes into the atlas instead. Usually it is an empty box.

> [!WARNING]
> `FromString` is **heavy** work: every letter has to be drawn from curves. Do it **once** at startup, not every frame.

> [!NOTE]
> Not supported: CFF fonts (usually `.otf`), WOFF and WOFF2, variable fonts and composite letters attached by points. Convert such a font into a regular static `.ttf` first, for example in FontForge.

### `Font.FromBuffer(font_buffer, pixel_size, charset?, options?)`

**What it does:** the same, but the bytes are in a `buffer`, not in a string.

**All outcomes:** the same as for `FromString`. If the buffer is shorter than 12 bytes - the error `Font.FromBuffer expects a non-empty binary font buffer`.

### How to get `.ttf` bytes into Roblox

Roblox cannot read files from disk. There are two ways.

**A. Put the font into a ModuleScript.** A small Python program turns a `.ttf` into a Luau module:

```python
import sys

data = open(sys.argv[1], "rb").read()
chunks = []
for start in range(0, len(data), 4096):
    part = data[start:start + 4096]
    chunks.append('"' + "".join(f"\\x{byte:02x}" for byte in part) + '"')

with open("FontData.luau", "w") as output:
    output.write("return table.concat({\n" + ",\n".join(chunks) + "\n})\n")
```

```lua
local fontBytes = require(game.ReplicatedStorage.FontData)
local font = Bloom.Font.FromString(fontBytes, 18)
```

**B. Download it on the server.** Turn on **HttpService** in the game settings, download the file with `HttpService:GetAsync(url)` and send it to the player as a `buffer` through a `RemoteEvent`. On the client use `Font.FromBuffer`.

> [!TIP]
> Pick small fonts or keep only the letters you need in them (FontForge calls this a subset). Then the module is smaller.

## Way 2. Your own atlas

If you already have a picture with all the letters (for example a pixel font), make the font yourself.

### `Font.New(atlas, glyphs, line_height, options?)`

| Name | Type | What it is |
|------|------|------------|
| `atlas` | `Texture` | The picture with all the letters |
| `glyphs` | `table` | Where each letter is. The key is the letter itself (`"A"`) or its code (`65`) |
| `line_height` | `number` | Line height in pixels |
| `options` | `Options?` | `spacing` and `fallback` |

**Every letter (glyph) is described like this:**

| Field | Required? | What it is |
|-------|-----------|------------|
| `x`, `y` | yes | Top-left corner of the letter in the atlas (from 1) |
| `width`, `height` | yes | Letter size in the atlas |
| `xoffset` | no | How far to shift the letter right when drawing |
| `yoffset` | no | How far to shift the letter down from the top of the line |
| `xadvance` | no | How far to step right after the letter. By default - `width` |

```lua
local atlas = Bloom.Texture.FromEditableImage(fontImage)
local pixelFont = Font.New(atlas, {
	A = { x = 1, y = 1, width = 5, height = 7, xadvance = 6 },
	B = { x = 7, y = 1, width = 5, height = 7, xadvance = 6 },
	[" "] = { x = 1, y = 1, width = 0, height = 0, xadvance = 4 },
	["?"] = { x = 13, y = 1, width = 5, height = 7, xadvance = 6 },
}, 8)
```

**All outcomes:**

- ✅ The font is created. Letter keys are turned into codes. If a key is a string of several letters, only the first one is used.
- ✅ `line_height` is rounded down.
- 🚫 The atlas is already destroyed - the error `Font.New expects a live texture atlas`.
- 🚫 `line_height` is 0 or less - the error `Font.New expects a positive line height`.
- 🔗 The atlas now **belongs** to the font: `font:Destroy()` destroys it too.

## Drawing text

### `canvas:DrawText(font, text, x, y, color?, scale?)`

**What it does:** writes text on the canvas.

| Name | Type | What it is |
|------|------|------------|
| `font` | `Font` | Which font |
| `text` | `string` | What to write (UTF-8) |
| `x`, `y` | `number` | Top-left corner of the text |
| `color` | `number?` | Color. White by default |
| `scale` | `number?` | Zoom. `2` - twice as big. `1` by default |

**Returns:** `width, height` - how much space the text took in pixels.

```lua
local w, h = canvas:DrawText(font, "Hello!\nSecond line", 10, 10, Color4.New32Bit(255, 220, 0), 2)
```

**All outcomes:**

- ✅ The text is drawn and blended with the background by transparency.
- ↩️ `\n` - a new line.
- ⇥ `\t` - an indent 4 spaces wide.
- ❓ The letter is not in the font - the replacement letter is drawn (`fallback`, `?` by default).
- 🙈 Neither the letter nor the replacement exists - the letter is skipped, with no space for it.
- 📏 Scaling enlarges letters with "nearest neighbor": with `scale = 2` every pixel becomes a 2 × 2 square.
- ✂️ Text past the edge of the canvas or the window is clipped.
- 0️⃣ The canvas or the font is destroyed - nothing is drawn, `0, 0` is returned.
- 🚫 `text` is not a string (for example a number) - the error `DrawText expects a string`. Use `tostring(number)`.
- 🚫 `scale` is 0 or less - the error `DrawText expects a positive scale`.
- 🚫 The string has broken UTF-8 - a Luau error from `utf8.codes`.

### `Font.MeasureText(font, text, scale?)`

**What it does:** finds out the text size **without drawing** it. The rules are the same as in `DrawText`.

**Returns:** `width, height`.

```lua
local w, h = Font.MeasureText(font, "Play", 2)
local x = math.floor((canvas.res_x - w) / 2) + 1
canvas:DrawText(font, "Play", x, 50, nil, 2)
```

This puts the text exactly in the center.

**All outcomes:**

- ✅ Returns the size. Height = number of lines × line height × scale.
- ℹ️ Width is counted by letter steps (`xadvance`), so it can be a pixel or two wider than the visible letters.

### `font:Destroy()`

**What it does:** destroys the font's atlas.

**All outcomes:** ✅ the atlas is destroyed, and `DrawText` with this font draws nothing anymore. 🔁 Calling it again is safe.

## Font fields

| Field | What it is |
|-------|------------|
| `font.texture` | The atlas |
| `font.glyphs` | Letters (code → glyph) |
| `font.line_height` | Line height |
| `font.spacing` | Extra space between letters |
| `font.fallback` | Code of the replacement letter |
| `font.destroyed` | `true` if the font is destroyed |

Next: [Task scheduler →](10-scheduler.md)
