# Типы

Bloom написан в режиме `--!strict`. Если ты тоже пишешь в строгом режиме, Luau подскажет ошибки ещё **до** запуска игры: например, если передать строку вместо числа.

> [!NOTE]
> Типы проверяются только пока ты пишешь код (в Studio или luau-lsp). Во время игры их нет. Поэтому настоящие проверки (`assert`) Bloom делает сам.

## Типы из главного модуля

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

| Тип | Что это |
|-----|---------|
| `Bloom` | Холст |
| `Options` | Настройки `Bloom.Create`: `tile_size`, `async_budget`, `scheduler_options`, `auto_clip`, `clear_color` |
| `Stats` | Результат `GetStats()` |
| `Task` | Задача планировщика |
| `SupportReport` | Результат `CheckSupport()`: `supported`, `status`, `message`, `details` |
| `TextureDrawOptions` | Настройки `DrawTexture` |
| `FontOptions` | `spacing`, `fallback` |
| `SchedulerOptions` | `poll_interval`, `aging_interval`, `max_tasks_per_step` |
| `SubmitOptions` | `priority`, `deadline` |
| `UniformMap` | Настройки шейдера: таблица `{ [string]: значение }`, где значение - число, строка, `boolean`, `Vector2`, `Color3` и другие типы Roblox |

## Пример

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

## Типы цвета

Цвет - это обычный `number`. В исходниках у него есть имя `PackedColor`, но это просто `number`.

`Color4.New` возвращает объект типа `Color4.Color4`, у которого есть поля `R`, `G`, `B`, `A` и методы `To32Bit` и `Lerp`.

## Ошибки типов, которые часто встречаются

| Что пишет Luau | Почему | Как исправить |
|----------------|---------|---------------|
| `Type 'string' could not be converted into 'number'` | Передал строку вместо числа | `tonumber(x)` |
| `Key 'tilesize' not found in table 'BloomOptions'` | Опечатка в имени настройки | `tile_size` |
| `Value of type 'Vector2?' could be nil` | Передал значение, которое может оказаться `nil` | Проверь его на `nil` перед вызовом |

Дальше: [Частые вопросы →](15-faq.md)
