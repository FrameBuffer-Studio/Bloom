# Stats and speed

## Counters

### `canvas:GetStats()`

**What it does:** gives you a **copy** of all counters of the canvas and its scheduler.

```lua
local stats = canvas:GetStats()
print(("Uploaded %d tiles, %.1f KB"):format(stats.uploaded_tiles, stats.uploaded_bytes / 1024))
```

| Field | What it counts |
|-------|----------------|
| `update_calls` | How many screen updates have finished |
| `last_update_seconds` | How long the last `Update()` took |
| `uploaded_tiles` | How many tiles were sent to the screen |
| `uploaded_bytes` | How many bytes were sent |
| `upload_seconds` | Total time spent sending |
| `shader_pixels` | How many pixels went through shaders |
| `texture_pixels` | How many pixels were drawn by textures and text |
| `text_glyphs` | How many letters were drawn |
| `scheduler_pending` | Tasks in the queue |
| `scheduler_active` | Tasks running now |
| `scheduler_completed` | Tasks done |
| `scheduler_failed` | Tasks failed |
| `scheduler_cancelled` | Tasks cancelled |
| `scheduler_last_step_seconds` | Length of the last scheduler step |
| `scheduler_max_step_seconds` | The longest scheduler step |

### `canvas:ResetStats()`

**What it does:** sets the canvas counters to zero.

**All outcomes:** ✅ the fields `update_calls` … `text_glyphs` become 0. ⚠️ The scheduler counters (`scheduler_*`) are **not** reset: they live in `canvas.async`.

## Rules for a fast game

| Rule | Why |
|------|-----|
| Keep the canvas small | Every pixel is processor work and memory. 512 × 512 is 4 times cheaper than 1024 × 1024 |
| Redraw only what changed | Bloom sends only dirty tiles to the screen |
| Use a smaller `tile_size` for big canvases where small pieces change | Then small tiles get dirty, not huge ones |
| Do not make tiles too small | Every tile is a separate `EditableImage` and a separate upload |
| Draw with rectangles and textures, not thousands of `DrawPixel` | One call that fills a whole row is faster than a thousand calls |
| Use `blend = false` for opaque textures | Mixing colors is expensive |
| Apply shaders to small pieces | A shader calls a function for **every** pixel |
| Create fonts, textures and shaders once | Creating is expensive, drawing is cheap |
| Use `UpdateAsync` for big updates | The work is spread over frames |
| Destroy unused canvases with `Destroy()` | Phones have little memory for `EditableImage` |

## Roblox limits

- One `EditableImage` is at most 1024 × 1024. Bloom cuts the canvas into tiles by itself.
- Only **one** `EditableImage` is updated on screen per frame. If there are many tiles, the picture updates one tile at a time.
- Phones have a strict memory limit for `EditableImage`. If it runs out, `Create` raises a memory budget error.
- In a published game you need to turn on **Allow Mesh / Image APIs** ([chapter 2](02-setup.md)).

## How to find what is slow

1. Open the **MicroProfiler** (Ctrl + F6) or the **Script Profiler** in Studio.
2. Compare `canvas:GetStats()` before and after the suspicious place.
3. If `shader_pixels` grows - make the shader smaller. If `uploaded_bytes` grows - you redraw too much.

Next: [All errors →](13-errors.md)
