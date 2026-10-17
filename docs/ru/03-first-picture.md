# Первая картинка

Давай нарисуем домик с солнышком. Вот что получится:

```text
 ┌──────────────────────────────┐
 │                         \|/  │
 │          /\            - ● - │
 │         /  \            /|\  │
 │        /    \                │
 │       ┌──────┐               │
 │       │ ▢  ▢ │               │
 │       │  ▯   │               │
 │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
 └──────────────────────────────┘
```

## Шаг 1. Создай LocalScript

В **StarterPlayer → StarterPlayerScripts** создай `LocalScript` и назови его `FirstPicture`. Библиотека `Bloom` должна лежать в `ReplicatedStorage` (смотри [Подготовку](02-setup.md)).

## Шаг 2. Подключи библиотеку и цвета

```lua
local Players = game:GetService("Players")
local Bloom = require(game.ReplicatedStorage.Bloom)
local Color4 = Bloom.GetColor4()
```

`Color4` - это коробка с карандашами. `Color4.New32Bit(красный, зелёный, синий)` делает цвет. Каждое число - от 0 (совсем нет) до 255 (очень много).

```lua
local SKY = Color4.New32Bit(135, 206, 235)
local GRASS = Color4.New32Bit(60, 170, 70)
local WALL = Color4.New32Bit(230, 180, 120)
local ROOF = Color4.New32Bit(190, 60, 50)
local WINDOW = Color4.New32Bit(255, 255, 200)
local DOOR = Color4.New32Bit(110, 70, 40)
local SUN = Color4.New32Bit(255, 220, 0)
```

## Шаг 3. Сделай место, где будет видно картинку

```lua
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "FirstPicture"
screenGui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local frame = Instance.new("Frame")
frame.Size = UDim2.fromOffset(256, 192)
frame.Position = UDim2.fromOffset(40, 40)
frame.Parent = screenGui

local template = Instance.new("ImageLabel")
template.BackgroundTransparency = 1
```

- `frame` - это рамка. Внутри неё появится картинка.
- `template` - это образец. Bloom скопирует его для каждой плитки холста. Сам образец никуда класть не надо.

## Шаг 4. Создай холст

```lua
local canvas = Bloom.Create(Vector2.new(256, 192), frame, template)
```

Теперь у тебя есть тетрадка шириной 256 клеточек и высотой 192 клеточки.

## Шаг 5. Рисуй!

```lua
canvas:BeginFrame(SKY)

canvas:DrawRectangle(1, 160, 256, 192, GRASS)

canvas:DrawRectangle(60, 100, 140, 160, WALL)
canvas:DrawTriangle(50, 100, 150, 100, 100, 55, ROOF)

canvas:DrawRectangle(72, 112, 90, 128, WINDOW)
canvas:DrawRectangle(110, 112, 128, 128, WINDOW)
canvas:DrawRectangle(92, 132, 108, 160, DOOR)

canvas:DrawRectangle(205, 20, 225, 40, SUN)
canvas:DrawLineAA(215, 5, 215, 55, 2, SUN)
canvas:DrawLineAA(190, 30, 240, 30, 2, SUN)

canvas:EndFrame()
```

Что здесь происходит:

1. `BeginFrame(SKY)` - заливаем весь лист голубым небом.
2. `DrawRectangle(1, 160, 256, 192, GRASS)` - зелёная трава внизу, от левого края до правого.
3. Стены, крыша-треугольник, окна, дверь.
4. Солнышко - квадрат и две мягкие линии-лучика.
5. `EndFrame()` - показываем всё на экране.

## Шаг 6. Нажми Play

Нажми **Play** в Studio. Слева сверху появится домик!

## Если ничего не появилось

| Что видишь | Почему так | Что сделать |
|------------|------------|-------------|
| Ошибка `Allow Mesh / Image APIs` | Выключено разрешение для EditableImage | Включи его по [инструкции](02-setup.md) |
| Ошибок нет, но пусто | Забыл `EndFrame()` или `Update()` | Добавь `canvas:EndFrame()` в конце |
| Пусто, а рамка белая | Ты не передал `template` | Передай третьим аргументом `ImageLabel` |
| Ошибка `attempt to index nil` | Скрипт - обычный `Script`, а не `LocalScript` | Используй `LocalScript` |
| Видно только кусочек | Рамка меньше холста, и лишнее обрезается | Сделай `frame.Size` равным размеру холста |

## Полный код

```lua
local Players = game:GetService("Players")
local Bloom = require(game.ReplicatedStorage.Bloom)
local Color4 = Bloom.GetColor4()

local SKY = Color4.New32Bit(135, 206, 235)
local GRASS = Color4.New32Bit(60, 170, 70)
local WALL = Color4.New32Bit(230, 180, 120)
local ROOF = Color4.New32Bit(190, 60, 50)
local WINDOW = Color4.New32Bit(255, 255, 200)
local DOOR = Color4.New32Bit(110, 70, 40)
local SUN = Color4.New32Bit(255, 220, 0)

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "FirstPicture"
screenGui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local frame = Instance.new("Frame")
frame.Size = UDim2.fromOffset(256, 192)
frame.Position = UDim2.fromOffset(40, 40)
frame.Parent = screenGui

local template = Instance.new("ImageLabel")
template.BackgroundTransparency = 1

local canvas = Bloom.Create(Vector2.new(256, 192), frame, template)

canvas:BeginFrame(SKY)
canvas:DrawRectangle(1, 160, 256, 192, GRASS)
canvas:DrawRectangle(60, 100, 140, 160, WALL)
canvas:DrawTriangle(50, 100, 150, 100, 100, 55, ROOF)
canvas:DrawRectangle(72, 112, 90, 128, WINDOW)
canvas:DrawRectangle(110, 112, 128, 128, WINDOW)
canvas:DrawRectangle(92, 132, 108, 160, DOOR)
canvas:DrawRectangle(205, 20, 225, 40, SUN)
canvas:DrawLineAA(215, 5, 215, 55, 2, SUN)
canvas:DrawLineAA(190, 30, 240, 30, 2, SUN)
canvas:EndFrame()

script.Destroying:Connect(function()
	canvas:Destroy()
end)
```

## Анимация: рисуем каждый кадр

Чтобы картинка двигалась, её нужно перерисовывать много раз в секунду.

```lua
local RunService = game:GetService("RunService")

local x = 1
RunService.RenderStepped:Connect(function()
	canvas:BeginFrame(SKY)
	canvas:DrawRectangle(x, 80, x + 20, 100, SUN)
	canvas:EndFrame()

	x = if x > 236 then 1 else x + 1
end)
```

> [!TIP]
> Не создавай холст внутри `RenderStepped`! Создай его один раз, а в цикле только рисуй. Создание холста - дорогая операция.

Дальше: [Холст подробно →](04-canvas.md)
