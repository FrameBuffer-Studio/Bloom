local Bloom = require(path.to.Bloom)
local Color4 = Bloom.GetColor4()

-- fontBytes must be the raw bytes of a .ttf file represented as a binary Luau string.
-- Do not pass Base64 text unless you decode it to raw bytes first.
local font = Bloom.Font.FromString(
    fontBytes,
    18,
    " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?.,:-_"
)

canvas:DrawText(font, "Hello Bloom!", 12, 12, Color4.New32Bit(255, 255, 255, 255), 1)
local width, height = Bloom.Font.MeasureText(font, "Hello Bloom!", 1)

-- The generated atlas is owned by this Font and is released here.
font:Destroy()
