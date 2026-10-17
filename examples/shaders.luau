-- CPU shader example. Run from a client context with an initialized Bloom canvas.
local Bloom = require(path.to.Bloom)

local invert = Bloom.Shader.Invert()
canvas:ApplyShader(invert, 1, 1, canvas.res_x, canvas.res_y)

local brightness = Bloom.Shader.Brightness(1.15)
canvas:ApplyShader(brightness, 16, 16, 256, 256)

local threshold = Bloom.CreateShader("Threshold", function(_, _, _, _, color32, uniforms)
	local red = bit32.band(color32, 0xFF)
	local green = bit32.band(bit32.rshift(color32, 8), 0xFF)
	local blue = bit32.band(bit32.rshift(color32, 16), 0xFF)
	local alpha = bit32.band(bit32.rshift(color32, 24), 0xFF)
	local value = if (red + green + blue) / 3 >= uniforms.threshold then 255 else 0
	return bit32.bor(value, bit32.lshift(value, 8), bit32.lshift(value, 16), bit32.lshift(alpha, 24))
end, { threshold = 128 })

canvas:ApplyShader(threshold, 1, 1, canvas.res_x, canvas.res_y)
