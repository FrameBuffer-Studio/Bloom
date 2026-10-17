# Task scheduler

Imagine you have lots of chores. If you do everything at once, you get tired and finish nothing. It is better to do a little at a time: a bit now, a bit later. The most important chores first.

The **scheduler** (`Async`) works just like that. It does tasks in small portions and makes sure every portion fits into a **budget** - a few milliseconds. So the game does not freeze.

```text
 queue:  [urgent!] [normal] [normal] [background] ...
              │
   step Step() - work for ≤ budget seconds
              ▼
           done ✓
```

Every canvas has its own scheduler: `canvas.async`. You can also make a separate one: `Bloom.Async.New()`.

## Priorities

| Priority | Meaning |
|----------|---------|
| `0` | Most urgent |
| `1` | Normal (default) |
| `2` | Not urgent |
| `3` | Background, when there is nothing else to do |

Within one priority, tasks go **in turn**: first come, first served.

**Aging.** A task that waits a long time becomes more important: every `aging_interval` seconds (0.25 by default) it moves up one level. So background tasks eventually run too.

**Deadline.** If a task's deadline has passed, it jumps ahead of all regular priorities.

## Creating

### `Bloom.Async.New(budget?, options?)`

**What it does:** creates a new scheduler.

| Name | Default | What it is |
|------|---------|------------|
| `budget` | `0.002` | Seconds per step (minimum `0.0001`) |
| `options.poll_interval` | `0.001` | Pause between steps in `Start()`, in seconds |
| `options.aging_interval` | `0.25` | After how many seconds of waiting a task becomes more important |
| `options.max_tasks_per_step` | `256` | Maximum tasks per step (minimum 1) |

```lua
local scheduler = Bloom.Async.New(0.001, { max_tasks_per_step = 64 })
```

For a canvas these settings are set in `Bloom.Create` through `async_budget` and `scheduler_options`.

## Adding a task

### `scheduler:Submit(callback, ...)`

**What it does:** puts a task into the queue with normal priority. All arguments after the function are passed to it.

```lua
local job = canvas.async:Submit(function(name, count)
	print(name, count)
end, "hello", 3)
```

**Returns:** a task (`Task`).

**All outcomes:**

- ✅ The task is in the queue with the status `"pending"`.
- ⏸️ It does **not** start by itself. You need to call `scheduler:Start()` or `scheduler:Step()`.
- 🚫 `callback` is not a function - the error `Async.Submit expects a function`.

### `scheduler:SubmitWithOptions(callback, options, ...)`

**What it does:** the same, but with a priority and/or a deadline.

| `options` field | What it is |
|-----------------|------------|
| `priority` | From 0 to 3. The number is rounded down and clamped to these limits |
| `deadline` | The deadline - an **absolute** `os.clock()` time, not "in how many seconds" |

```lua
canvas.async:SubmitWithOptions(function()
	print("urgent!")
end, { priority = 0, deadline = os.clock() + 0.05 })
```

### `canvas:Submit(callback, ...)` and `canvas:SubmitWithOptions(callback, options, ...)`

These are short versions of `canvas.async:Submit` and `canvas.async:SubmitWithOptions`.

## Running

### `scheduler:Start()`

**What it does:** starts a background loop. It calls `Step()` by itself, waits `poll_interval` and repeats.

**All outcomes:**

- ✅ Tasks start running by themselves.
- 🔁 The loop is already running - nothing happens.
- ℹ️ The loop is built on `task.spawn` and `task.wait` and does **not** connect to `RenderStepped` or `Heartbeat`.
- ℹ️ When tasks run out, the loop keeps quietly spinning and waiting for new ones. You can stop it with `Stop()`.

### `scheduler:Stop()`

**What it does:** stops the background loop. Tasks **stay** in the queue, and you can continue them with `Start()` or `Step()`.

### `scheduler:Step(budget?)`

**What it does:** runs tasks **once, right now**, until the budget runs out.

**Returns:** `number` - how many tasks were started or continued.

```lua
RunService.Heartbeat:Connect(function()
	canvas.async:Step(0.001)
end)
```

**All outcomes:**

- ✅ Tasks run by priority.
- ⏱️ The budget is checked **between** tasks. The first task always runs, even if it is long.
- 🛑 At most `max_tasks_per_step` tasks run in one step.
- 0️⃣ The queue is empty - returns `0`.

## Long tasks and pauses

The scheduler **cannot** stop a task in the middle of its work. If a task is long, split it into pieces and say "I'll wait" between them.

### `Bloom.Async.Yield()`

**What it does:** pauses the current task and lets other tasks run. The task goes back into the queue and later continues from the same place.

```lua
canvas.async:Submit(function()
	for row = 1, canvas.res_y do
		canvas:DrawHorizontalLine(1, row, canvas.res_x, Color4.New32Bit(row % 256, 0, 0))
		if row % 32 == 0 then
			Bloom.Async.Yield()
		end
	end
	canvas:Update()
end)
canvas.async:Start()
```

**All outcomes:**

- ✅ Inside a task - a pause, and the task gets the status `"yielded"`.
- 🚫 Outside a task - the error `Async.Yield must be called from inside a scheduler task`.

> [!CAUTION]
> Inside a task you **must not** use `task.wait()`, `wait()` and other Roblox waits (for example `:WaitForChild()` or `HttpService:GetAsync()`). The task immediately becomes `"failed"` with the error `Task yielded outside Async.Yield(); ...`. For pauses use only `Bloom.Async.Yield()`.

## Task

| Field | What it is |
|-------|------------|
| `job.state` | Status (see the table below) |
| `job.priority` | Priority |
| `job.submitted_at`, `job.started_at`, `job.finished_at` | Time by `os.clock()` |
| `job.deadline` | Deadline |
| `job.error` | Error text, if the task failed |

| Status | Meaning |
|--------|---------|
| `"pending"` | Waiting in the queue |
| `"running"` | Running right now |
| `"yielded"` | Paused after `Yield()`, waiting to continue |
| `"completed"` | Done ✓ |
| `"cancelled"` | Cancelled ✗ |
| `"failed"` | Failed with an error 💥 |

### `job:Cancel()`

**What it does:** cancels the task.

**All outcomes:**

- ✅ The task is waiting (`pending`) or paused (`yielded`) - it becomes `"cancelled"` and does not run.
- 💤 The task is already done, failed or cancelled - nothing happens.
- ⚠️ The task is running right now - it cannot be cancelled.

### `job:IsCancelled()` and `job:IsFinished()`

**What it does:** quickly tells whether the task is cancelled and whether it has ended.

- `IsCancelled()` → `true` if the status is `"cancelled"`.
- `IsFinished()` → `true` if the status is `"completed"`, `"cancelled"` or `"failed"`.

## Errors in tasks

If a task raises an error:

- ✅ The scheduler **does not break** and runs the other tasks.
- 📝 The task gets `state = "failed"`, and `job.error` holds the error text.
- ⚠️ The console shows `[Bloom.Async] Task failed: ...`.

## Cleanup and counters

### `scheduler:Clear()`

**What it does:** cancels **all** tasks in the queue.

**All outcomes:** ✅ all waiting and paused tasks become `"cancelled"`. ⚠️ A task that is running right now stops only at its next `Yield()`.

### `scheduler:PendingCount()`

**Returns:** how many tasks are waiting or paused.

### `scheduler:GetStats()`

**Returns:** a copy of the counters.

| Field | What it is |
|-------|------------|
| `pending` | Waiting |
| `active` | Running now |
| `completed` | Done in total |
| `failed` | Failed in total |
| `cancelled` | Cancelled in total |
| `last_step_seconds` | How long the last step took |
| `max_step_seconds` | The longest step |

### `scheduler:Destroy()`

**What it does:** `Stop()` and `Clear()` together. `canvas:Destroy()` calls it by itself.

> [!NOTE]
> The scheduler does **not** make work parallel on several cores. It only shares time fairly. Do not draw on one canvas from different `Actor`s at the same time.

Next: [Stage pipeline →](11-pipeline.md)
