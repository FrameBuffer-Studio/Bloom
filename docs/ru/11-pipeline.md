# Конвейер стадий

Представь конвейер на фабрике игрушек. Игрушка едет по ленте, и в нужных местах стоят рабочие: один красит, другой клеит, третий упаковывает.

В Bloom **кадр** едет по такому конвейеру, а **стадии** - это рабочие. Ты можешь поставить своего рабочего в нужное место и сделать что-нибудь в нужный момент.

```text
 BeginFrame ─► [beginFrame] ─► рисование ─► [beforeShader]→шейдер→[afterShader]
                                    │
 EndFrame ─► [endFrame] ─► [beforeUpload] ─► плитки ─► [tileUploaded]… ─► [afterUpload]
```

## Фазы

| Фаза | Когда запускается |
|------|-------------------|
| `"beginFrame"` | В `BeginFrame()`, после заливки |
| `"endFrame"` | В начале `EndFrame()` |
| `"beforeUpload"` | В начале `Update()` и `UpdateAsync()` |
| `"tileUploaded"` | После каждой плитки, отправленной через `UpdateAsync()` |
| `"afterUpload"` | Когда всё отправлено |
| `"beforeShader"` | Перед каждым `ApplyShader()` |
| `"afterShader"` | После каждого `ApplyShader()` |

## Функции

### `canvas:RegisterStage(name, callback, order?)`

**Что делает:** ставит на конвейер своего рабочего. Он будет вызываться **во всех** фазах, поэтому внутри проверь, какая фаза сейчас идёт.

| Имя | Тип | Что это |
|-----|-----|---------|
| `name` | `string` | Уникальное имя, не пустое |
| `callback` | `(canvas, phase) -> ()` | Что делать |
| `order` | `number?` | Порядок. Меньше - раньше. По умолчанию `100` |

```lua
canvas:RegisterStage("watermark", function(c, phase)
	if phase == "endFrame" then
		c:DrawText(font, "demo", c.res_x - 40, c.res_y - 14, Color4.New32Bit(255, 255, 255, 120))
	end
end, 50)
```

**Все исходы:**

- ✅ Стадия добавлена и включена.
- 🔁 Стадия с таким именем уже есть - она **заменяется** новой.
- 🔢 Стадии с одинаковым `order` идут по алфавиту имени.
- 🚫 Пустое имя или не строка - ошибка `Pipeline.Register expects a non-empty name`.
- 🚫 `callback` не функция - ошибка `Pipeline.Register expects a callback`.

### `canvas:RemoveStage(name)`

**Возвращает:** `true`, если стадия была и её убрали. `false`, если такой стадии нет.

### `canvas.pipeline:SetEnabled(name, enabled)`

**Что делает:** временно выключает или включает стадию, не удаляя её.

**Возвращает:** `true`, если стадия найдена, иначе `false`.

### `canvas.pipeline:Run(canvas, phase)`

**Что делает:** запускает все включённые стадии для любой фазы, даже для своей собственной.

```lua
canvas.pipeline:Run(canvas, "myCustomPhase")
```

## Что будет, если стадия сломается

- ✅ Остальные стадии **всё равно выполнятся**.
- ⚠️ В консоли появится `[Bloom.Pipeline] Stage 'имя' failed during 'фаза': текст ошибки`.
- ✅ Стадия может добавлять и удалять стадии прямо во время работы: конвейер идёт по снимку списка.

> [!CAUTION]
> Не вызывай `Update()`, `EndFrame()` или `UpdateAsync()` внутри стадий `beforeUpload`, `afterUpload` и `endFrame`. Получится бесконечный круг.

Дальше: [Статистика и скорость →](12-performance.md)
