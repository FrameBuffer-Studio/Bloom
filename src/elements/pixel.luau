--!native
--!optimize 2
--!strict

return {
    --[=[
        <strong>Bloom/Pixel/Draw</strong>

        Draw pixel at coordinates X and Y.

        @param x number -- Point by X-coordinate.
        @param y number -- Point by Y-coordinate.
        @param color32 number -- 32-bit number represent of RGBA color.

        @error nil -- If not bound X or Y.
    ]=]
	DrawPixel = function(self, x: number, y: number, color32: number): ()
        if x < 1 or x > self.res_x or y < 1 or y > self.res_y then return end
	    buffer.writeu32(self.pixel_buffer, ((x - 1) + (y - 1) * self.res_x) * 4, color32)
    end,

    --[=[
        <strong>Bloom/Pixel/Read</strong>

        Read a pixel from pixel buffer at coordinates X and Y.

        @param x number -- Point by X-coordinate.
        @param y number -- Point by Y-coordinate.

        @return number -- 32-bit number represent of RGBA color.

        @error number -- If not bound X or Y.
    ]=]
    ReadPixel = function(self, x: number, y: number): number
        if x < 1 or x > self.res_x or y < 1 or y > self.res_y then return 0 end
        return buffer.readu32(self.pixel_buffer, ((x - 1) + (y - 1) * self.res_x) * 4)
    end,

    --[=[
        <strong>Bloom/Pixel/DrawUnsafe</strong>

        Draw pixel at coordinates X and Y, without bounds checking.

        @param x number -- Point by X-coordinate.
        @param y number -- Point by Y-coordinate.
        @param color32 number -- 32-bit number represent of RGBA color.
    ]=]
    DrawPixelUnsafe = function(self, x: number, y: number, color32: number): ()
        buffer.writeu32(self.pixel_buffer, ((x - 1) + (y - 1) * self.res_x) * 4, color32)
    end,

    --[=[
        <strong>Bloom/Pixel/ReadUnsafe</strong>

        Read a pixel from pixel buffer at coordinates X and Y, without bounds checking.

        @param x number -- Point by X-coordinate.
        @param y number -- Point by Y-coordinate.

        @return number -- 32-bit number represent of RGBA color.
    ]=]
    ReadPixelUnsafe = function(self, x: number, y: number): number
        return buffer.readu32(self.pixel_buffer, ((x - 1) + (y - 1) * self.res_x) * 4)
    end,
}
