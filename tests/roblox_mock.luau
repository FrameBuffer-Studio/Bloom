--!strict

--[[
	Minimal Roblox environment for running Bloom under Lune.

	Modules are loaded with `luau.load` into a custom environment so that Roblox globals
	(`game`, `task`, `Vector2`, `Content`, ...) can be mocked, and `require` follows Roblox's
	require-by-string rules: `./X` is a sibling of the script, `../X` a sibling of its parent,
	and `@self/X` a child of the script.

	The EditableImage mock enforces the documented contract of the Roblox API:
	- AssetService:CreateEditableImage({ Size = Vector2 }) returns nil when the memory budget is exhausted;
	- Size is at most 1024x1024;
	- WritePixelsBuffer / ReadPixelsBuffer use 4 bytes per pixel (RGBA) and a buffer of Size.X * Size.Y * 4 bytes.
]]

local fs = require("@lune/fs")
local luau = require("@lune/luau")
local roblox = require("@lune/roblox")
local task_library = require("@lune/task")

local MAX_EDITABLE_SIZE = 1024

local mock = {}

mock.warnings = {} :: { string }
mock.memory_budget_bytes = math.huge
mock.memory_used_bytes = 0
mock.live_editables = 0
mock.api_error = nil :: string?
mock.write_error = nil :: string?

-- Instances -----------------------------------------------------------------------------

type MockInstance = { [string]: any }

local function new_instance(class_name: string, properties: { [string]: any }?): MockInstance
	local instance: MockInstance = {
		ClassName = class_name,
		Parent = nil,
		Destroyed = false,
	}
	for key, value in properties or {} do
		instance[key] = value
	end

	function instance.IsA(self: MockInstance, name: string): boolean
		if name == self.ClassName or name == "Instance" then
			return true
		end
		local gui_objects = { ImageLabel = true, Frame = true }
		return name == "GuiObject" and gui_objects[self.ClassName] == true
	end

	function instance.Clone(self: MockInstance): MockInstance
		local copy = new_instance(self.ClassName)
		for key, value in self do
			if type(value) ~= "function" and key ~= "Parent" then
				copy[key] = value
			end
		end
		mock.clones += 1
		return copy
	end

	function instance.Destroy(self: MockInstance): ()
		self.Destroyed = true
		self.Parent = nil
	end

	return instance
end

mock.clones = 0
mock.new_instance = new_instance

local function new_editable_image(size: any): MockInstance
	local width, height = size.X, size.Y
	local image = new_instance("EditableImage", { Size = size })
	local pixels = buffer.create(width * height * 4)
	local bytes = width * height * 4

	mock.memory_used_bytes += bytes
	mock.live_editables += 1
	image.WriteCount = 0

	local function check_region(position: any, region: any): ()
		assert(position.X >= 0 and position.Y >= 0, "position out of bounds")
		assert(position.X + region.X <= width and position.Y + region.Y <= height, "region out of bounds")
		assert(region.X % 1 == 0 and region.Y % 1 == 0, "region size must be integral")
	end

	function image.WritePixelsBuffer(self: MockInstance, position: any, region: any, source: buffer): ()
		assert(not self.Destroyed, "EditableImage was destroyed")
		if mock.write_error then
			error(mock.write_error, 0)
		end
		check_region(position, region)
		assert(buffer.len(source) == region.X * region.Y * 4, "buffer must be Size.X * Size.Y * 4 bytes")

		for row = 0, region.Y - 1 do
			buffer.copy(pixels, ((position.Y + row) * width + position.X) * 4, source, row * region.X * 4, region.X * 4)
		end
		self.WriteCount += 1
	end

	function image.ReadPixelsBuffer(self: MockInstance, position: any, region: any): buffer
		assert(not self.Destroyed, "EditableImage was destroyed")
		check_region(position, region)

		local result = buffer.create(region.X * region.Y * 4)
		for row = 0, region.Y - 1 do
			buffer.copy(result, row * region.X * 4, pixels, ((position.Y + row) * width + position.X) * 4, region.X * 4)
		end
		return result
	end

	function image.Destroy(self: MockInstance): ()
		if not self.Destroyed then
			self.Destroyed = true
			mock.memory_used_bytes -= bytes
			mock.live_editables -= 1
		end
	end

	return image
end

mock.new_editable_image = new_editable_image

local asset_service = {
	CreateEditableImage = function(_self: any, options: { Size: any }?): MockInstance?
		if mock.api_error then
			error(mock.api_error, 0)
		end
		local size = if options and options.Size then options.Size else roblox.Vector2.new(512, 512)
		assert(size.X >= 1 and size.Y >= 1, "EditableImage size must be positive")
		assert(size.X <= MAX_EDITABLE_SIZE and size.Y <= MAX_EDITABLE_SIZE, "EditableImage maximum size is 1024x1024")

		if mock.memory_used_bytes + size.X * size.Y * 4 > mock.memory_budget_bytes then
			return nil
		end
		return new_editable_image(size)
	end,
}

local game = {
	GetService = function(_self: any, name: string): any
		assert(name == "AssetService", "Unsupported service in mock: " .. name)
		return asset_service
	end,
}

local content = {
	fromObject = function(object: any): any
		return { SourceType = "Object", Object = object }
	end,
}

function mock.reset(): ()
	table.clear(mock.warnings)
	mock.memory_budget_bytes = math.huge
	mock.memory_used_bytes = 0
	mock.live_editables = 0
	mock.clones = 0
	mock.api_error = nil
	mock.write_error = nil
end

-- Module loader -------------------------------------------------------------------------

local environment: { [string]: any } = {
	game = game,
	task = task_library,
	Vector2 = roblox.Vector2,
	UDim2 = roblox.UDim2,
	Content = content,
	warn = function(...: any): ()
		local parts = table.pack(...)
		for index = 1, parts.n do
			parts[index] = tostring(parts[index])
		end
		table.insert(mock.warnings, table.concat(parts :: any, " "))
	end,
}

local cache: { [string]: any } = {}

local function is_file(path: string): boolean
	return fs.isFile(path)
end

-- Instance path -> file path (`X.luau` or `X/init.luau`).
local function file_for_instance(instance_path: string): string
	if is_file(instance_path .. ".luau") then
		return instance_path .. ".luau"
	elseif is_file(instance_path .. "/init.luau") then
		return instance_path .. "/init.luau"
	end
	error("Module not found: " .. instance_path, 0)
end

local function parent_of(path: string): string
	return (string.match(path, "^(.*)/[^/]+$") or ".") :: string
end

-- The Roblox instance that a file represents: `dir/init.luau` is `dir`, `dir/x.luau` is `dir/x`.
local function instance_for_file(file_path: string): string
	if string.match(file_path, "/init%.luau$") then
		return parent_of(file_path)
	end
	return (string.gsub(file_path, "%.luau$", ""))
end

local load_module: (file_path: string) -> any

local function make_require(file_path: string): (string) -> any
	local script = instance_for_file(file_path)

	return function(request: string): any
		local target
		if string.sub(request, 1, 6) == "@self/" then
			target = script .. "/" .. string.sub(request, 7)
		elseif string.sub(request, 1, 3) == "../" then
			target = parent_of(parent_of(script)) .. "/" .. string.sub(request, 4)
		elseif string.sub(request, 1, 2) == "./" then
			target = parent_of(script) .. "/" .. string.sub(request, 3)
		else
			error("Unsupported require path: " .. request, 2)
		end
		return load_module(file_for_instance(target))
	end
end

function load_module(file_path: string): any
	local cached = cache[file_path]
	if cached ~= nil then
		return cached
	end

	-- Lune adds the standard globals to this table itself; only Roblox mocks are injected here.
	local module_environment = table.clone(environment)
	module_environment.require = make_require(file_path)
	local chunk = luau.load(fs.readFile(file_path), {
		debugName = file_path,
		environment = module_environment,
	})

	local result = chunk()
	cache[file_path] = result
	return result
end

--[=[
	Loads a module the way Roblox would, given the instance path (for example "src").
]=]
function mock.require(instance_path: string): any
	return load_module(file_for_instance(instance_path))
end

mock.Vector2 = roblox.Vector2
mock.UDim2 = roblox.UDim2
mock.task = task_library

return mock
