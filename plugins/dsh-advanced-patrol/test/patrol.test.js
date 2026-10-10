/**
 * Tests for dsh-advanced-patrol host logic.
 *
 * Uses a mock cordis context to test:
 *   - Preset validation and rendering
 *   - Interval parsing
 *   - Session state management (start/stop/status)
 *   - RPC handlers (patrol-start, patrol-stop, patrol-status, etc.)
 *   - LLM prompt invocation via mock controller
 *
 * @module test/patrol.test.js
 */

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// ── Mock context ──────────────────────────────────────────────────────────

const mockPromptCalls = []
const mockPrompt = async (request, signal) => {
  mockPromptCalls.push({ request, signal })
  return { ok: true }
}

const mockTimer = {
  interval(callback, ms) {
    const id = setInterval(callback, ms)
    return () => clearInterval(id)
  },
  timeout(ms) {
    return new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error('timeout')), ms)
    })
  },
}

const mockSessions = {
  current: () => ({ id: 'test-session-001' }),
}

/**
 * Create a mock cordis context with a harness mock that captures
 * harness.handle() registrations and exposes them via the returned
 * `handled` map for direct invocation in tests.
 */
function createMockCtx(overrides = {}) {
  const handled = {}
  const effects = []

  // Provide a mock harness global so host.js's harness.handle() works.
  globalThis.harness = {
    handle(method, handler) {
      handled[method] = handler
    },
    call() {
      return Promise.resolve({ ok: true })
    },
  }

  const ctx = {
    get(name) {
      if (name === 'sessionController') return { prompt: mockPrompt }
      if (name === 'agents') return { get: (id) => ({ id, name: 'mock' }) }
      if (name === 'timer') return mockTimer
      if (name === 'sessions') return mockSessions
      return undefined
    },
    handle(method, handler) {
      handled[method] = handler
    },
    effect(fn, label) {
      const result = fn()
      effects.push({ fn, result, label })
      return result
    },
    logger: { info() {}, warn() {}, error() {}, debug() {}, log() {} },
    ...overrides,
  }

  return { ctx, handled, effects }
}

// ── Import host module ────────────────────────────────────────────────────

let hostPlugin
let resetState

test('load host module', async () => {
  const mod = await import('../src/host.js')
  hostPlugin = mod.default
  resetState = mod.__reset
  assert.ok(hostPlugin, 'host plugin should export a default object')
  assert.equal(typeof hostPlugin.apply, 'function')
  assert.equal(typeof resetState, 'function')
})

// Reset state between tests
beforeEach(() => {
  if (resetState) resetState()
  mockPromptCalls.length = 0
})

// ── Preset validation ─────────────────────────────────────────────────────

test('patrol-presets returns all 4 presets', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  const r = await handled['patrol-presets']({})
  assert.equal(r.ok, true)
  assert.equal(r.presets.length, 4)
  assert.ok(r.presets.some(p => p.name === 'standard-patrol'))
  assert.ok(r.presets.some(p => p.name === 'context-review'))
  assert.ok(r.presets.some(p => p.name === 'knowledge-entry'))
  assert.ok(r.presets.some(p => p.name === 'stuck-rescue'))
})

test('patrol-start with invalid preset returns error', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  const r = await handled['patrol-start']({
    sessionId: 'test-001',
    interval: '60',
    preset: 'nonexistent-preset',
  })
  assert.equal(r.ok, false)
  assert.ok(r.error.includes('unknown preset'))
})

test('patrol-start with invalid interval returns error', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  const r = await handled['patrol-start']({
    sessionId: 'test-001',
    interval: 'abc',
    preset: 'standard-patrol',
  })
  assert.equal(r.ok, false)
  assert.ok(r.error.includes('invalid interval'))
})

test('patrol-start with empty sessionId returns error', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  const r = await handled['patrol-start']({ sessionId: '' })
  assert.equal(r.ok, false)
  assert.ok(r.error.includes('sessionId required'))
})

// ── Start / Stop ──────────────────────────────────────────────────────────

test('patrol-start starts a session', async () => {
  mockPromptCalls.length = 0
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  const r = await handled['patrol-start']({
    sessionId: 'test-001',
    interval: '60',
    preset: 'standard-patrol',
  })
  assert.equal(r.ok, true)
  assert.equal(r.status, 'started')
  assert.equal(r.intervalMs, 60000)
  assert.equal(r.preset, 'standard-patrol')
})

test('patrol-start twice with same interval returns already-running', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  await handled['patrol-start']({ sessionId: 'test-001', interval: '60', preset: 'standard-patrol' })
  const r = await handled['patrol-start']({ sessionId: 'test-001', interval: '60', preset: 'standard-patrol' })
  assert.equal(r.ok, true)
  assert.equal(r.status, 'already-running')
})

test('patrol-start with different interval returns updated', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  await handled['patrol-start']({ sessionId: 'test-001', interval: '60', preset: 'standard-patrol' })
  const r = await handled['patrol-start']({ sessionId: 'test-001', interval: '120', preset: 'standard-patrol' })
  assert.equal(r.ok, true)
  assert.equal(r.status, 'updated')
})

test('patrol-stop stops a running session', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  await handled['patrol-start']({ sessionId: 'test-001', interval: '60', preset: 'standard-patrol' })
  const r = await handled['patrol-stop']({ sessionId: 'test-001' })
  assert.equal(r.ok, true)
  assert.equal(r.stopped, true)
})

test('patrol-stop on non-running session returns false', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  const r = await handled['patrol-stop']({ sessionId: 'test-999' })
  assert.equal(r.ok, true)
  assert.equal(r.stopped, false)
})

// ── Status ────────────────────────────────────────────────────────────────

test('patrol-status returns status text', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  await handled['patrol-start']({ sessionId: 'test-001', interval: '60', preset: 'standard-patrol' })
  const r = await handled['patrol-status']({ sessionId: 'test-001' })
  assert.equal(r.ok, true)
  assert.ok(r.text.includes('运行中'))
  assert.ok(r.text.includes('1m'))
})

test('patrol-status for stopped session returns not-running', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  const r = await handled['patrol-status']({ sessionId: 'test-999' })
  assert.equal(r.ok, true)
  assert.ok(r.text.includes('当前没有运行中的巡检'))
})

// ── Preset switching ─────────────────────────────────────────────────────

test('patrol-preset switches preset for running session', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  await handled['patrol-start']({ sessionId: 'test-001', interval: '60', preset: 'standard-patrol' })
  const r = await handled['patrol-preset']({ sessionId: 'test-001', preset: 'stuck-rescue' })
  assert.equal(r.ok, true)
  assert.equal(r.preset, 'stuck-rescue')
  assert.ok(r.text.includes('卡住脱困'))
})

test('patrol-preset with invalid preset returns error', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  const r = await handled['patrol-preset']({ sessionId: 'test-001', preset: 'bad' })
  assert.equal(r.ok, false)
  assert.ok(r.error.includes('unknown preset'))
})

// ── Interval update ──────────────────────────────────────────────────────

test('patrol-interval updates interval for running session', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  await handled['patrol-start']({ sessionId: 'test-001', interval: '60', preset: 'standard-patrol' })
  const r = await handled['patrol-interval']({ sessionId: 'test-001', interval: '180' })
  assert.equal(r.ok, true)
  assert.equal(r.intervalMs, 180000)
  assert.ok(r.text.includes('3m'))
})

test('patrol-interval on non-running session returns error', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  const r = await handled['patrol-interval']({ sessionId: 'test-999', interval: '60' })
  assert.equal(r.ok, false)
  assert.ok(r.error.includes('not running'))
})

// ── Tick (LLM prompt) ────────────────────────────────────────────────────

test('patrol-tick invokes LLM prompt with rendered preset', async () => {
  mockPromptCalls.length = 0
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  await handled['patrol-start']({ sessionId: 'test-001', interval: '60', preset: 'standard-patrol' })
  const r = await handled['patrol-tick']({ sessionId: 'test-001' })
  assert.equal(r.ok, true)
  assert.equal(r.prompted, true)
  assert.equal(r.round, 1)
  assert.equal(r.preset, 'standard-patrol')
  assert.equal(mockPromptCalls.length, 1)
  assert.equal(mockPromptCalls[0].request.mode, 'queue')
  assert.equal(mockPromptCalls[0].request.sessionId, 'test-001')
  assert.ok(mockPromptCalls[0].request.content[0].text.includes('高级巡检'))
  assert.ok(mockPromptCalls[0].request.content[0].text.includes('第 1 轮'))
})

test('patrol-tick on stopped session returns not-running', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  const r = await handled['patrol-tick']({ sessionId: 'test-999' })
  assert.equal(r.ok, true)
  assert.equal(r.prompted, false)
  assert.equal(r.reason, 'not-running')
})

test('patrol-tick with missing sessionId returns error', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  const r = await handled['patrol-tick']({})
  assert.equal(r.ok, false)
  assert.ok(r.error.includes('sessionId required'))
})

// ── Interval parsing edge cases ───────────────────────────────────────────

test('interval below minimum returns error', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  const r = await handled['patrol-start']({ sessionId: 'test-001', interval: '5', preset: 'standard-patrol' })
  assert.equal(r.ok, false)
  assert.ok(r.error.includes('invalid interval'))
})

test('interval above maximum returns error', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  const r = await handled['patrol-start']({ sessionId: 'test-001', interval: '99999999', preset: 'standard-patrol' })
  assert.equal(r.ok, false)
  assert.ok(r.error.includes('invalid interval'))
})

test('empty interval uses default 120s', async () => {
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  const r = await handled['patrol-start']({ sessionId: 'test-001', interval: '', preset: 'standard-patrol' })
  assert.equal(r.ok, true)
  assert.equal(r.intervalMs, 120000)
})

// ── Multiple sessions isolation ──────────────────────────────────────────

test('two sessions can run patrol independently', async () => {
  mockPromptCalls.length = 0
  const { ctx, handled } = createMockCtx()
  hostPlugin.apply(ctx)

  await handled['patrol-start']({ sessionId: 'session-A', interval: '60', preset: 'standard-patrol' })
  await handled['patrol-start']({ sessionId: 'session-B', interval: '120', preset: 'stuck-rescue' })

  const statusA = await handled['patrol-status']({ sessionId: 'session-A' })
  const statusB = await handled['patrol-status']({ sessionId: 'session-B' })

  assert.ok(statusA.text.includes('1m'))
  assert.ok(statusA.text.includes('standard-patrol'))
  assert.ok(statusB.text.includes('2m'))
  assert.ok(statusB.text.includes('stuck-rescue'))

  await handled['patrol-stop']({ sessionId: 'session-A' })
  const statusAAfter = await handled['patrol-status']({ sessionId: 'session-A' })
  assert.ok(statusAAfter.text.includes('当前没有运行中的巡检'))

  const statusBAfter = await handled['patrol-status']({ sessionId: 'session-B' })
  assert.ok(statusBAfter.text.includes('运行中'))
})