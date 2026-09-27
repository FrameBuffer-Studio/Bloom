const line = require("./line")

local fill_flat_top = function(self, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, color32: number): ()
    local invslope1, invslope2 = (x2 - x0) / (y2 - y0), (x2 - x1) / (y2 - y1)
    local cur_x0, cur_x1 = x2, x2

    for y = y2, y0, -1 do
        line.DrawHorizontalLine(self, cur_x0, cur_x1, y, color32)

        cur_x0 -= invslope1
        cur_x1 -= invslope2
    end
end

local fill_flat_bottom = function(self, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, color32: number): ()
    local invslope1, invslope2 = (x1 - x0) / (y1 - y0), (x2 - x0) / (y2 - y0)
    local cur_x0, cur_x1 = x0, x0

    for y = y0, y1 do
        line.DrawHorizontalLine(self, cur_x0, cur_x1, y, color32)

        cur_x0 -= invslope1
        cur_x1 -= invslope2
    end
end

return {
    DrawTriangle = function(self, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, color32: number): ()
        if y0 > y1 then x0, y0, x1, y1 = x1, y1, x0, x0 end
        if y0 > y2 then x0, y0, x2, y2 = x2, y2, x0, y0 end
        if y1 > y2 then x1, y1, x2, y2 = x2, y2, x1, y1 end

        if y0 == y2 then return end

        if y1 == y2 then
            fill_flat_bottom(self, x0, y0, x1, y1, x2, y2, color32)
        elseif y0 == y1 then
            fill_flat_top(self, x0, y0, x1, y1, x2, y2, color32)
        else
            local split = x1 + ((y1 - y0) / (y2 - y0)) * (x2 - x0)

            fill_flat_bottom(self, x0, y0, x1, y1, split, y1, color32)
            fill_flat_top(self, x1, y1, split, y1, x2, y2, color32)
        end
    end
}
