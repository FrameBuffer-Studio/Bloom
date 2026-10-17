local Bloom = require(path.to.Bloom)
local Color4 = Bloom.GetColor4()

local texture = Bloom.Texture.FromEditableImage(editableImage)
canvas:DrawTexture(texture, 20, 20, 128, 128, {
	tint = Color4.New32Bit(255, 220, 220, 255),
	opacity = 0.9,
	blend = true,
})

-- Release the CPU-side texture when it is no longer needed.
texture:Destroy()
