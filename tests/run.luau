--!strict

--[[
	Bloom test suite for Lune:

		lune run tests/run

	Roblox APIs are replaced by tests/roblox_mock.luau, which follows the documented
	EditableImage / AssetService contract.
]]

local fs = require("@lune/fs")
local process = require("@lune/process")
local mock = require("./roblox_mock")

local Bloom = mock.require("src")
local Color4 = Bloom.GetColor4()
local Vector2 = mock.Vector2

local RED = Color4.New32Bit(255, 0, 0)
local GREEN = Color4.New32Bit(0, 255, 0)
local BLUE = Color4.New32Bit(0, 0, 255)
local WHITE = Color4.New32Bit(255, 255, 255)
local BLACK = Color4.New32Bit(0, 0, 0)

local passed, failed = 0, 0

local function test(name: string, body: () -> ()): ()
	mock.reset()
	Bloom.Support._Reset()
	local ok, err = pcall(body)
	if ok then
		passed += 1
		print("  ok   " .. name)
	else
		failed += 1
		print("  FAIL " .. name .. "\n       " .. tostring(err))
	end
end

local function expect_equal(actual: any, expected: any, label: string?): ()
	if actual ~= expected then
		error(string.format("%s: expected %s, got %s", label or "value", tostring(expected), tostring(actual)), 2)
	end
end

local function expect(condition: any, label: string): ()
	if not condition then
		error(label, 2)
	end
end

local function expect_error(body: () -> (), pattern: string): ()
	local ok, err = pcall(body)
	expect(not ok, "expected an error matching '" .. pattern .. "'")
	expect(string.find(tostring(err), pattern, 1, true) ~= nil, "unexpected error: " .. tostring(err))
end

local function new_canvas(width: number, height: number, options: any?): any
	local parent = mock.new_instance("Frame")
	local template = mock.new_instance("ImageLabel")
	return Bloom.Create(Vector2.new(width, height), parent, template, options), parent
end

local function read_editable(canvas: any, tile_index: number, x: number, y: number): number
	local tile = canvas.tiles[tile_index]
	return buffer.readu32(tile.editable:ReadPixelsBuffer(Vector2.new(x, y), Vector2.one), 0)
end

local function run_scheduler(canvas: any): ()
	for _ = 1, 1000 do
		if canvas.async:PendingCount() == 0 then
			return
		end
		canvas.async:Step(1)
	end
	error("scheduler did not drain")
end

print("Color4")

test("New32Bit defaults to opaque alpha and masks channels", function()
	expect_equal(Color4.New32Bit(1, 2, 3), 0xFF030201)
	expect_equal(Color4.New32Bit(256 + 7, 0, 0, 0), 7, "red is masked to one byte")
end)

test("Color4 objects round channels and round-trip", function()
	local color = Color4.New(10.6, 20.4, 30, 40)
	expect_equal(color.R, 11)
	expect_equal(color.G, 20)
	expect_equal(Color4.From32Bit(color:To32Bit()).B, 30)
	expect_equal(Color4.FromColor3({ R = 1, G = 0.5, B = 0 } :: any).G, 128)
end)

test("Set* replace a single channel", function()
	expect_equal(Color4.SetG(0xFFFFFFFF, 0), 0xFFFF00FF)
	expect_equal(Color4.SetA(0, 0x1FF), 0xFF000000)
end)

test("BlendOver composites straight alpha", function()
	expect_equal(Color4.BlendOver(BLUE, RED), RED, "opaque source")
	expect_equal(Color4.BlendOver(BLUE, Color4.SetA(RED, 0)), BLUE, "transparent source")
	local half = Color4.BlendOver(BLACK, Color4.New32Bit(255, 255, 255, 128))
	local r, _, _, a = Color4.Unpack(half)
	expect_equal(a, 255)
	expect_equal(r, 128)
end)

print("Context and presentation")

test("Create tiles a framebuffer larger than 1024x1024", function()
	local canvas = new_canvas(1500, 700)
	expect_equal(canvas.size_x, 2)
	expect_equal(canvas.size_y, 1)
	expect_equal(mock.live_editables, 2)
	expect_equal(mock.clones, 2)
	expect_equal(canvas.tiles[1].w, 476)
	expect_equal(canvas.images[1].Position.X.Offset, 1024)
end)

test("tile_size option is respected", function()
	local canvas = new_canvas(600, 300, { tile_size = 256 })
	expect_equal(canvas.size_x, 3)
	expect_equal(canvas.size_y, 2)
	canvas:DrawPixelUnsafe(300, 280, RED)
	expect(canvas._dirty_tiles[1 + 1 * 3], "DrawPixelUnsafe marks the right tile")
end)

test("ScreenGui parents are accepted; GuiObject parents are clipped", function()
	local screen_gui = mock.new_instance("ScreenGui")
	Bloom.Create(Vector2.new(16, 16), screen_gui, mock.new_instance("ImageLabel"))
	expect_equal(screen_gui.ClipsDescendants, nil, "ScreenGui untouched")

	local _, frame = new_canvas(16, 16)
	expect_equal(frame.ClipsDescendants, true)
end)

test("Create without a template renders off-screen", function()
	local canvas = Bloom.Create(Vector2.new(8, 8))
	canvas:DrawPixel(1, 1, RED)
	canvas:Update()
	expect_equal(read_editable(canvas, 0, 0, 0), RED)
end)

test("Exhausted EditableImage budget fails loudly and releases created tiles", function()
	mock.memory_budget_bytes = 1024 * 1024 * 4 -- room for one full tile only
	expect_error(function()
		new_canvas(2048, 1024)
	end, "memory budget is exhausted")
	expect_equal(mock.live_editables, 0)
end)

test("Update uploads dirty tiles with the correct region", function()
	local canvas = new_canvas(1100, 20)
	canvas:DrawRectangle(1020, 5, 1030, 10, GREEN)
	canvas:Update()
	expect_equal(read_editable(canvas, 0, 1023, 5), GREEN, "last column of tile 0")
	expect_equal(read_editable(canvas, 1, 0, 9), GREEN, "first column of tile 1")
	expect_equal(read_editable(canvas, 1, 7, 9), 0, "outside the rectangle")
	expect(next(canvas._dirty_tiles) == nil, "no dirty tiles left")
end)

test("UpdateAsync uploads through the scheduler and Update cancels it", function()
	local canvas = new_canvas(1100, 10)
	local phases = {}
	canvas:RegisterStage("record", function(_, phase)
		table.insert(phases, phase)
	end)

	-- Drive the scheduler manually: task.spawn would otherwise run the first step immediately.
	canvas.async.Start = function() end

	canvas:Clear(WHITE)
	canvas:UpdateAsync()
	expect_equal(canvas._pending_uploads, 2)
	canvas:Update() -- cancels the queued tasks (Task:Cancel must work)
	expect_equal(canvas._pending_uploads, 0)

	canvas:DrawPixel(1, 1, RED)
	canvas:UpdateAsync()
	run_scheduler(canvas)
	expect_equal(read_editable(canvas, 0, 0, 0), RED)
	expect_equal(phases[#phases], "afterUpload")
	expect_equal(canvas.async:GetStats().cancelled, 2)
end)

test("Resize recreates tiles and resets pending uploads", function()
	local canvas = new_canvas(100, 100)
	canvas.async.Start = function() end
	canvas:UpdateAsync()
	expect_equal(canvas._pending_uploads, 1)
	canvas:Resize(Vector2.new(1500, 50))
	expect_equal(canvas._pending_uploads, 0)
	expect_equal(mock.live_editables, 2)
	expect_error(function()
		canvas:Resize(Vector2.new(0.5, 10))
	end, "positive resolution")
end)

test("Destroy releases owned EditableImages and labels", function()
	local canvas = new_canvas(2000, 10)
	local label = canvas.images[0]
	canvas:Destroy()
	expect_equal(mock.live_editables, 0)
	expect(label.Destroyed, "label destroyed")
end)

test("FromEditableImage starts from existing pixels and does not own them", function()
	local editable = mock.new_editable_image(Vector2.new(4, 4))
	local pixels = buffer.create(4 * 4 * 4)
	buffer.writeu32(pixels, (1 * 4 + 2) * 4, BLUE)
	editable:WritePixelsBuffer(Vector2.zero, Vector2.new(4, 4), pixels)

	local holder = mock.new_instance("ImageLabel")
	local canvas = Bloom.FromEditableImage(editable, holder)
	expect_equal(canvas:ReadPixel(3, 2), BLUE)

	canvas:DrawPixel(1, 1, RED)
	canvas:Update()
	expect_equal(read_editable(canvas, 0, 0, 0), RED)

	canvas:Destroy()
	expect(not editable.Destroyed, "wrapped image is not destroyed")
	expect_error(function()
		Bloom.FromEditableImage(editable, holder):Resize(Vector2.new(2, 2))
	end, "not supported")
end)

print("Drawing")

test("DrawPixel floors coordinates and respects the viewport", function()
	local canvas = new_canvas(8, 8)
	canvas:DrawPixel(2.7, 3.2, RED)
	expect_equal(canvas:ReadPixel(2, 3), RED)

	canvas:SetViewport(5, 5, 2, 2)
	canvas:DrawPixel(1, 1, GREEN)
	expect_equal(canvas:ReadPixel(1, 1), 0)
	canvas:ResetViewport()
	expect_equal(canvas:GetState().viewport.w, 8)
end)

test("DrawLine draws both endpoints and clips", function()
	local canvas = new_canvas(10, 10)
	canvas:DrawLine(1, 1, 10, 10, RED)
	expect_equal(canvas:ReadPixel(1, 1), RED)
	expect_equal(canvas:ReadPixel(10, 10), RED)
	canvas:DrawLine(-100, 5, 100, 5, GREEN)
	expect_equal(canvas:ReadPixel(1, 5), GREEN)
	expect_equal(canvas:ReadPixel(10, 5), GREEN)
end)

test("Horizontal and vertical lines accept reversed and fractional input", function()
	local canvas = new_canvas(10, 10)
	canvas:DrawHorizontalLine(8, 2.5, 3, RED)
	expect_equal(canvas:ReadPixel(3, 2), RED)
	expect_equal(canvas:ReadPixel(8, 2), RED)
	canvas:DrawVerticalLine(4.9, 9, 6, GREEN)
	expect_equal(canvas:ReadPixel(4, 6), GREEN)
	expect_equal(canvas:ReadPixel(4, 9), GREEN)
end)

test("DrawLineAA keeps a solid core without seams and blends edges", function()
	local canvas = new_canvas(40, 20)
	canvas:Clear(BLACK)
	canvas:DrawLineAA(5, 10, 35, 10, 5, WHITE)
	for x = 5, 35 do
		expect_equal(canvas:ReadPixel(x, 10), WHITE, "core pixel " .. x)
	end
	local _, _, _, edge_alpha = Color4.Unpack(canvas:ReadPixel(20, 13))
	expect_equal(edge_alpha, 255, "edge is blended over an opaque background")
end)

test("DrawTriangle fills scanlines", function()
	local canvas = new_canvas(20, 20)
	canvas:DrawTriangle(2, 2, 18, 2, 2, 18, RED)
	expect_equal(canvas:ReadPixel(3, 3), RED)
	expect_equal(canvas:ReadPixel(18, 18), 0)
	canvas:DrawTriangle(1, 20, 5, 20, 10, 20, GREEN)
	expect_equal(canvas:ReadPixel(10, 20), GREEN, "degenerate triangle")
end)

test("Clear honours the clear color and marks everything dirty", function()
	local canvas = new_canvas(1100, 4, { clear_color = BLUE })
	canvas:Update()
	canvas:Clear()
	expect_equal(canvas:ReadPixel(1100, 4), BLUE)
	expect(canvas._dirty_tiles[0] and canvas._dirty_tiles[1], "both tiles dirty")
end)

print("Shaders and textures")

test("Built-in shaders", function()
	local canvas = new_canvas(4, 4)
	canvas:Clear(Color4.New32Bit(100, 50, 0, 200))
	expect_equal(canvas:ApplyShader(Bloom.Shader.Invert(), 1, 1, 2, 2), 4)
	expect_equal(canvas:ReadPixel(1, 1), Color4.New32Bit(155, 205, 255, 200))
	canvas:ApplyShader(Bloom.Shader.Brightness(2), 3, 3, 4, 4)
	expect_equal(canvas:ReadPixel(4, 4), Color4.New32Bit(200, 100, 0, 200))
	canvas:ApplyShader(Bloom.Shader.Grayscale(), 4, 1, 4, 1)
	local r, g, b = Color4.Unpack(canvas:ReadPixel(4, 1))
	expect(r == g and g == b, "grayscale")
end)

test("Custom shader receives normalized u/v", function()
	local canvas = new_canvas(3, 3)
	local seen = {}
	local probe = Bloom.CreateShader("Probe", function(x, y, u, v)
		seen[x .. "," .. y] = { u, v }
		return nil
	end)
	canvas:ApplyShader(probe, 1, 1, 3, 3)
	expect_equal(seen["3,3"][1], 1)
	expect_equal(seen["2,1"][1], 0.5)
end)

test("Texture draw supports scaling, tint, opacity and replacement", function()
	local canvas = new_canvas(8, 8)
	local pixels = buffer.create(2 * 1 * 4)
	buffer.writeu32(pixels, 0, RED)
	buffer.writeu32(pixels, 4, GREEN)
	local tex = Bloom.Texture.New(2, 1, pixels)
	expect_equal(tex:GetPixel(2.9, 1), GREEN)

	canvas:DrawTexture(tex, 1, 1, 4, 2)
	expect_equal(canvas:ReadPixel(2, 2), RED)
	expect_equal(canvas:ReadPixel(3, 1), GREEN)

	canvas:DrawTexture(tex, 1, 4, nil, nil, { tint = Color4.New32Bit(255, 255, 255, 0), blend = false })
	expect_equal(canvas:ReadPixel(1, 4), Color4.SetA(RED, 0), "replacement writes transparent pixel")

	canvas:Clear(BLUE)
	canvas:DrawTexture(tex, 1, 1, nil, nil, { opacity = 0.5 })
	local r, _, b, a = Color4.Unpack(canvas:ReadPixel(1, 1))
	expect(r > 100 and b > 100 and a == 255, "half-opacity blend")

	tex:Destroy()
	expect_error(function()
		canvas:DrawTexture(tex, 1, 1)
	end, "destroyed Texture")
end)

print("Fonts")

test("Bitmap font DrawText and MeasureText agree", function()
	local canvas = new_canvas(64, 32)
	local atlas = Bloom.Texture.New(2, 2, buffer.create(16))
	local glyph = { x = 1, y = 1, width = 2, height = 2, xadvance = 3 }
	local font = Bloom.Font.New(atlas, { A = glyph, ["?"] = glyph }, 4)

	local width, height = canvas:DrawText(font, "AA\nA", 1, 1)
	local measured_width, measured_height = Bloom.Font.MeasureText(font, "AA\nA")
	expect_equal(width, 6)
	expect_equal(height, 8)
	expect_equal(measured_width, width)
	expect_equal(measured_height, height)
end)

local FONT_PATH = "C:/Windows/Fonts/arial.ttf"
if fs.isFile(FONT_PATH) then
	test("TrueType font rasterizes glyphs, holes and composite glyphs", function()
		local font = Bloom.Font.FromString(fs.readFile(FONT_PATH), 32, "Oé?")
		local atlas = font.texture

		local o = font.glyphs[utf8.codepoint("O")]
		expect(o.width > 10 and o.height > 10, "O has a bitmap")
		local center = atlas:GetPixel(o.x + o.width // 2, o.y + o.height // 2)
		local ring = atlas:GetPixel(o.x + 1, o.y + o.height // 2)
		expect_equal(Color4.SetR(Color4.SetG(Color4.SetB(center, 0), 0), 0), 0, "O counter is empty")
		expect(bit32.extract(ring, 24, 8) > 0, "O ring is filled")

		local e = font.glyphs[utf8.codepoint("é")]
		local covered = 0
		for y = e.y, e.y + e.height - 1 do
			for x = e.x, e.x + e.width - 1 do
				if bit32.extract(atlas:GetPixel(x, y), 24, 8) > 0 then
					covered += 1
				end
			end
		end
		expect(covered > 20, "é (composite in Arial) is rendered")

		local canvas = new_canvas(200, 60)
		local width, height = canvas:DrawText(font, "O\tO", 2, 2, WHITE)
		expect(width > o.width * 2 and height == font.line_height, "measured text")
		font:Destroy()
	end)
else
	print("  skip TrueType test: " .. FONT_PATH .. " not found")
end

print("Scheduler")

test("Priorities, aging-free ordering and arguments", function()
	local scheduler = Bloom.Async.New(1)
	local order = {}
	scheduler:SubmitWithOptions(function(label)
		table.insert(order, label)
	end, { priority = 3 }, "background")
	scheduler:Submit(function(label)
		table.insert(order, label)
	end, "normal")
	scheduler:SubmitWithOptions(function(label)
		table.insert(order, label)
	end, { priority = 0 }, "critical")

	scheduler:Step(1)
	expect_equal(table.concat(order, ","), "critical,normal,background")
	expect_equal(scheduler:GetStats().completed, 3)
end)

test("Cooperative Yield requeues the task", function()
	local scheduler = Bloom.Async.New(1, { max_tasks_per_step = 1 })
	local steps = {}
	local handle = scheduler:Submit(function()
		table.insert(steps, 1)
		Bloom.Async.Yield()
		table.insert(steps, 2)
	end)

	scheduler:Step()
	expect_equal(handle.state, "yielded")
	scheduler:Step()
	expect_equal(#steps, 2)
	expect(handle:IsFinished(), "finished")
	expect_error(function()
		Bloom.Async.Yield()
	end, "inside a scheduler task")
end)

test("Cancel, Clear and failures are counted", function()
	local scheduler = Bloom.Async.New()
	local cancelled = scheduler:Submit(function() end)
	cancelled:Cancel()
	expect(cancelled:IsCancelled(), "cancelled")
	scheduler:Submit(function()
		error("boom")
	end)
	scheduler:Step(1)

	scheduler:Submit(function() end)
	scheduler:Clear()
	local stats = scheduler:GetStats()
	expect_equal(stats.cancelled, 2)
	expect_equal(stats.failed, 1)
	expect_equal(stats.pending, 0)
	expect(string.find(mock.warnings[1], "boom", 1, true) ~= nil, "failure is reported")
end)

test("Pipeline stages run in order and survive errors", function()
	local canvas = new_canvas(4, 4)
	local calls = {}
	canvas:RegisterStage("b", function(_, phase)
		if phase == "beginFrame" then
			table.insert(calls, "b")
		end
	end, 10)
	canvas:RegisterStage("a", function(_, phase)
		if phase == "beginFrame" then
			table.insert(calls, "a")
			error("stage failure")
		end
	end, 5)

	canvas:BeginFrame()
	expect_equal(table.concat(calls, ","), "a,b")
	expect(canvas:RemoveStage("a"), "removed")
	expect(not canvas:RemoveStage("a"), "already removed")
	expect_equal(#mock.warnings, 1)
end)

print("EditableImage support")

test("CheckSupport reports an available API and caches it", function()
	local report = Bloom.CheckSupport()
	expect(report.supported, "supported")
	expect_equal(report.status, "supported")
	expect(Bloom.IsSupported(), "IsSupported")
	expect_equal(mock.live_editables, 0, "probe image destroyed")

	mock.api_error = "should not be called again"
	expect(Bloom.CheckSupport().supported, "cached")
end)

test("Disabled Mesh / Image APIs are reported and block Create", function()
	mock.api_error = "EditableImage APIs are not enabled"
	local report = Bloom.CheckSupport()
	expect(not report.supported, "not supported")
	expect_equal(report.status, "disabled")
	expect_equal(report.details, "EditableImage APIs are not enabled")
	expect(string.find(report.message, "Allow Mesh / Image APIs", 1, true) ~= nil, "explains the setting")

	expect_error(function()
		new_canvas(8, 8)
	end, "Allow Mesh / Image APIs")
	expect_equal(mock.live_editables, 0)

	mock.api_error = nil
	expect(Bloom.IsSupported(), "failures are not cached")
end)

test("A probe that cannot write pixels is reported as disabled", function()
	mock.write_error = "WritePixelsBuffer is not permitted"
	local report = Bloom.CheckSupport()
	expect_equal(report.status, "disabled")
	expect_equal(report.details, "WritePixelsBuffer is not permitted")
	expect_equal(mock.live_editables, 0, "probe image destroyed after failure")
end)

test("An exhausted budget during the probe is reported as out_of_memory", function()
	mock.memory_budget_bytes = 0
	local report = Bloom.CheckSupport()
	expect_equal(report.status, "out_of_memory")
	expect_error(function()
		new_canvas(8, 8)
	end, "memory budget is exhausted")
end)

print(string.format("\n%d passed, %d failed", passed, failed))
if failed > 0 then
	process.exit(1)
end
