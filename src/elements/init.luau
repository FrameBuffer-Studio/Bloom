const pixel = require("@self/pixel")
const line = require("@self/line")
const rect = require("@self/rect")
const triangle = require("@self/triangle")

local elements = {}

for _, module in {pixel, line, rect, triangle} do
    for k, v in module do
        elements[k] = v
    end
end

return elements :: typeof(pixel) & typeof(line) & typeof(rect) & typeof(triangle)