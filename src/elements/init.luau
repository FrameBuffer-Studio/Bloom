--!strict

-- `@self/` resolves to this module's children; `./` would resolve to its siblings.
return {
	Line = require("@self/line"),
	Pixel = require("@self/pixel"),
	Rect = require("@self/rect"),
	Triangle = require("@self/triangle"),
}
