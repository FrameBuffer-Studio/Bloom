local function extend(target, ...)
    for _, source in ipairs({...}) do
        for key, value in pairs(source) do
            if type(value) == "function" then
                target[key] = value
            end
        end
    end

    return target
end

const w = require("@self/elements")





local module = {}




return module
