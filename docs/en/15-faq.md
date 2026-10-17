# FAQ

## Why is nothing visible?

Check in order:

1. Did you call `canvas:Update()` or `canvas:EndFrame()`?
2. Did you pass both `parent` and `reference` to `Bloom.Create`?
3. Is `parent` visible on screen? For example, is the `ScreenGui` inside `PlayerGui`?
4. Is the code in a `LocalScript`, not in a `Script`?
5. Is the color not transparent? `Color4.New32Bit(255, 0, 0, 0)` has alpha 0, it is invisible.
6. Is the window not narrowed? Call `canvas:ResetViewport()`.

## Why does the picture update with a delay?

Roblox updates one `EditableImage` on screen per frame. If the canvas is cut into 4 tiles and all of them changed, a full update takes 4 frames. Make the canvas smaller or raise `tile_size` (maximum 1024) so there are fewer tiles.

## Why did a half-transparent rectangle make a "hole"?

`DrawRectangle` **replaces** pixels instead of mixing them. Draw a half-transparent texture with `DrawTexture` (it mixes) or mix yourself with `Color4.BlendOver`.

## Can I draw on the server?

You can: `EditableImage` can be created on the server too. But players **will not see** it, because it is not sent over the network. Draw on the client.

## Can I draw on a SurfaceGui (on a part in the world)?

Yes. Pass a `SurfaceGui` or a `Frame` inside it as `parent`. Remember that Bloom gives tiles a size in pixels (`UDim2.fromOffset`). Set `SurfaceGui.PixelsPerStud` or `SizingMode` so the picture has the size you need.

## How do I stretch the picture to the whole screen?

The canvas is always drawn pixel for pixel. To stretch it, put it into a `Frame` and use `UIScale`:

```lua
local scale = Instance.new("UIScale")
scale.Scale = 2
scale.Parent = frame
```

For crisp pixels set `ResampleMode = Enum.ResamplerMode.Pixelated` on `reference`.

## How many canvases can I create?

As many as memory allows. Every pixel takes 4 bytes, and twice: in the draft and in the `EditableImage`. A 1024 × 1024 canvas is about 8 MB. On phones keep no more than a couple of small canvases.

## How do I save the picture?

Take a copy of the buffer:

```lua
local copy = buffer.create(buffer.len(canvas:GetBuffer()))
buffer.copy(copy, 0, canvas:GetBuffer())
local snapshot = Bloom.Texture.New(canvas.res_x, canvas.res_y, copy, false)
```

Later you can draw it back with `canvas:DrawTexture(snapshot, 1, 1)`.

## How do I make a mouse painting app?

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

## Does Bloom use the graphics card?

No. Everything is computed on the processor in Luau. But Bloom has `--!native` and `--!optimize 2` turned on, so the code runs fast.

## Where are the tests?

In the `tests` folder. Run them:

```bash
rokit install
lune run tests/run
```

## Where can I read the documentation in a nice way?

Open the site from the `site` folder. There you can type the commands `/help`, `/canvas` and `/fn DrawLine`.

[← Back to the documentation map](README.md)
