# Подготовка и проверка

Прежде чем рисовать, нужно сделать три дела:

1. Положить библиотеку в игру.
2. Разрешить игре пользоваться `EditableImage`.
3. Проверить, что всё работает.

## Шаг 1. Кладём библиотеку в игру

Bloom - это папка `src`. В Roblox она должна превратиться в один `ModuleScript` с именем `Bloom`, а внутри у него должны лежать другие модули.

```text
ReplicatedStorage
└── Bloom            (ModuleScript, код из src/init.luau)
    ├── async        (ModuleScript, src/async.luau)
    ├── color4       (ModuleScript, src/color4.luau)
    ├── font         (ModuleScript, src/font.luau)
    ├── pipeline     (ModuleScript, src/pipeline.luau)
    ├── shader       (ModuleScript, src/shader.luau)
    ├── support      (ModuleScript, src/support.luau)
    ├── texture      (ModuleScript, src/texture.luau)
    ├── types        (ModuleScript, src/types.luau)
    └── elements     (ModuleScript, src/elements/init.luau)
        ├── line     (ModuleScript, src/elements/line.luau)
        ├── pixel    (ModuleScript, src/elements/pixel.luau)
        ├── rect     (ModuleScript, src/elements/rect.luau)
        └── triangle (ModuleScript, src/elements/triangle.luau)
```

### Способ А: через Rojo (удобно)

Rojo сам превратит папку `src` в такие модули. В файле проекта Rojo укажи `"$path": "src"` для объекта `Bloom` внутри `ReplicatedStorage`.

### Способ Б: руками

1. Создай `ModuleScript` с именем `Bloom` в `ReplicatedStorage` и вставь в него код из `src/init.luau`.
2. Внутри `Bloom` создай модули из списка выше и вставь в каждый код из его файла.
3. Внутри `elements` создай модули `line`, `pixel`, `rect` и `triangle`.

> [!WARNING]
> Имена должны совпадать **точно**, маленькими буквами. Bloom ищет модули по именам: `require("@self/types")` означает «мой дочерний модуль с именем `types`». Если назвать модуль `Types` с большой буквы, будет ошибка «модуль не найден».

## Шаг 2. Разрешаем EditableImage

Roblox по умолчанию **запрещает** опубликованным играм менять картинки из кода. Так он защищает игроков. Это разрешение нужно включить один раз.

### В Roblox Studio

1. Открой **File → Experience Settings** (Файл → Настройки игры).
2. Слева выбери **Security** (Безопасность).
3. Включи переключатель **Allow Mesh / Image APIs**.
4. Нажми **Save**.

### Для опубликованной игры

1. Открой [Creator Dashboard](https://create.roblox.com/dashboard/creations).
2. Выбери свою игру → **Configure** → **Settings**.
3. Включи **Enable Mesh / Image APIs**.

> [!NOTE]
> Этот переключатель доступен только аккаунтам старше 13 лет, которые прошли проверку документа (ID verification). Если переключатель серый, значит аккаунт ещё не проверен.

## Шаг 3. Проверяем, что всё работает

У Bloom есть встроенная проверка. Она создаёт крошечную картинку 1 × 1, пробует записать в неё пиксель и прочитать его обратно, а потом сразу удаляет. Если что-то не получилось, Bloom скажет, что именно.

`Bloom.Create` делает эту проверку **сам**. Если `EditableImage` выключен, ты увидишь понятную ошибку с подсказкой, какой переключатель включить. Но проверку можно вызвать и заранее: например, чтобы показать игроку сообщение вместо ошибки.

### `Bloom.CheckSupport()`

**Что делает:** проверяет, можно ли в этой игре прямо сейчас пользоваться `EditableImage`. Холст при этом не создаётся.

**Аргументы:** нет.

**Возвращает:** табличку-отчёт (она заморожена, менять её нельзя):

| Поле | Тип | Что значит |
|------|-----|------------|
| `supported` | `boolean` | `true` - всё работает, можно рисовать |
| `status` | `string` | `"supported"`, `"disabled"` или `"out_of_memory"` |
| `message` | `string` | Объяснение на английском, что случилось и что делать |
| `details` | `string?` | Точный текст ошибки от Roblox, если она была |

**Пример:**

```lua
local Bloom = require(game.ReplicatedStorage.Bloom)

local report = Bloom.CheckSupport()
if report.supported then
	print("Можно рисовать!")
elseif report.status == "disabled" then
	warn("Включи Allow Mesh / Image APIs в настройках игры")
	warn(report.details)
elseif report.status == "out_of_memory" then
	warn("На этом устройстве закончилась память для картинок")
end
```

**Все исходы:**

- ✅ **`status = "supported"`** - картинку удалось создать, записать и прочитать. Этот ответ **запоминается**: следующие вызовы сразу вернут его без новой проверки.
- 🚫 **`status = "disabled"`** - Roblox выдал ошибку при создании, записи или чтении картинки. Почти всегда это значит, что выключен переключатель **Allow Mesh / Image APIs**. В `details` лежит точный текст ошибки от Roblox. Этот ответ **не запоминается**: включи переключатель, и следующая проверка пройдёт.
- 🧠 **`status = "out_of_memory"`** - Roblox вернул `nil` вместо картинки. Так бывает, когда у устройства (обычно у слабого телефона) закончилась память для картинок. Удали ненужные `EditableImage` и проверь снова. Этот ответ тоже **не запоминается**.
- 🧪 Пробная картинка удаляется в любом случае, поэтому проверка не тратит память.

### `Bloom.IsSupported()`

**Что делает:** то же самое, что `CheckSupport`, но отвечает просто «да» или «нет».

**Возвращает:** `boolean` - `true`, если `EditableImage` работает.

```lua
if not Bloom.IsSupported() then
	return -- тихо выходим, ничего не рисуем
end
```

**Все исходы:**

- ✅ `true` - можно рисовать.
- 🚫 `false` - нельзя. Причину покажет `Bloom.CheckSupport().status`.

### `Bloom.Support.Assert()`

**Что делает:** проверяет поддержку и, если что-то не так, **останавливает скрипт ошибкой** с понятным текстом. `Bloom.Create` вызывает её сам.

**Все исходы:**

- ✅ Всё работает - функция ничего не делает, и скрипт идёт дальше.
- 🚫 `EditableImage` выключен - ошибка вида `Bloom: EditableImage is not available in this experience. In Studio open File > Experience Settings > Security and enable 'Allow Mesh / Image APIs'. ... (текст ошибки Roblox)`.
- 🧠 Мало памяти - ошибка `Bloom: EditableImage memory budget is exhausted on this device; ...`.

## Всё вместе: безопасный старт

```lua
local Players = game:GetService("Players")
local Bloom = require(game.ReplicatedStorage.Bloom)

local report = Bloom.CheckSupport()
if not report.supported then
	warn("[Моя игра] Рисование недоступно: " .. report.status)
	return
end

local screenGui = Instance.new("ScreenGui")
screenGui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local template = Instance.new("ImageLabel")
template.BackgroundTransparency = 1

local canvas = Bloom.Create(Vector2.new(256, 256), screenGui, template)
```

Дальше: [Первая картинка →](03-first-picture.md)
