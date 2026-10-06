--!native
--!optimize 2
--!strict

local elements = require("@self/elements")
local ln2: number = math.log(2)

local get_optimal_tile_size = function(res_x: number, res_y: number): number
    local min = math.min(res_x, res_y)
    if min < 64 then return 64 end

    local log =  (math.log(min) / ln2)
    if log > 10 then log = 10 end

    return bit32.lshift(1, log)
end

local bloom = {}
bloom.__index = bloom

bloom.Create = function(resolution: Vector2, reference: ImageLabel | {})
    local self = {}

    return self
end

bloom.FromEditableImage = function(editable_image: EditableImage, holder: ImageLabel)

end


return bloom