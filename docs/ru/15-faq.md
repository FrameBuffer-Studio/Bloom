# Частые вопросы

## Почему ничего не видно?

Проверь по порядку:

1. Ты вызвал `canvas:Update()` или `canvas:EndFrame()`?
2. Ты передал в `Bloom.Create` и `parent`, и `reference`?
3. `parent` виден на экране? Например, `ScreenGui` лежит в `PlayerGui`.
4. Код в `LocalScript`, а не в `Script`?
5. Цвет не прозрачный? У `Color4.New32Bit(255, 0, 0, 0)` альфа 0, его не видно.
6. Окошко не сужено? Вызови `canvas:ResetViewport()`.

## Почему картинка обновляется с задержкой?

Roblox обновляет на экране одну `EditableImage` за кадр. Если холст разрезан на 4 плитки и все они поменялись, полное обновление займёт 4 кадра. Сделай холст меньше или увеличь `tile_size` (максимум 1024), чтобы плиток было меньше.

## Почему полупрозрачный прямоугольник сделал «дырку»?

`DrawRectangle` **заменяет** пиксели, а не смешивает. Нарисуй полупрозрачную текстуру через `DrawTexture` (она смешивает) или смешивай сам через `Color4.BlendOver`.

## Можно ли рисовать на сервере?

Можно: `EditableImage` создаётся и на сервере. Но игроки её **не увидят**, потому что она не передаётся по сети. Рисуй на клиенте.

## Можно ли рисовать на SurfaceGui (на детали в мире)?

Да. Передай `SurfaceGui` или `Frame` внутри него как `parent`. Учти, что Bloom задаёт плиткам размер в пикселях (`UDim2.fromOffset`). Настрой `SurfaceGui.PixelsPerStud` или `SizingMode`, чтобы картинка была нужного размера.

## Как растянуть картинку на весь экран?

Холст всегда рисуется пиксель в пиксель. Чтобы растянуть его, положи его в `Frame` и используй `UIScale`:

```lua
local scale = Instance.new("UIScale")
scale.Scale = 2
scale.Parent = frame
```

Для резких пикселей поставь у `reference` свойство `ResampleMode = Enum.ResamplerMode.Pixelated`.

## Сколько холстов можно создать?

Сколько позволит память. Каждый пиксель занимает 4 байта, причём дважды: в черновике и в `EditableImage`. Холст 1024 × 1024 - это примерно 8 МБ. На телефонах лучше держать не больше пары небольших холстов.

## Как сохранить картинку?

Возьми копию буфера:

```lua
local copy = buffer.create(buffer.len(canvas:GetBuffer()))
buffer.copy(copy, 0, canvas:GetBuffer())
local snapshot = Bloom.Texture.New(canvas.res_x, canvas.res_y, copy, false)
```

Потом её можно нарисовать обратно через `canvas:DrawTexture(snapshot, 1, 1)`.

## Как сделать рисовалку мышкой?

```lua
local UserInputService = game:GetService("UserInputService")
local BRUSH = Color4.New32Bit(255, 80, 160)

local last: Vector2? = nil
UserInputService.InputChanged:Connect(function(input)
	if input.UserInputType ~= Enum.UserInputType.MouseMovement then
		return
	end
	if not UserInputService:IsMouseButtonPressed(Enum.UserInputType.MouseButton1) then
		last = nil
		return
	end

	local position = Vector2.new(input.Position.X, input.Position.Y) - frame.AbsolutePosition + Vector2.one
	if last then
		canvas:DrawLineAA(last.X, last.Y, position.X, position.Y, 4, BRUSH)
	end
	last = position
	canvas:Update()
end)
```

## Bloom использует видеокарту?

Нет. Всё считается на процессоре в Luau. Зато в Bloom включены `--!native` и `--!optimize 2`, поэтому код работает быстро.

## Где тесты?

В папке `tests`. Запуск:

```bash
rokit install
lune run tests/run
```

## Где посмотреть документацию красиво?

Открой сайт из папки `site`. Там можно набирать команды `/help`, `/canvas` и `/fn DrawLine`.

[← Вернуться к карте документации](README.md)
