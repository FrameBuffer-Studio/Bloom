const pixel = require("./pixel")
const color4 = require("../color4")

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

    DrawLineAA = function(self, x0: number, y0: number, x1: number, y1: number, thickness: number, color32: number): ()
        local dx, dy = math.abs(x1 - x0), math.abs(y1 - y0)
        local sx, sy = x0 < x1 and 1 or -1, y0 < y1 and 1 or -1

        local err = dx - dy
        local e2, x2, y2

        local ed = (dx + dy == 0) and 1 or math.sqrt(dx * dx + dy * dy)
        thickness = (thickness + 1) / 2

        while true do
            pixel.DrawPixel(self, x0, y0, color4.SetA(color32, math.max(0, 255 * (math.abs(err - dx + dy) / ed - thickness + 1))))

            e2 = err
            x2 = x0

            if 2 * e2 >= -dx then
                e2 = e2 + dy
                y2 = y0

                while e2 < ed * thickness and (y1 ~= y2 or dx > dy) do
                    y2 = y2 + sy
                    pixel.DrawPixel(self, x0, y2, color4.SetA(color32, math.max(0, 255 * (math.abs(e2) / ed - thickness + 1))))
                    e2 = e2 + dx
                end

                if x0 == x1 then break end

                e2 = err
                err = err - dy
                x0 = x0 + sx
            end

            if 2 * e2 <= dy then
                e2 = dx - e2

                while e2 < ed * thickness and (x1 ~= x2 or dx < dy) do
                    x2 = x2 + sx
                    pixel.DrawPixel(self, x2, y0, color4.SetA(color32, math.max(0, 255 * (math.abs(e2) / ed - thickness + 1))))
                    e2 = e2 + dy
                end

                if y0 == y1 then break end

                err = err + dx
                y0 = y0 + sy
            end
        end
    end
}