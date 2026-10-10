
const str = (v) => (v === undefined || v === null ? null : String(v))

const blocksText = (content) => {
  if (content === undefined || content === null) return ''
  const arr = Array.isArray(content) ? content : [content]
  const parts = []
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i]
    if (!b || typeof b !== 'object') continue
    if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
    else if (b.type === 'tool-call') parts.push('[tool] ' + String(b.name || 'tool'))
  }
  return parts.join('\n')
}

// The Cordis host does not hand an AbortSignal into harness.handle callbacks, so
// the platform cannot cancel a queued prompt by itself. These are live signals
// the plugin owns and can flip, keyed by requestId in liveSignals.
// Whether sessionController.prompt actually honours them depends on the runtime
// inspecting `aborted` during the call, which this repository cannot verify.
const liveSignals = {}

function makeSignal() {
  let aborted = false
  const listeners = []
  return {
    get aborted() { return aborted },
    reason: undefined,
    onabort: null,
    addEventListener: function (type, fn) {
      if (type === 'abort' && typeof fn === 'function') listeners.push(fn)
    },
    removeEventListener: function (type, fn) {
      if (type !== 'abort') return
      const i = listeners.indexOf(fn)
      if (i >= 0) listeners.splice(i, 1)
    },
    dispatchEvent: function () { return true },
    throwIfAborted: function () {
      if (aborted) throw new Error('aborted')
    },
    abort: function () {
      if (aborted) return
      aborted = true
      const copy = listeners.slice()
      for (let i = 0; i < copy.length; i++) {
        try { copy[i]() } catch (e) {}
      }
    },
  }
}

const fail = (e) => ({ ok: false, error: String((e && e.message) || e || 'unknown error') })

const SKIP = { node_modules: true, '.git': true, '.cache': true, dist: true, build: true }

const relOf = (rootPath, childPath) => {
  const r = String(rootPath).replace(/\/+$/, '')
  const c = String(childPath)
  if (c === r) return ''
  if (c.indexOf(r + '/') === 0) return c.slice(r.length + 1)
  return c
}

return {
  apply(ctx) {
    const sessionQuery = ctx.get('sessionQuery')
    const sessionController = ctx.get('sessionController')
    const agentPresets = ctx.get('agentPresets')
    const fs = ctx.get('fs')
    let reqSeq = 0

    console.log('[agent-canvas] host apply', {
      sessionQuery: sessionQuery !== undefined,
      sessionController: sessionController !== undefined,
      agentPresets: agentPresets !== undefined,
      fs: fs !== undefined,
    })

    harness.handle('canvas-sessions', async () => {
      if (sessionQuery === undefined) return { ok: false, error: 'sessionQuery service unavailable' }
      try {
        const records = await sessionQuery.listSessions()
        const list = Array.isArray(records) ? records.slice(0, 300) : []
        const items = []
        const ids = []
        for (let i = 0; i < list.length; i++) {
          const rec = list[i]
          const header = rec && rec.header
          if (!header) continue
          const id = String(header.id)
          ids.push(id)
          items.push({
            id: id,
            cwd: str(header.cwd),
            createdAt: typeof header.createdAt === 'number' ? header.createdAt : null,
            parentId: str(header.parentSession),
            origin: str(header.origin),
            live: rec.live === true,
            persisted: rec.persisted === true,
            title: null,
          })
        }
        if (ids.length > 0) {
          try {
            const titles = await sessionQuery.readTitleSnapshots(ids)
            const arr = Array.isArray(titles) ? titles : []
            for (let i = 0; i < arr.length; i++) {
              const t = arr[i]
              if (!t || t.status !== 'fulfilled' || !t.value || !t.value.title) continue
              const title = t.value.title.title
              if (typeof title !== 'string') continue
              const id = String(t.sessionId)
              for (let j = 0; j < items.length; j++) if (items[j].id === id) items[j].title = title
            }
          } catch (e) {
            console.error('[agent-canvas] title fold failed', e)
          }
        }
        return { ok: true, items: items }
      } catch (e) {
        return fail(e)
      }
    })

    harness.handle('canvas-presets', async () => {
      if (agentPresets === undefined) return { ok: true, items: [] }
      try {
        const list = await agentPresets.list()
        const arr = Array.isArray(list) ? list : []
        const items = []
        for (let i = 0; i < arr.length; i++) {
          const p = arr[i]
          if (!p) continue
          const id = str(p.id) || str(p.name)
          if (!id) continue
          items.push({ id: id, name: str(p.name) || id })
        }
        return { ok: true, items: items }
      } catch (e) {
        return fail(e)
      }
    })

    harness.handle('canvas-list-files', async (args) => {
      if (fs === undefined) return { ok: false, error: 'fs service unavailable' }
      if (sessionQuery === undefined) return { ok: false, error: 'sessionQuery service unavailable' }
      if (!args || typeof args.agentId !== 'string' || args.agentId.trim().length === 0) {
        return { ok: false, error: 'agentId required' }
      }
      const maxDepth = typeof args.maxDepth === 'number' && args.maxDepth >= 0 ? Math.min(args.maxDepth, 4) : 2
      const limit = typeof args.limit === 'number' && args.limit > 0 ? Math.min(args.limit, 600) : 200
      try {
        // The caller names an agent, not a path: the working directory is read
        // from that agent's own session record, so no arbitrary location can be
        // reached through this handler.
        const wanted = args.agentId.trim()
        let cwd = null
        const records = await sessionQuery.listSessions()
        const list = Array.isArray(records) ? records : []
        for (let i = 0; i < list.length; i++) {
          const header = list[i] && list[i].header
          if (!header || String(header.id) !== wanted) continue
          cwd = str(header.cwd)
          break
        }
        if (typeof cwd !== 'string' || cwd.trim().length === 0) {
          return { ok: false, error: 'agent has no working directory' }
        }
        const root = await fs.resolve(cwd.trim())
        const rootPath = String(root.displayPath || cwd.trim())
        const out = []
        const queue = [{ target: root, depth: 0 }]
        let truncated = false
        while (queue.length > 0 && out.length < limit) {
          const item = queue.shift()
          let listed
          try {
            listed = await fs.listDir(item.target)
          } catch (e) {
            continue
          }
          const arr = Array.isArray(listed) ? listed : []
          for (let i = 0; i < arr.length; i++) {
            const e = arr[i]
            if (!e) continue
            if (out.length >= limit) { truncated = true; break }
            const name = String(e.name)
            if (SKIP[name] === true) continue
            const childPath = String((e.target && e.target.displayPath) || '')
            if (!childPath) continue
            const isDir = e.type === 'directory'
            out.push({
              path: childPath,
              name: name,
              type: String(e.type),
              size: typeof e.size === 'number' ? e.size : null,
              rel: relOf(rootPath, childPath),
              depth: item.depth + 1,
            })
            if (isDir && item.depth + 1 < maxDepth && e.target) queue.push({ target: e.target, depth: item.depth + 1 })
          }
        }
        return { ok: true, root: rootPath, entries: out, truncated: truncated }
      } catch (e) {
        return fail(e)
      }
    })

    harness.handle('canvas-create-session', async (args) => {
      if (sessionController === undefined) return { ok: false, error: 'sessionController service unavailable' }
      try {
        const req = {}
        if (args && typeof args.cwd === 'string' && args.cwd.trim().length > 0) req.cwd = args.cwd.trim()
        if (args && typeof args.agentPreset === 'string' && args.agentPreset.length > 0) req.agentPreset = args.agentPreset
        const value = await sessionController.create(req)
        return {
          ok: true,
          sessionId: str(value && value.sessionId),
          agentPreset: str(value && value.agentPreset),
          cwd: req.cwd !== undefined ? req.cwd : null,
        }
      } catch (e) {
        return fail(e)
      }
    })

    harness.handle('canvas-fork-session', async (args) => {
      if (sessionController === undefined) return { ok: false, error: 'sessionController service unavailable' }
      try {
        if (!args || typeof args.sessionId !== 'string') return { ok: false, error: 'sessionId required' }
        const value = await sessionController.fork({ sessionId: args.sessionId })
        return { ok: true, sessionId: str(value && value.sessionId) }
      } catch (e) {
        return fail(e)
      }
    })

    harness.handle('canvas-read-session', async (args) => {
      if (sessionQuery === undefined) return { ok: false, error: 'sessionQuery service unavailable' }
      try {
        if (!args || typeof args.sessionId !== 'string') return { ok: false, error: 'sessionId required' }
        const snap = await sessionQuery.readSession(args.sessionId)
        const events = (snap && snap.events) || []
        const start = events.length > 400 ? events.length - 400 : 0
        const messages = []
        for (let i = start; i < events.length; i++) {
          const ev = events[i]
          if (!ev) continue
          const data = ev.data || {}
          if (ev.type === 'user/message') {
            messages.push({ seq: Number(ev.seq), role: 'user', text: blocksText(data.message && data.message.content) })
          } else if (ev.type === 'assistant/message') {
            messages.push({ seq: Number(ev.seq), role: 'assistant', text: blocksText(data.message && data.message.content) })
          } else if (ev.type === 'tool/call') {
            messages.push({ seq: Number(ev.seq), role: 'tool', text: String(data.name || 'tool') })
          }
        }
        return { ok: true, messages: messages, cwd: str(snap && snap.session && snap.session.cwd) }
      } catch (e) {
        return fail(e)
      }
    })

    harness.handle('canvas-send-prompt', async (args) => {
      if (sessionController === undefined) return { ok: false, error: 'sessionController service unavailable' }
      try {
        if (!args || typeof args.sessionId !== 'string' || typeof args.text !== 'string') {
          return { ok: false, error: 'sessionId and text required' }
        }
        reqSeq += 1
        const requestId = 'canvas-' + String(reqSeq)
        const signal = makeSignal()
        liveSignals[requestId] = signal
        const value = await sessionController.prompt(
          {
            requestId: requestId,
            sessionId: args.sessionId,
            mode: args.mode === 'steer' ? 'steer' : 'queue',
            content: [{ type: 'text', text: args.text }],
          },
          signal,
        )
        return { ok: !!(value && value.accepted === true), requestId: requestId, aborted: signal.aborted === true }
      } catch (e) {
        return fail(e)
      }
    })

    harness.handle('canvas-abort-request', async (args) => {
      const requestId = args && typeof args.requestId === 'string' ? args.requestId.trim() : ''
      const signal = liveSignals[requestId]
      if (!signal) return { ok: false, error: 'no such request' }
      signal.abort()
      return { ok: true, requestId: requestId }
    })
  },
}

