/**
 * dsh-advanced-patrol — Host half (cordis mode).
 *
 * Manages per-session patrol timers and invokes LLM patrol rounds via
 * sessionController.prompt(). The client half calls RPC handlers through
 * harness.handle / host.call.
 *
 * @module src/host.js
 */

const DEFAULT_INTERVAL_MS = 1200 * 1000
const MIN_INTERVAL_MS = 30 * 1000
const MAX_INTERVAL_MS = 24 * 60 * 60 * 1000

// ── Preset metadata (inlined for host; no fs needed) ──────────────────────

const PRESETS = {
  'standard-patrol': {
    label: '标准巡检',
    description: '通用巡检：查账本、读回执、查卡住、KB健康',
  },
  'context-review': {
    label: '上下文审查',
    description: '检查上下文完整性、冗余、断层',
  },
  'knowledge-entry': {
    label: '知识录入',
    description: '发现新知识、验证过时信息、检查缺口',
  },
  'stuck-rescue': {
    label: '卡住脱困',
    description: '扫描卡住会话、分析原因、尝试脱困',
  },
}

const DEFAULT_PRESET = 'standard-patrol'

// ── Template bodies (inlined for host) ────────────────────────────────────

const TEMPLATES = {
  'standard-patrol': `你是「高级巡检」模式的会话协调 Agent。现在执行定时巡检（第 {ROUND} 轮，间隔 {INTERVAL} 秒）。

## 巡检流程

1. **读账本**：读 session_delegations，找出本会话发出且 status 为 done/failed 的委托
2. **读回执**：对已结算委托，session_read 读取目标会话的最新回复（只看最后几轮，不要全量读）
3. **检查卡住**：session_list 查看所有会话，找 running 且超过 10 分钟无新进展的会话
4. **知识库健康**：如果发现新知识发现（孤儿节点、悬空引用），记录但不自行修改

## 汇报规则

- 极简汇报：每类发现一行，合并同类项
- 已结算委托：向用户转述回执摘要（3 句以内）
- 卡住会话：报告 sessionId + 已运行时长 + 当前状态
- 无事汇报时保持静默

## 铁律

- 不 dispatch、不 re-deliver、不 session_stop
- 不 dismiss 你拿不准的条目
- 不自行修改知识库
- 所有操作前先确认目标存在
- 不确定的事直接说"不确定"，不要猜`,

  'context-review': `你是「固定上下文审查」模式的会话协调 Agent。现在执行定时巡检（第 {ROUND} 轮，间隔 {INTERVAL} 秒）。

## 巡检流程

1. **上下文完整性**：检查本会话的上下文是否完整——是否有未完成的对话、未处理的工具调用、未回复的用户消息
2. **上下文冗余**：检查是否有重复的工具调用、重复的信息查询
3. **上下文断层**：检查是否有历史轮次被截断或丢失
4. **工具调用验证**：检查最近一轮的工具调用是否正确完成，结果是否被使用

## 汇报规则

- 只报告真正的问题：上下文缺口、冗余调用、未处理消息
- 报告格式：[问题类型] + 具体描述 + 建议修复方式
- 无事汇报时保持静默

## 铁律

- 不自行修改会话上下文
- 不自行压缩或截断会话
- 发现的问题只报告，修复决策交给用户
- 不确定的事直接说"不确定"`,

  'knowledge-entry': `你是「知识录入巡检」模式的会话协调 Agent。现在执行定时巡检（第 {ROUND} 轮，间隔 {INTERVAL} 秒）。

## 巡检流程

1. **知识发现**：检查是否有新知识产生（用户确认的新概念、新工具用法、新配置）
2. **知识验证**：检查现有知识库是否有过时、错误、矛盾的信息
3. **知识整理**：检查是否有重复的知识点、可合并的内容
4. **知识缺口**：检查是否有重要信息未被记录

## 汇报规则

- 发现新知识时：报告知识内容 + 建议分类 + 建议标签
- 发现错误信息时：报告错误内容 + 正确信息 + 来源
- 无事汇报时保持静默

## 铁律

- 不自行修改知识库文件
- 不自行创建或删除知识库节点
- 所有知识变更只报告，由用户或协调者决定
- 知识录入需要用户确认，不要自行录入`,

  'stuck-rescue': `你是「卡住会话脱困」模式的会话协调 Agent。现在执行定时巡检（第 {ROUND} 轮，间隔 {INTERVAL} 秒）。

## 巡检流程

1. **扫描卡住会话**：session_list 查看所有会话，找 running 且超过 5 分钟无新进展的会话
2. **分析原因**：对卡住会话，session_read 读取最近几轮对话，分析卡住原因
3. **尝试脱困**：
   - 如果是工具调用卡住：检查工具调用参数是否正确
   - 如果是 ask_user_question 挂起：尝试提供建议答案
   - 如果是死循环：尝试提供新的方向
4. **报告结果**：向用户报告脱困尝试的结果

## 汇报规则

- 发现卡住会话时：报告 sessionId + 已运行时长 + 卡住原因 + 脱困建议
- 成功脱困时：报告做了什么、结果如何
- 无法脱困时：报告原因 + 建议人工介入
- 无事汇报时保持静默

## 铁律

- 不 session_stop 任何会话（除非用户明确要求）
- 不 session_send 代替用户的输入
- 脱困操作必须是安全的、可逆的
- 不确定的事直接说"不确定"`,
}

// ── Helpers ───────────────────────────────────────────────────────────────

const isValidPreset = (name) => name in PRESETS

const getPresetsDetailed = () =>
  Object.entries(PRESETS).map(([name, meta]) => ({
    name,
    label: meta.label,
    description: meta.description,
  }))

const formatInterval = (ms) => {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m${seconds % 60 > 0 ? ` ${seconds % 60}s` : ''}`
  return `${Math.floor(seconds / 3600)}h${seconds % 3600 > 0 ? ` ${Math.floor((seconds % 3600) / 60)}m` : ''}`
}

const parseInterval = (raw) => {
  const text = String(raw === null || raw === undefined ? '' : raw).trim()
  if (text.length === 0) return DEFAULT_INTERVAL_MS
  if (!/^\d+$/u.test(text)) return null
  const seconds = Number(text)
  if (!Number.isSafeInteger(seconds)) return null
  const ms = seconds * 1000
  if (ms < MIN_INTERVAL_MS || ms > MAX_INTERVAL_MS) return null
  return ms
}

const renderPreset = (name, round, intervalSeconds) => {
  const template = TEMPLATES[name]
  if (!template) return null
  return template
    .replace(/\{ROUND\}/g, String(round))
    .replace(/\{INTERVAL\}/g, String(intervalSeconds))
}

// ── Signal helper ─────────────────────────────────────────────────────────

let requestSeq = 0
const nextRequestId = () => `patrol-${Date.now().toString(36)}-${(++requestSeq).toString(36)}`

const callerSignal = {
  aborted: false,
  throwIfAborted() {},
  addEventListener() {},
  removeEventListener() {},
}

const messageOf = (error) =>
  error !== null && typeof error === 'object' && typeof error.message === 'string'
    ? error.message
    : String(error)

// ── Per-session state ─────────────────────────────────────────────────────

const sessions = new Map()

const getState = (sessionId) => {
  let state = sessions.get(sessionId)
  if (state === undefined) {
    state = {
      sessionId,
      enabled: false,
      preset: DEFAULT_PRESET,
      intervalMs: DEFAULT_INTERVAL_MS,
      round: 0,
      startedAt: 0,
      lastTickAt: 0,
      timer: null,
    }
    sessions.set(sessionId, state)
  }
  return state
}

// ── Timer management ──────────────────────────────────────────────────────

const PATROL_LABEL = 'advanced-patrol: session timer'
const CLEANUP_LABEL = 'advanced-patrol: cleanup'

/**
 * Start or restart the patrol for a session.
 */
function start(sessionId, intervalMs, presetName, deps) {
  const state = getState(sessionId)
  const wasRunning = state.enabled === true
  const hadSameInterval = wasRunning && state.intervalMs === intervalMs

  if (wasRunning && state.timer) {
    try { state.timer() } catch { /* ignore */ }
  }

  if (presetName && isValidPreset(presetName)) {
    state.preset = presetName
  }

  state.intervalMs = intervalMs
  state.enabled = true
  state.startedAt = Date.now()

  const timer = deps.timer
  state.timer = deps.effect
    ? deps.effect(() => timer.interval(() => {
        void runTick(sessionId, deps)
      }, intervalMs), PATROL_LABEL)
    : () => {}

  return { wasRunning, hadSameInterval }
}

/**
 * Stop the patrol for a session.
 */
function stop(sessionId) {
  const state = sessions.get(sessionId)
  if (state === undefined || state.enabled === false) return false
  if (state.timer) {
    try { state.timer() } catch { /* ignore */ }
  }
  state.timer = null
  state.enabled = false
  return true
}

/**
 * Run one patrol tick.
 */
async function runTick(sessionId, deps) {
  const state = sessions.get(sessionId)
  if (state === undefined || state.enabled === false) {
    return { prompted: false, reason: 'not-running' }
  }

  // Check if the session's agent is still alive.
  const agentsValue = deps.agents()
  if (agentsValue === null || agentsValue === undefined || typeof agentsValue.get !== 'function' || agentsValue.get(sessionId) === undefined) {
    stop(sessionId)
    return { prompted: false, reason: 'session-closed' }
  }

  state.round += 1
  state.lastTickAt = Date.now()
  const intervalSeconds = Math.round(state.intervalMs / 1000)

  const text = renderPreset(state.preset, state.round, intervalSeconds)
  if (!text) {
    return { prompted: false, reason: 'preset-render-failed' }
  }

  const ctrl = deps.controller()
  if (ctrl === null || ctrl === undefined || typeof ctrl.prompt !== 'function') {
    return { prompted: false, reason: 'sessionController unavailable' }
  }

  try {
    await ctrl.prompt(
      { requestId: nextRequestId(), sessionId, mode: 'queue', content: [{ type: 'text', text }] },
      callerSignal,
    )
    return { prompted: true, round: state.round, preset: state.preset }
  } catch (error) {
    return { prompted: false, reason: `prompt: ${messageOf(error)}` }
  }
}

/**
 * Get human-readable status.
 */
function status(sessionId) {
  const state = sessions.get(sessionId)
  if (state === undefined || state.enabled === false) {
    return `/patrol: 当前没有运行中的巡检。\n用法：点按钮开启，选择预设和间隔。`
  }
  return [
    `巡检：运行中（${formatInterval(state.intervalMs)} 一轮）`,
    `预设：${state.preset}`,
    `已执行：${state.round} 轮`,
    `上次巡检：${state.lastTickAt > 0 ? new Date(state.lastTickAt).toISOString() : '尚未执行'}`,
    `启动时间：${state.startedAt > 0 ? new Date(state.startedAt).toISOString() : '?'}`,
  ].join('\n')
}

/**
 * Switch preset for a running session.
 */
function switchPreset(sessionId, presetName) {
  const state = sessions.get(sessionId)
  if (state === undefined) return false
  if (!isValidPreset(presetName)) return false
  state.preset = presetName
  return true
}

// ── Main export ───────────────────────────────────────────────────────────

export default {
  name: 'advanced-patrol',

  apply(ctx) {
    const controller = () => ctx.get('sessionController')
    const agents = () => ctx.get('agents')
    const timer = ctx.get('timer')
    const logger = () => ctx.logger ?? { info: () => {}, warn: () => {}, error: () => {} }

    if (timer === null || timer === undefined || typeof timer.interval !== 'function') {
      console.warn('[advanced-patrol] timer service unavailable; plugin disabled')
      return
    }

    const deps = {
      controller,
      agents,
      timer,
      logger,
      effect: typeof ctx.effect === 'function' ? ctx.effect : null,
    }

    // ── RPC handlers ──────────────────────────────────────────────────────

    harness.handle('patrol-start', async (args) => {
      try {
        const sessionId = String(args?.sessionId ?? '')
        if (!sessionId) return { ok: false, error: 'sessionId required' }

        const intervalRaw = args?.interval ?? ''
        const presetName = args?.preset ?? DEFAULT_PRESET
        const intervalMs = parseInterval(intervalRaw)
        if (intervalMs === null) {
          return { ok: false, error: `invalid interval: ${intervalRaw}` }
        }
        if (!isValidPreset(presetName)) {
          return { ok: false, error: `unknown preset: ${presetName}` }
        }

        const outcome = start(sessionId, intervalMs, presetName, deps)
        const presetMeta = PRESETS[presetName]

        if (outcome.wasRunning && outcome.hadSameInterval) {
          return {
            ok: true,
            status: 'already-running',
            text: `巡检已在运行（${formatInterval(intervalMs)} 一轮，预设「${presetMeta?.label ?? presetName}」）`,
          }
        }
        if (outcome.wasRunning) {
          return {
            ok: true,
            status: 'updated',
            text: `已更新巡检间隔为 ${formatInterval(intervalMs)} 一轮`,
          }
        }
        return {
          ok: true,
          status: 'started',
          text: `已启动高级巡检（${formatInterval(intervalMs)} 一轮，预设「${presetMeta?.label ?? presetName}」）`,
          preset: presetName,
          intervalMs,
        }
      } catch (e) {
        return { ok: false, error: messageOf(e) }
      }
    })

    harness.handle('patrol-stop', async (args) => {
      try {
        const sessionId = String(args?.sessionId ?? '')
        if (!sessionId) return { ok: false, error: 'sessionId required' }
        const stopped = stop(sessionId)
        return {
          ok: true,
          stopped,
          text: stopped ? '已停止巡检' : '当前没有运行中的巡检',
        }
      } catch (e) {
        return { ok: false, error: messageOf(e) }
      }
    })

    harness.handle('patrol-status', async (args) => {
      try {
        const sessionId = String(args?.sessionId ?? '')
        if (!sessionId) return { ok: false, error: 'sessionId required' }
        const text = status(sessionId)
        return { ok: true, text }
      } catch (e) {
        return { ok: false, error: messageOf(e) }
      }
    })

    harness.handle('patrol-preset', async (args) => {
      try {
        const sessionId = String(args?.sessionId ?? '')
        const presetName = String(args?.preset ?? '')
        if (!sessionId) return { ok: false, error: 'sessionId required' }
        if (!isValidPreset(presetName)) return { ok: false, error: `unknown preset: ${presetName}` }
        const ok = switchPreset(sessionId, presetName)
        if (!ok) return { ok: false, error: 'session not found' }
        const meta = PRESETS[presetName]
        return {
          ok: true,
          text: `已切换为「${meta?.label ?? presetName}」`,
          preset: presetName,
        }
      } catch (e) {
        return { ok: false, error: messageOf(e) }
      }
    })

    harness.handle('patrol-interval', async (args) => {
      try {
        const sessionId = String(args?.sessionId ?? '')
        const intervalRaw = args?.interval ?? ''
        if (!sessionId) return { ok: false, error: 'sessionId required' }
        const intervalMs = parseInterval(intervalRaw)
        if (intervalMs === null) return { ok: false, error: `invalid interval: ${intervalRaw}` }

        const state = sessions.get(sessionId)
        if (state?.enabled !== true) return { ok: false, error: 'patrol not running' }

        const preset = state.preset
        stop(sessionId)
        start(sessionId, intervalMs, preset, deps)
        return {
          ok: true,
          text: `已更新为 ${formatInterval(intervalMs)} 一轮`,
          intervalMs,
        }
      } catch (e) {
        return { ok: false, error: messageOf(e) }
      }
    })

    harness.handle('patrol-presets', async () => {
      return { ok: true, presets: getPresetsDetailed() }
    })

    harness.handle('patrol-tick', async (args) => {
      try {
        const sessionId = String(args?.sessionId ?? '')
        if (!sessionId) return { ok: false, error: 'sessionId required' }
        const result = await runTick(sessionId, deps)
        return { ok: true, ...result }
      } catch (e) {
        return { ok: false, error: messageOf(e) }
      }
    })

    // ── Cleanup ───────────────────────────────────────────────────────────

    if (typeof ctx.effect === 'function') {
      ctx.effect(() => () => {
        for (const state of sessions.values()) {
          if (state.timer) {
            try { state.timer() } catch { /* ignore */ }
          }
        }
        sessions.clear()
      }, CLEANUP_LABEL)
    }

    console.log('[advanced-patrol] host applied; RPC handlers registered')
  },
}

// ── Test-only reset ───────────────────────────────────────────────────────

export function __reset() {
  for (const state of sessions.values()) {
    if (state.timer) {
      try { state.timer() } catch { /* ignore */ }
    }
  }
  sessions.clear()
}