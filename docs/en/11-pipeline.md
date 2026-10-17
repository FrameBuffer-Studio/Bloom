# Stage pipeline

Imagine a conveyor belt in a toy factory. A toy rides along the belt, and workers stand at the right spots: one paints, another glues, a third packs.

In Bloom the **frame** rides along such a belt, and the **stages** are the workers. You can put your own worker in the right spot and do something at the right moment.

```text
 BeginFrame ─► [beginFrame] ─► drawing ─► [beforeShader]→shader→[afterShader]
                                    │
 EndFrame ─► [endFrame] ─► [beforeUpload] ─► tiles ─► [tileUploaded]… ─► [afterUpload]
```

## Phases

| Phase | When it runs |
|-------|--------------|
| `"beginFrame"` | In `BeginFrame()`, after filling |
| `"endFrame"` | At the start of `EndFrame()` |
| `"beforeUpload"` | At the start of `Update()` and `UpdateAsync()` |
| `"tileUploaded"` | After every tile sent with `UpdateAsync()` |
| `"afterUpload"` | When everything is sent |
| `"beforeShader"` | Before every `ApplyShader()` |
| `"afterShader"` | After every `ApplyShader()` |

## Functions

### `canvas:RegisterStage(name, callback, order?)`

**What it does:** puts your own worker on the belt. It is called in **all** phases, so check inside which phase is happening now.

| Name | Type | What it is |
|------|------|------------|
| `name` | `string` | A unique, non-empty name |
| `callback` | `(canvas, phase) -> ()` | What to do |
| `order` | `number?` | Order. Lower runs earlier. `100` by default |

```lua
canvas:RegisterStage("watermark", function(c, phase)
	if phase == "endFrame" then
		c:DrawText(font, "demo", c.res_x - 40, c.res_y - 14, Color4.New32Bit(255, 255, 255, 120))
	end
end, 50)
```

**All outcomes:**

- ✅ The stage is added and enabled.
- 🔁 A stage with this name already exists - it is **replaced** by the new one.
- 🔢 Stages with the same `order` run in alphabetical order of their names.
- 🚫 An empty name or not a string - the error `Pipeline.Register expects a non-empty name`.
- 🚫 `callback` is not a function - the error `Pipeline.Register expects a callback`.

### `canvas:RemoveStage(name)`

**Returns:** `true` if the stage existed and was removed. `false` if there is no such stage.

### `canvas.pipeline:SetEnabled(name, enabled)`

**What it does:** temporarily turns a stage off or on without removing it.

**Returns:** `true` if the stage was found, otherwise `false`.

### `canvas.pipeline:Run(canvas, phase)`

**What it does:** runs all enabled stages for any phase, even your own.

```lua
canvas.pipeline:Run(canvas, "myCustomPhase")
```

## What happens if a stage breaks

- ✅ The other stages **still run**.
- ⚠️ The console shows `[Bloom.Pipeline] Stage 'name' failed during 'phase': error text`.
- ✅ A stage can add and remove stages while it runs: the pipeline walks a snapshot of the list.

> [!CAUTION]
> Do not call `Update()`, `EndFrame()` or `UpdateAsync()` inside the `beforeUpload`, `afterUpload` and `endFrame` stages. You get an endless loop.

Next: [Stats and speed →](12-performance.md)
