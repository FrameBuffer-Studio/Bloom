const pixel = require("./pixel")

return {
    DrawLine = function(self, x0: number, y0: number, x1: number, y1: number, color32: number): ()
        local dx, dy = math.abs(x1 - x0), -math.abs(y1 - y0)
        local sx, sy = (x0 < x1) and 1 or -1, (y0 < y1) and 1 or -1

        local err = dx + dy
        local e2

        while x0 ~= x1 and y0 ~= y1 do
            pixel.DrawPixel(self, x0, y0, color32)
            e2 = 2 * err

            if e2 >= dy then
                err = err + dy
                x0 = x0 + sx
            end

            if e2 <= dx then
                err = err + dx
                y0 = y0 + sy
            end
        end
    end,

    DrawLineAA = function(self, x0: number, y0: number, x1: number, y1: number, color32: number): ()
        local dx, dy = math.abs(x1 - x0), -math.abs(y1 - y0)
        local sx, sy = (x0 < x1) and 1 or -1, (y0 < y1) and 1 or -1

        local err = dx + dy
        local e2

        while x0 ~= x1 and y0 ~= y1 do
            pixel.DrawPixel(self, x0, y0, color32)
            e2 = 2 * err

            if e2 >= dy then
                err = err + dy
                x0 = x0 + sx
            end

            if e2 <= dx then
                err = err + dx
                y0 = y0 + sy
            end
        end
    end
}