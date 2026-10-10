/**
 * dsh-schedule-viewer — Host half (cordis mode).
 *
 * Reads the DSH schedule storage (~/.dsh/storages/schedule.json) and the
 * session-manager delegation ledger (~/.dsh/session-manager/state.json),
 * then serves parsed data to the client half via RPC.
 *
 * RPC methods:
 *   - schedules-list   → all scheduled tasks with metadata
 *   - delegations-list → recent session delegations (optional section)
 *
 * @module src/host.js
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// ── Storage paths ─────────────────────────────────────────────────────────

const DSH_HOME = () => {
  const configured = typeof process === 'object' && process !== null && typeof process.env === 'object' && process.env !== null ? process.env.DSH_HOME : undefined
  return typeof configured === 'string' && configured.length > 0 ? configured : join(homedir(), '.dsh')
}

const SCHEDULE_PATH = () => join(DSH_HOME(), 'storages', 'schedule.json')
const DELEGATION_PATH = () => join(DSH_HOME(), 'session-manager', 'state.json')

// ── Helpers ───────────────────────────────────────────────────────────────

const messageOf = (error) =>
  error !== null && typeof error === 'object' && typeof error.message === 'string'
    ? error.message
    : String(error)

const shortId = (id) =>
  typeof id === 'string' && id.length > 24
    ? `…${id.slice(-12)}`
    : (id || '?')

/** Human-readable frequency label. */
const formatFrequency = (record) => {
  const kind = record?.kind
  if (kind === 'every') {
    const seconds = record.everySeconds
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)}d`
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h${seconds % 3600 > 0 ? ` ${Math.floor((seconds % 3600) / 60)}m` : ''}`
    if (seconds >= 60) return `${Math.floor(seconds / 60)}m${seconds % 60 > 0 ? ` ${seconds % 60}s` : ''}`
    return `${seconds}s`
  }
  if (kind === 'after') {
    const seconds = record.afterSeconds
    if (seconds >= 3600) return `after ${Math.floor(seconds / 3600)}h`
    if (seconds >= 60) return `after ${Math.floor(seconds / 60)}m`
    return `after ${seconds}s`
  }
  if (kind === 'daily') return 'daily'
  if (kind === 'weekly') return 'weekly'
  if (kind === 'cron') return 'cron'
  return kind || 'unknown'
}

/** Compute next trigger time for an active schedule. */
const computeNextTrigger = (record) => {
  const scheduledAt = record?.scheduledAt
  if (!scheduledAt) return null
  const base = new Date(scheduledAt)
  if (isNaN(base.getTime())) return null

  const now = Date.now()
  if (record.kind === 'every') {
    const intervalMs = (record.everySeconds || 0) * 1000
    if (intervalMs <= 0) return null
    let next = base.getTime() + intervalMs
    while (next <= now) next += intervalMs
    return new Date(next).toISOString()
  }
  if (record.kind === 'after') {
    return new Date(base.getTime()).toISOString()
  }
  if (record.kind === 'daily') {
    const d = new Date()
    d.setUTCHours(...(record.time || [0, 0, 0, 0]))
    if (d.getTime() <= now) d.setUTCDate(d.utcDate() + 1)
    return d.toISOString()
  }
  return scheduledAt
}

/** Extract a short prompt summary (first line / first 120 chars). */
const summarizePrompt = (prompt) => {
  if (typeof prompt !== 'string' || prompt.length === 0) return ''
  const lines = prompt.split('\n')
  if (lines.length === 1) return prompt.length > 120 ? prompt.slice(0, 120) + '…' : prompt
  return lines[0].length > 120 ? lines[0].slice(0, 120) + '…' : lines[0]
}

/** Parse a relative time to a human-friendly label. */
const relativeTime = (isoString) => {
  if (!isoString) return '—'
  const diff = Date.now() - new Date(isoString).getTime()
  if (isNaN(diff)) return isoString
  const abs = Math.abs(diff)
  const sign = diff > 0 ? '前' : '后'
  const sec = Math.round(abs / 1000)
  if (sec < 60) return `${sec}秒${sign}`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}分钟${sign}`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}小时${sign}`
  const day = Math.round(hr / 24)
  return `${day}天${sign}`
}

// ── Data readers ──────────────────────────────────────────────────────────

/**
 * Read and parse the schedule storage file.
 * @returns {{ ok: boolean, tasks: Array, error?: string }}
 */
function readSchedules() {
  try {
    const raw = readFileSync(SCHEDULE_PATH(), 'utf8')
    const data = JSON.parse(raw)
    const tasksTable = data?.tables?.tasks
    if (tasksTable === null || tasksTable === undefined || typeof tasksTable !== 'object') {
      return { ok: true, tasks: [] }
    }

    const tasks = []
    for (const [id, entry] of Object.entries(tasksTable)) {
      const record = entry?.record
      if (record === null || record === undefined || typeof record !== 'object') continue

      const kind = record.kind || 'unknown'
      const status = entry.status || 'unknown'
      const frequency = formatFrequency(record)
      const nextTrigger = status === 'active' ? computeNextTrigger(record) : null
      const lastDelivery = entry?.lastDelivery?.deliveredAt || null
      const deliveryCount = entry?.deliveryHistory?.records?.length || 0

      tasks.push({
        id,
        title: record.title || '(no title)',
        kind,
        status,
        frequency,
        scheduledAt: record.scheduledAt || null,
        nextTrigger,
        lastDelivery,
        lastDeliveryRelative: lastDelivery ? relativeTime(lastDelivery) : null,
        deliveryCount,
        prompt: record.prompt || '',
        promptSummary: summarizePrompt(record.prompt || ''),
        sessionId: entry.sessionId || null,
      })
    }

    // Sort: active first, then by scheduledAt descending
    tasks.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1
      if (a.status !== 'active' && b.status === 'active') return 1
      return (b.scheduledAt || '').localeCompare(a.scheduledAt || '')
    })

    return { ok: true, tasks }
  } catch (error) {
    return { ok: false, tasks: [], error: messageOf(error) }
  }
}

/**
 * Read and parse the delegation ledger.
 * @returns {{ ok: boolean, delegations: Array, error?: string }}
 */
function readDelegations() {
  try {
    const raw = readFileSync(DELEGATION_PATH(), 'utf8')
    const data = JSON.parse(raw)
    const delegations = data?.delegations
    if (!Array.isArray(delegations)) {
      return { ok: true, delegations: [] }
    }

    // Return newest 30, with a summary
    const recent = delegations.slice(0, 30).map((d) => ({
      id: d.id || '?',
      shortId: shortId(d.id),
      from: d.from || '?',
      fromShort: shortId(d.from),
      to: d.to || '?',
      toShort: shortId(d.to),
      status: d.status || 'unknown',
      task: d.task || '',
      taskSummary: summarizePrompt(d.task || ''),
      replySummary: summarizePrompt(d.reply || ''),
      createdAt: d.createdAt || null,
      settledAt: d.settledAt || null,
      note: d.note || '',
    }))

    const stats = {
      total: delegations.length,
      pending: delegations.filter(d => d.status === 'pending').length,
      done: delegations.filter(d => d.status === 'done').length,
      failed: delegations.filter(d => d.status === 'failed').length,
      unknown: delegations.filter(d => d.status === 'unknown').length,
    }

    return { ok: true, delegations: recent, stats }
  } catch (error) {
    return { ok: false, delegations: [], stats: null, error: messageOf(error) }
  }
}

// ── Main export ───────────────────────────────────────────────────────────

export default {
  name: 'schedule-viewer',

  apply(ctx) {
    const logger = () => ctx.logger ?? { info: () => {}, warn: () => {}, error: () => {} }

    // ── RPC handlers ──────────────────────────────────────────────────────

    harness.handle('schedules-list', async (_args) => {
      try {
        const result = readSchedules()
        return result
      } catch (e) {
        return { ok: false, tasks: [], error: messageOf(e) }
      }
    })

    harness.handle('delegations-list', async (_args) => {
      try {
        const result = readDelegations()
        return result
      } catch (e) {
        return { ok: false, delegations: [], stats: null, error: messageOf(e) }
      }
    })

    console.log('[schedule-viewer] host applied; RPC handlers registered')
  },
}