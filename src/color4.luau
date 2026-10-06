--!strict
--!native
--!optimize 2


--[=[
	@class Color4

	Class created for easy working and manipulating with colors.

	Foundation for `Bloom`.
]=]
local Color4 = {}
Color4.__index = Color4

export type Color4 = {
    R: number,
    G: number,
    B: number,
    A: number,

    To32Bit: (self: Color4) -> number,
    Lerp: (self: Color4, other: Color4, t: number) -> Color4,
}

--[=[
	<strong>Bloom/Color4/New</strong>

	Creates a new `Color4` object with RGBA channels.

	@param R number -- Red.
	@param G number -- Green.
	@param B number -- Blue.
	@param A number -- Alpha.

	@within Color4

	@return Color4
]=]
Color4.New = function(R: number, G: number, B: number, A: number): Color4
	local self = setmetatable({}, Color4)

	self.R = math.clamp(R or 0, 0, 255)
	self.G = math.clamp(G or 0, 0, 255)
	self.B = math.clamp(B or 0, 0, 255)
	self.A = math.clamp(A or 255, 0, 255)

	return (self :: any) :: Color4
end

--[=[
	<strong>Bloom/Color4/New32Bit</strong>

	Return 32-bit number color with RGBA.

	@param R number -- Red.
	@param G number -- Green.
	@param B number -- Blue.
	@param A number -- Alpha.

	@within Color4

	@return number -- 32-bit number represent of RGBA color.
]=]
Color4.New32Bit = function(R: number, G: number, B: number, A: number): number
	return bit32.bor(
		bit32.lshift(A or 0, 24),
		bit32.lshift(B or 0, 16),
		bit32.lshift(G or 0, 8),
		R or 0
	)
end

--[=[
	<strong>Bloom/Color4/SetR</strong>

	Overwrtie the R channel within the number.

	@param color number -- 32-bit number represent of RGBA color.
	@param val number -- Value of overwrited color channel.

	@within Color4

	@return number -- Overwrited color.
]=]
Color4.SetR = function(color: number, val: number): number
	return bit32.bor(
		bit32.band(color, 0xFFFFFF00),
		bit32.band(val, 0xFF)
	)
end

--[=[
	<strong>Bloom/Color4/SetG</strong>

	Overwrtie the G channel within the number.

	@param color number -- 32-bit number represent of RGBA color.
	@param val number -- Value of overwrited color channel.

	@within Color4

	@return number -- Overwrited color.
]=]
Color4.SetG = function(color: number, val: number): number
	return bit32.bor(
		bit32.band(color, 0xFF00FFFF),
		bit32.lshift(bit32.band(val, 0xFF), 8)
	)
end

--[=[
	<strong>Bloom/Color4/SetB</strong>

	Overwrtie the B channel within the number.

	@param color number -- 32-bit number represent of RGBA color.
	@param val number -- Value of overwrited color channel.

	@within Color4

	@return number -- Overwrited color.
]=]
Color4.SetB = function(color: number, val: number): number
	return bit32.bor(
		bit32.band(color, 0xFFFF00FF),
		bit32.lshift(bit32.band(val, 0xFF), 16)
	)
end

--[=[
	<strong>Bloom/Color4/SetA</strong>

	Overwrtie the A channel within the number.

	@param color number -- 32-bit number represent of RGBA color.
	@param val number -- Value of overwrited color channel.

	@within Color4

	@return number -- Overwrited color.
]=]
Color4.SetA = function(color: number, val: number): number
	return bit32.bor(
		bit32.band(color, 0x00FFFFFF),
		bit32.lshift(bit32.band(val, 0xFF), 24)
	)
end

--[=[
	<strong>Bloom/Color4/To32Bit</strong>

	Convert `Color4` to 32-bit number.

	@param self

	@within Color4

	@return number -- 32-bit number represent of RGBA color.
]=]
Color4.To32Bit = function(self: Color4): number
	return bit32.bor(
		bit32.lshift(self.A, 24),
		bit32.lshift(self.B, 16),
		bit32.lshift(self.G, 8),
		self.R
	)
end

--[=[
	<strong>Bloom/Color4/From32Bit</strong>

	Convert 32-bit number to `Color4`.

	@param hex number -- 32-bit number represent of RGBA color.

	@within Color4

	@return Color4
]=]
Color4.From32Bit = function(hex: number): Color4
	return Color4.New(
		bit32.extract(hex, 0, 8),
		bit32.extract(hex, 8, 8),
		bit32.extract(hex, 16, 8),
		bit32.extract(hex, 24, 8)
	)
end

--[=[
	<strong>Bloom/Color4/FromColor3</strong>

	Creates `Color4` object from `Color3`.

	@param color Color3
	@param alpha number -- Alpha of color.

	@within Color4

	@return Color4
]=]
Color4.FromColor3 = function(color: Color3, alpha: number): Color4
	local self = setmetatable({}, Color4)

	self.R = math.clamp(color.R or 0, 0, 255)
	self.G = math.clamp(color.G or 0, 0, 255)
	self.B = math.clamp(color.B or 0, 0, 255)
	self.A = math.clamp(alpha or 255, 0, 255)

	return (self :: any) :: Color4
end

--[=[
	<strong>Bloom/Color4/Lerp</strong>

	Interpolate two `Color4` by `t`.

	@param self
	@param other Color4 -- second color to interpolate
	@param t number

	@within Color4

	@return Color4
]=]
Color4.Lerp = function(self: Color4, other: Color4, t: number): Color4
	t = math.clamp(t, 0, 1)

	return Color4.New(
		self.R + (other.R - self.R) * t,
		self.G + (other.G - self.G) * t,
		self.B + (other.B - self.B) * t,
		self.A + (other.A - self.A) * t
	)
end

--- @prop Zero Color4
--- @within Color4
--- Full transparent color or just 0.
Color4.Zero = 0

return Color4