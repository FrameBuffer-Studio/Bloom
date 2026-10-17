# Types

Bloom is written in `--!strict` mode. If you also write in strict mode, Luau points out mistakes **before** the game starts: for example, if you pass a string instead of a number.

> [!NOTE]
> Types are checked only while you write code (in Studio or luau-lsp). They do not exist while the game runs. That is why Bloom does real checks (`assert`) by itself.

## Types from the main module

```lua
local Bloom = require(game.ReplicatedStorage.Bloom)

type Bloom = Bloom.Bloom
type Options = Bloom.Options
type Stats = Bloom.Stats
type Task = Bloom.Task
type SupportReport = Bloom.SupportReport
type TextureDrawOptions = Bloom.TextureDrawOptions
type FontOptions = Bloom.FontOptions
type SchedulerOptions = Bloom.SchedulerOptions
type SubmitOptions = Bloom.SubmitOptions
type UniformMap = Bloom.UniformMap
```

| Type | What it is |
|------|------------|
| `Bloom` | A canvas |
| `Options` | `Bloom.Create` settings: `tile_size`, `async_budget`, `scheduler_options`, `auto_clip`, `clear_color` |
| `Stats` | The result of `GetStats()` |
| `Task` | A scheduler task |
| `SupportReport` | The result of `CheckSupport()`: `supported`, `status`, `message`, `details` |
| `TextureDrawOptions` | `DrawTexture` settings |
| `FontOptions` | `spacing`, `fallback` |
| `SchedulerOptions` | `poll_interval`, `aging_interval`, `max_tasks_per_step` |
| `SubmitOptions` | `priority`, `deadline` |
| `UniformMap` | Shader settings: a table `{ [string]: value }`, where a value is a number, a string, a `boolean`, a `Vector2`, a `Color3` and other Roblox types |

## Example

```lua
--!strict
local Bloom = require(game.ReplicatedStorage.Bloom)

local options: Bloom.Options = {
	tile_size = 512,
	clear_color = Bloom.GetColor4().New32Bit(0, 0, 0),
}

local canvas: Bloom.Bloom = Bloom.Create(Vector2.new(512, 512), frame, template, options)

local function drawHud(target: Bloom.Bloom, health: number): ()
	target:DrawRectangle(1, 1, math.floor(health), 8, 0xFF0000FF)
end
```

## Color types

A color is a regular `number`. In the source code it has the name `PackedColor`, but it is just a `number`.

`Color4.New` returns an object of type `Color4.Color4`, which has the fields `R`, `G`, `B`, `A` and the methods `To32Bit` and `Lerp`.

## Common type errors

| What Luau says | Why | How to fix |
|----------------|-----|------------|
| `Type 'string' could not be converted into 'number'` | You passed a string instead of a number | `tonumber(x)` |
| `Key 'tilesize' not found in table 'BloomOptions'` | A typo in a setting name | `tile_size` |
| `Value of type 'Vector2?' could be nil` | You passed a value that may be `nil` | Check it for `nil` before the call |

Next: [FAQ →](15-faq.md)
