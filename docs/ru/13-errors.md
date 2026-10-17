# Все ошибки

Здесь собраны **все** сообщения, которые может показать Bloom. Найди своё (Ctrl + F) и прочитай, что делать.

Бывает два вида сообщений:

- 🚫 **Ошибка** (`error`) - скрипт останавливается. Её можно поймать через `pcall`.
- ⚠️ **Предупреждение** (`warn`) - скрипт работает дальше, а в консоли появляется жёлтая строчка.

## Настройки игры и память

| Сообщение | Вид | Почему | Что делать |
|-----------|-----|--------|------------|
| `Bloom: EditableImage is not available in this experience. ...Allow Mesh / Image APIs...` | 🚫 | Выключено разрешение для EditableImage, или Roblox запретил создание или запись картинки | Включи **Allow Mesh / Image APIs** ([глава 2](02-setup.md)). В скобках в конце - точный текст ошибки Roblox |
| `Bloom: EditableImage memory budget is exhausted on this device; ...` | 🚫 | Проверка не смогла создать даже картинку 1 × 1 | Удали ненужные холсты и `EditableImage`, сделай холст меньше |
| `Bloom: EditableImage memory budget is exhausted (ШxВ tile)` | 🚫 | Памяти не хватило на очередную плитку | То же самое. Уже созданные плитки Bloom удалил сам |
| `Texture.FromContent: EditableImage memory budget is exhausted` | 🚫 | Не хватило памяти, чтобы загрузить картинку | Освободи память, загружай картинки поменьше |

## Холст

| Сообщение | Вид | Почему | Что делать |
|-----------|-----|--------|------------|
| `Bloom.Create expects a positive resolution` | 🚫 | Ширина или высота меньше 1 | Передай, например, `Vector2.new(256, 256)` |
| `Bloom.Resize expects a positive resolution` | 🚫 | То же самое в `Resize` | Передай размер от 1 и больше |
| `Bloom.FromEditableImage expects a positive resolution` | 🚫 | Картинка нулевого размера | Создай картинку нормального размера |
| `Bloom.FromEditableImage supports images up to 1024x1024` | 🚫 | Картинка слишком большая | Возьми картинку до 1024 × 1024 или используй `Bloom.Create` |
| `Resize is not supported for contexts created with FromEditableImage` | 🚫 | Чужую картинку нельзя пересоздать | Создай новую `EditableImage` и новый холст |
| `[Bloom] Failed to upload tile N: ...` | ⚠️ | Roblox не принял пиксели плитки | Обычно это значит, что `EditableImage` удалили снаружи или отозвали разрешение. Плитка попробует отправиться снова |

## Текстуры

| Сообщение | Вид | Почему | Что делать |
|-----------|-----|--------|------------|
| `Texture.New expects positive dimensions` | 🚫 | Ширина или высота меньше 1 | Проверь размеры |
| `Texture.New expects width * height * 4 RGBA bytes` | 🚫 | Буфер не того размера | Создай `buffer.create(width * height * 4)` |
| `Cannot draw a destroyed Texture` | 🚫 | Текстуру удалили, а потом попробовали нарисовать | Не вызывай `Destroy()` раньше времени |

## Шейдеры

| Сообщение | Вид | Почему | Что делать |
|-----------|-----|--------|------------|
| `Shader.New expects a name` | 🚫 | Имя не строка или пустое | Передай имя, например `"Glow"` |
| `Shader.New expects a callback` | 🚫 | Вторым аргументом передана не функция | Передай функцию `function(x, y, u, v, color32, uniforms) ... end` |

## Шрифты

| Сообщение | Вид | Почему | Что делать |
|-----------|-----|--------|------------|
| `Font.FromString expects a non-empty binary font string` | 🚫 | Передана не строка или пустая строка | Передай байты `.ttf` |
| `Font.FromBuffer expects a non-empty binary font buffer` | 🚫 | Буфер пустой или очень маленький | Проверь, что файл загрузился |
| `Font.FromBuffer pixel_size must be between 4 and 128` | 🚫 | Размер букв вне пределов | Выбери размер от 4 до 128 |
| `Font supports TrueType-outline TTF files only; CFF/WOFF/WOFF2 are not supported` | 🚫 | Это не `.ttf`, или ты передал Base64 вместо байтов | Сконвертируй шрифт в TTF. Base64 сначала раскодируй |
| `TTF is missing a required TrueType table` | 🚫 | Шрифт неполный | Возьми другой файл шрифта |
| `TTF has no supported Unicode cmap (format 4 or 12)` | 🚫 | В шрифте нет таблицы Unicode | Пересохрани шрифт в FontForge |
| `Invalid or truncated TrueType font: ...` | 🚫 | Файл обрезан или испорчен | Скачай файл заново. Проверь, что строка не испортилась при копировании |
| `Invalid TrueType metrics` | 🚫 | Неправильные размеры в шрифте | Возьми другой шрифт |
| `Font atlas is too large; reduce pixel_size or the charset` | 🚫 | Атлас с буквами вышел больше 1024 × 1024 пикселей | Уменьши `pixel_size` или оставь в `charset` меньше букв |
| `Font.New expects a live texture atlas` | 🚫 | Атлас уже удалён | Создай атлас заново |
| `Font.New expects a positive line height` | 🚫 | Высота строки 0 или меньше | Передай высоту строки, например `8` |
| `DrawText expects a string` | 🚫 | Передано не строка | Используй `tostring(value)` |
| `DrawText expects a positive scale` | 🚫 | Масштаб 0 или меньше | Передай масштаб, например `1` или `2` |

## Планировщик и конвейер

| Сообщение | Вид | Почему | Что делать |
|-----------|-----|--------|------------|
| `Async.Submit expects a function` | 🚫 | Передана не функция | Передай функцию |
| `Async.Yield must be called from inside a scheduler task` | 🚫 | `Yield()` вызван вне задачи | Вызывай его только внутри функции из `Submit` |
| `[Bloom.Async] Task failed: ...` | ⚠️ | Внутри задачи случилась ошибка | Прочитай текст после двоеточия, он же лежит в `job.error` |
| `[Bloom.Async] Task failed: Task yielded outside Async.Yield(); ...` | ⚠️ | Внутри задачи был `task.wait`, `wait` или `WaitForChild` | Убери ожидания Roblox, используй `Bloom.Async.Yield()` |
| `[Bloom.Async] Task failed: Missing task coroutine` | ⚠️ | Задача повреждена (так бывает, только если менять её поля руками) | Не меняй поля задачи |
| `Pipeline.Register expects a non-empty name` | 🚫 | Пустое имя стадии | Дай стадии имя |
| `Pipeline.Register expects a callback` | 🚫 | Передана не функция | Передай функцию `(canvas, phase) -> ()` |
| `[Bloom.Pipeline] Stage 'X' failed during 'Y': ...` | ⚠️ | Стадия X упала в фазе Y | Исправь код стадии. Остальные стадии работают |

## Ошибки Luau (не от Bloom, но рядом)

| Сообщение | Почему | Что делать |
|-----------|--------|------------|
| `buffer access out of bounds` | `DrawPixelUnsafe`, `ReadPixelUnsafe` или запись в `GetBuffer()` за пределами | Проверь координаты или используй безопасные функции |
| `invalid UTF-8 code` | В тексте для `DrawText` сломанный UTF-8 | Проверь строку |
| `attempt to index nil with ...` | Обычно Bloom не нашёл модуль или ты вызвал функцию через точку вместо двоеточия | Проверь имена модулей и пиши `canvas:DrawLine(...)`, а не `canvas.DrawLine(...)` |

## Как поймать ошибку

```lua
local ok, result = pcall(Bloom.Create, Vector2.new(256, 256), frame, template)
if ok then
	local canvas = result
	canvas:Clear(Color4.New32Bit(0, 0, 0))
	canvas:Update()
else
	warn("Не получилось создать холст: " .. tostring(result))
end
```

Дальше: [Типы →](14-types.md)
