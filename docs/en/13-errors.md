# All errors

Here are **all** messages Bloom can show. Find yours (Ctrl + F) and read what to do.

There are two kinds of messages:

- 🚫 **Error** (`error`) - the script stops. You can catch it with `pcall`.
- ⚠️ **Warning** (`warn`) - the script keeps working, and a yellow line appears in the console.

## Game settings and memory

| Message | Kind | Why | What to do |
|---------|------|-----|------------|
| `Bloom: EditableImage is not available in this experience. ...Allow Mesh / Image APIs...` | 🚫 | The EditableImage permission is off, or Roblox refused to create or write the image | Turn on **Allow Mesh / Image APIs** ([chapter 2](02-setup.md)). The brackets at the end hold the exact Roblox error |
| `Bloom: EditableImage memory budget is exhausted on this device; ...` | 🚫 | The check could not create even a 1 × 1 image | Destroy unused canvases and `EditableImage` objects, make the canvas smaller |
| `Bloom: EditableImage memory budget is exhausted (WxH tile)` | 🚫 | Not enough memory for the next tile | The same. Bloom already deleted the tiles it created |
| `Texture.FromContent: EditableImage memory budget is exhausted` | 🚫 | Not enough memory to load the picture | Free memory, load smaller pictures |

## Canvas

| Message | Kind | Why | What to do |
|---------|------|-----|------------|
| `Bloom.Create expects a positive resolution` | 🚫 | Width or height is less than 1 | Pass, for example, `Vector2.new(256, 256)` |
| `Bloom.Resize expects a positive resolution` | 🚫 | The same in `Resize` | Pass a size of 1 or more |
| `Bloom.FromEditableImage expects a positive resolution` | 🚫 | The image has zero size | Create an image of a normal size |
| `Bloom.FromEditableImage supports images up to 1024x1024` | 🚫 | The image is too big | Use an image up to 1024 × 1024 or use `Bloom.Create` |
| `Resize is not supported for contexts created with FromEditableImage` | 🚫 | Someone else's image cannot be recreated | Create a new `EditableImage` and a new canvas |
| `[Bloom] Failed to upload tile N: ...` | ⚠️ | Roblox did not accept the tile's pixels | Usually the `EditableImage` was destroyed from outside or the permission was revoked. The tile tries again |

## Textures

| Message | Kind | Why | What to do |
|---------|------|-----|------------|
| `Texture.New expects positive dimensions` | 🚫 | Width or height is less than 1 | Check the sizes |
| `Texture.New expects width * height * 4 RGBA bytes` | 🚫 | The buffer has the wrong size | Create `buffer.create(width * height * 4)` |
| `Cannot draw a destroyed Texture` | 🚫 | The texture was destroyed and then drawn | Do not call `Destroy()` too early |

## Shaders

| Message | Kind | Why | What to do |
|---------|------|-----|------------|
| `Shader.New expects a name` | 🚫 | The name is not a string or is empty | Pass a name, for example `"Glow"` |
| `Shader.New expects a callback` | 🚫 | The second argument is not a function | Pass a function `function(x, y, u, v, color32, uniforms) ... end` |

## Fonts

| Message | Kind | Why | What to do |
|---------|------|-----|------------|
| `Font.FromString expects a non-empty binary font string` | 🚫 | Not a string or an empty string | Pass the `.ttf` bytes |
| `Font.FromBuffer expects a non-empty binary font buffer` | 🚫 | The buffer is empty or very small | Check that the file loaded |
| `Font.FromBuffer pixel_size must be between 4 and 128` | 🚫 | Letter size out of limits | Pick a size from 4 to 128 |
| `Font supports TrueType-outline TTF files only; CFF/WOFF/WOFF2 are not supported` | 🚫 | It is not a `.ttf`, or you passed Base64 instead of bytes | Convert the font to TTF. Decode Base64 first |
| `TTF is missing a required TrueType table` | 🚫 | The font is incomplete | Use another font file |
| `TTF has no supported Unicode cmap (format 4 or 12)` | 🚫 | The font has no Unicode table | Re-save the font in FontForge |
| `Invalid or truncated TrueType font: ...` | 🚫 | The file is cut or broken | Download the file again. Check the string was not damaged while copying |
| `Invalid TrueType metrics` | 🚫 | Wrong sizes inside the font | Use another font |
| `Font atlas is too large; reduce pixel_size or the charset` | 🚫 | The letter atlas came out bigger than 1024 × 1024 pixels | Lower `pixel_size` or keep fewer letters in `charset` |
| `Font.New expects a live texture atlas` | 🚫 | The atlas is already destroyed | Create the atlas again |
| `Font.New expects a positive line height` | 🚫 | Line height is 0 or less | Pass a line height, for example `8` |
| `DrawText expects a string` | 🚫 | Not a string was passed | Use `tostring(value)` |
| `DrawText expects a positive scale` | 🚫 | Scale is 0 or less | Pass a scale, for example `1` or `2` |

## Scheduler and pipeline

| Message | Kind | Why | What to do |
|---------|------|-----|------------|
| `Async.Submit expects a function` | 🚫 | Not a function was passed | Pass a function |
| `Async.Yield must be called from inside a scheduler task` | 🚫 | `Yield()` was called outside a task | Call it only inside a function from `Submit` |
| `[Bloom.Async] Task failed: ...` | ⚠️ | An error happened inside a task | Read the text after the colon, it is also in `job.error` |
| `[Bloom.Async] Task failed: Task yielded outside Async.Yield(); ...` | ⚠️ | The task used `task.wait`, `wait` or `WaitForChild` | Remove Roblox waits, use `Bloom.Async.Yield()` |
| `[Bloom.Async] Task failed: Missing task coroutine` | ⚠️ | The task is damaged (only happens if you change its fields by hand) | Do not change task fields |
| `Pipeline.Register expects a non-empty name` | 🚫 | Empty stage name | Give the stage a name |
| `Pipeline.Register expects a callback` | 🚫 | Not a function was passed | Pass a function `(canvas, phase) -> ()` |
| `[Bloom.Pipeline] Stage 'X' failed during 'Y': ...` | ⚠️ | Stage X failed in phase Y | Fix the stage code. Other stages keep working |

## Luau errors (not from Bloom, but nearby)

| Message | Why | What to do |
|---------|-----|------------|
| `buffer access out of bounds` | `DrawPixelUnsafe`, `ReadPixelUnsafe` or a write into `GetBuffer()` outside the limits | Check the coordinates or use the safe functions |
| `invalid UTF-8 code` | Broken UTF-8 in the text for `DrawText` | Check the string |
| `attempt to index nil with ...` | Usually Bloom did not find a module, or you called a function with a dot instead of a colon | Check module names and write `canvas:DrawLine(...)`, not `canvas.DrawLine(...)` |

## How to catch an error

```lua
local ok, result = pcall(Bloom.Create, Vector2.new(256, 256), frame, template)
if ok then
	local canvas = result
	canvas:Clear(Color4.New32Bit(0, 0, 0))
	canvas:Update()
else
	warn("Could not create the canvas: " .. tostring(result))
end
```

Next: [Types →](14-types.md)
