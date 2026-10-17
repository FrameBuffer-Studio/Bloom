# Setup and check

Before drawing you need to do three things:

1. Put the library into the game.
2. Allow the game to use `EditableImage`.
3. Check that everything works.

## Step 1. Put the library into the game

Bloom is the `src` folder. In Roblox it must become one `ModuleScript` named `Bloom`, with other modules inside it.

```text
ReplicatedStorage
└── Bloom            (ModuleScript, code from src/init.luau)
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

### Option A: with Rojo (easy)

Rojo turns the `src` folder into these modules for you. In your Rojo project file, set `"$path": "src"` for the `Bloom` object inside `ReplicatedStorage`.

### Option B: by hand

1. Create a `ModuleScript` named `Bloom` in `ReplicatedStorage` and paste the code from `src/init.luau`.
2. Inside `Bloom`, create the modules from the list above and paste each file's code into it.
3. Inside `elements`, create the modules `line`, `pixel`, `rect` and `triangle`.

> [!WARNING]
> Names must match **exactly**, in lowercase. Bloom finds modules by name: `require("@self/types")` means "my child module named `types`". If you name the module `Types` with a capital letter, you get a "module not found" error.

## Step 2. Allow EditableImage

By default Roblox **forbids** published games from changing images from code. This protects players. You only need to turn the permission on once.

### In Roblox Studio

1. Open **File → Experience Settings**.
2. Choose **Security** on the left.
3. Turn on **Allow Mesh / Image APIs**.
4. Press **Save**.

### For a published game

1. Open the [Creator Dashboard](https://create.roblox.com/dashboard/creations).
2. Choose your game → **Configure** → **Settings**.
3. Turn on **Enable Mesh / Image APIs**.

> [!NOTE]
> This toggle is only available to accounts that are 13+ and have passed ID verification. If the toggle is grey, the account is not verified yet.

## Step 3. Check that everything works

Bloom has a built-in check. It creates a tiny 1 × 1 image, tries to write a pixel into it and read it back, and then deletes it right away. If something fails, Bloom tells you what exactly.

`Bloom.Create` runs this check **by itself**. If `EditableImage` is disabled, you will see a clear error that tells you which toggle to turn on. You can also run the check in advance, for example to show the player a message instead of an error.

### `Bloom.CheckSupport()`

**What it does:** checks whether this game can use `EditableImage` right now. No canvas is created.

**Arguments:** none.

**Returns:** a report table (it is frozen, you cannot change it):

| Field | Type | Meaning |
|-------|------|---------|
| `supported` | `boolean` | `true` - everything works, you can draw |
| `status` | `string` | `"supported"`, `"disabled"` or `"out_of_memory"` |
| `message` | `string` | An explanation of what happened and what to do |
| `details` | `string?` | The exact Roblox error text, if there was one |

**Example:**

```lua
local Bloom = require(game.ReplicatedStorage.Bloom)

local report = Bloom.CheckSupport()
if report.supported then
	print("Ready to draw!")
elseif report.status == "disabled" then
	warn("Turn on Allow Mesh / Image APIs in the game settings")
	warn(report.details)
elseif report.status == "out_of_memory" then
	warn("This device is out of image memory")
end
```

**All outcomes:**

- ✅ **`status = "supported"`** - the image was created, written and read. This answer is **remembered**: next calls return it right away without a new check.
- 🚫 **`status = "disabled"`** - Roblox raised an error while creating, writing or reading the image. Almost always this means the **Allow Mesh / Image APIs** toggle is off. `details` holds the exact Roblox error text. This answer is **not remembered**: turn the toggle on and the next check will pass.
- 🧠 **`status = "out_of_memory"`** - Roblox returned `nil` instead of an image. This happens when the device (usually a weak phone) is out of image memory. Delete unneeded `EditableImage` objects and check again. This answer is **not remembered** either.
- 🧪 The test image is always deleted, so the check does not waste memory.

### `Bloom.IsSupported()`

**What it does:** the same as `CheckSupport`, but answers just "yes" or "no".

**Returns:** `boolean` - `true` if `EditableImage` works.

```lua
if not Bloom.IsSupported() then
	return
end
```

**All outcomes:**

- ✅ `true` - you can draw.
- 🚫 `false` - you cannot. `Bloom.CheckSupport().status` shows why.

### `Bloom.Support.Assert()`

**What it does:** runs the check and, if something is wrong, **stops the script with an error** that has a clear text. `Bloom.Create` calls it by itself.

**All outcomes:**

- ✅ Everything works - the function does nothing and the script continues.
- 🚫 `EditableImage` is disabled - an error like `Bloom: EditableImage is not available in this experience. In Studio open File > Experience Settings > Security and enable 'Allow Mesh / Image APIs'. ... (Roblox error text)`.
- 🧠 Not enough memory - the error `Bloom: EditableImage memory budget is exhausted on this device; ...`.

## All together: a safe start

```lua
local Players = game:GetService("Players")
local Bloom = require(game.ReplicatedStorage.Bloom)

local report = Bloom.CheckSupport()
if not report.supported then
	warn("[My game] Drawing is unavailable: " .. report.status)
	return
end

local screenGui = Instance.new("ScreenGui")
screenGui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local template = Instance.new("ImageLabel")
template.BackgroundTransparency = 1

local canvas = Bloom.Create(Vector2.new(256, 256), screenGui, template)
```

Next: [First picture →](03-first-picture.md)
