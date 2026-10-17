# First picture

Let's draw a house with the sun. Here is what we will get:

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

## Step 1. Create a LocalScript

In **StarterPlayer → StarterPlayerScripts** create a `LocalScript` and name it `FirstPicture`. The `Bloom` library must be in `ReplicatedStorage` (see [Setup](02-setup.md)).

## Step 2. Load the library and colors

```lua
local Players = game:GetService("Players")
local Bloom = require(game.ReplicatedStorage.Bloom)
local Color4 = Bloom.GetColor4()
```

`Color4` is a box of pencils. `Color4.New32Bit(red, green, blue)` makes a color. Every number goes from 0 (none at all) to 255 (as much as possible).

```lua
local SKY = Color4.New32Bit(135, 206, 235)
local GRASS = Color4.New32Bit(60, 170, 70)
local WALL = Color4.New32Bit(230, 180, 120)
local ROOF = Color4.New32Bit(190, 60, 50)
local WINDOW = Color4.New32Bit(255, 255, 200)
local DOOR = Color4.New32Bit(110, 70, 40)
local SUN = Color4.New32Bit(255, 220, 0)
```

## Step 3. Make a place where the picture is visible

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

- `frame` is the picture frame. The picture appears inside it.
- `template` is a sample. Bloom copies it for every tile of the canvas. You do not need to put the sample anywhere.

## Step 4. Create the canvas

```lua
local canvas = Bloom.Create(Vector2.new(256, 192), frame, template)
```

Now you have a notebook 256 squares wide and 192 squares tall.

## Step 5. Draw!

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

What happens here:

1. `BeginFrame(SKY)` fills the whole sheet with blue sky.
2. `DrawRectangle(1, 160, 256, 192, GRASS)` - green grass at the bottom, from the left edge to the right edge.
3. Walls, a triangle roof, windows, a door.
4. The sun - a square and two soft lines as rays.
5. `EndFrame()` shows everything on screen.

## Step 6. Press Play

Press **Play** in Studio. A house appears in the top-left corner!

## If nothing appeared

| What you see | Why | What to do |
|--------------|-----|------------|
| An `Allow Mesh / Image APIs` error | The EditableImage permission is off | Turn it on following the [guide](02-setup.md) |
| No errors, but empty | You forgot `EndFrame()` or `Update()` | Add `canvas:EndFrame()` at the end |
| Empty and the frame is white | You did not pass `template` | Pass an `ImageLabel` as the third argument |
| An `attempt to index nil` error | The script is a regular `Script`, not a `LocalScript` | Use a `LocalScript` |
| Only a part is visible | The frame is smaller than the canvas, the rest is clipped | Make `frame.Size` equal to the canvas size |

## Full code

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

## Animation: drawing every frame

To make a picture move, you redraw it many times per second.

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
> Do not create the canvas inside `RenderStepped`! Create it once and only draw in the loop. Creating a canvas is expensive.

Next: [Canvas in detail →](04-canvas.md)
