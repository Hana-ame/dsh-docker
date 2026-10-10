
const h = React.createElement

const PANEL_ID = 'agent-canvas'
const AGENT_SIZE = 56
const FILE_W = 200
const FILE_H = 44
const ROW_PER_COL = 6
const CONTENT_W = 4200
const CONTENT_H = 3200
const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

const CSS = [
  '.acx-root{position:relative;flex:1 1 auto;height:100%;min-height:0;width:100%;overflow:hidden;background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-primary,inherit);font-size:13px;line-height:1.45}',
  '.acx-canvas{position:absolute;inset:0;z-index:1;overflow:hidden;cursor:grab;touch-action:none;background-color:var(--dsw-alias-bg-base,transparent);background-image:radial-gradient(var(--dsw-alias-border-l1,rgba(127,127,127,.35)) 1px,transparent 1px);background-size:22px 22px}',
  '.acx-canvas[data-panning=1]{cursor:grabbing}',
  '.acx-content{position:absolute;left:0;top:0;width:4200px;height:3200px}',
  '.acx-edges{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}',
  '.acx-bar{position:absolute;top:8px;left:8px;right:8px;z-index:12;display:flex;align-items:center;gap:6px;padding:6px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:12px;background:var(--dsw-alias-button-floating-fill,var(--dsw-alias-bg-overlay,transparent));backdrop-filter:blur(12px);flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}',
  '.acx-bar::-webkit-scrollbar{height:0}',
  '.acx-bar b{font-size:12.5px;font-weight:600;white-space:nowrap;flex:none}',
  '.acx-btn{display:inline-flex;align-items:center;gap:5px;flex:none;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.4));background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit);border-radius:8px;padding:4px 10px;font:inherit;font-size:12px;line-height:1.5;cursor:pointer;white-space:nowrap}',
  '.acx-btn:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-3,transparent))}',
  '.acx-btn[disabled]{opacity:.45;cursor:default}',
  '.acx-primary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#4d6bfe));border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}',
  '.acx-primary:hover:not([disabled]){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#4d6bfe));color:var(--dsw-alias-label-primary-foreground,#fff)}',
  '.acx-danger{color:var(--dsw-alias-state-error-primary,inherit);border-color:var(--dsw-alias-state-error-primary,currentColor)}',
  '.acx-danger:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover-danger,transparent);color:var(--dsw-alias-state-error-primary,inherit)}',
  '.acx-spacer{flex:1 1 auto}',
  '.acx-mini{flex:none;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;font:inherit;font-size:11px;padding:1px 5px;border-radius:6px}',
  '.acx-mini:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-3,transparent));color:var(--dsw-alias-label-primary,inherit)}',
  '.acx-form{position:absolute;left:8px;right:8px;bottom:8px;z-index:18;max-height:62%;overflow:auto;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));box-shadow:0 12px 32px rgba(0,0,0,.28);padding:12px;display:flex;flex-direction:column;gap:9px}',
  '.acx-form-title{font-weight:600;font-size:13px}',
  '.acx-dock{position:absolute;top:8px;right:8px;bottom:8px;z-index:16;width:min(376px,46%);display:flex;flex-direction:column;min-height:0;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));box-shadow:0 12px 32px rgba(0,0,0,.28);overflow:hidden}',
  '.acx-sheet{position:absolute;left:8px;right:8px;bottom:8px;z-index:20;max-height:58%;overflow:auto;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));box-shadow:0 12px 32px rgba(0,0,0,.28);padding:12px;font-size:12px;line-height:1.55}',
  '.acx-sheet-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
  '.acx-sheet-head b{flex:1;font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.acx-file{position:absolute;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));background:var(--dsw-alias-bg-layer-1,transparent);border-radius:9px;padding:6px 8px;display:flex;flex-direction:column;gap:2px;overflow:hidden;cursor:grab;user-select:none;touch-action:none}',
  '.acx-file[data-selected=1]{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:1px}',
  '.acx-file[data-new=1]{border-color:var(--dsw-alias-state-success-primary,#2ea043)}',
  '.acx-file[data-dragging=1]{cursor:grabbing;z-index:4;box-shadow:0 10px 24px rgba(0,0,0,.22)}',
  '.acx-file[data-kind=dir] .acx-fname{font-weight:600}',
  '.acx-fname{font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.acx-fmeta{font-size:10px;color:var(--dsw-alias-label-secondary,inherit);display:flex;align-items:center;gap:5px;min-width:0}',
  '.acx-agent{position:absolute;width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));background:var(--dsw-alias-bg-layer-1,transparent);cursor:grab;user-select:none;box-sizing:border-box;touch-action:none}',
  '.acx-agent>span{font-size:15px;font-weight:600}',
  '.acx-agent[data-selected=1]{box-shadow:0 0 0 3px var(--dsw-alias-brand-primary,rgba(77,107,254,.55))}',
  '.acx-agent[data-dragging=1]{cursor:grabbing;z-index:5;opacity:.92}',
  '.acx-agent-label{position:absolute;top:58px;left:-18px;width:92px;text-align:center;font-size:10.5px;color:var(--dsw-alias-label-secondary,inherit);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.acx-dot{position:absolute;right:0;top:0;width:11px;height:11px;border-radius:50%;border:2px solid var(--dsw-alias-bg-base,transparent)}',
  '.acx-badge{position:absolute;left:-4px;top:-4px;min-width:16px;height:16px;border-radius:8px;background:var(--dsw-alias-state-success-primary,#2ea043);color:var(--dsw-alias-label-primary-inverted,#fff);font-size:10px;display:flex;align-items:center;justify-content:center;padding:0 4px}',
  '.acx-hover{position:absolute;width:320px;box-sizing:border-box;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:12px;padding:10px;font-size:11.5px;line-height:1.5;z-index:20;box-shadow:0 12px 32px rgba(0,0,0,.28);pointer-events:none}',
  '.acx-hsect{margin-top:6px;padding-top:6px;border-top:1px dashed var(--dsw-alias-border-l2,rgba(127,127,127,.3))}',
  '.acx-hlab{color:var(--dsw-alias-label-secondary,inherit);font-size:10px}',
  '.acx-mono{font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);font-size:10px;word-break:break-all;color:var(--dsw-alias-label-secondary,inherit)}',
  '.acx-flist{display:flex;flex-direction:column;gap:1px;max-height:104px;overflow:hidden}',
  '.acx-frow{font-size:10.5px;display:flex;gap:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
  '.acx-dock-head{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));font-weight:600;font-size:12.5px;flex:none}',
  '.acx-chips{display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:7px 10px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));flex:none}',
  '.acx-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:999px;padding:1px 8px;font-size:11px;background:var(--dsw-alias-bg-layer-1,transparent)}',
  '.acx-log{flex:1 1 auto;min-height:0;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:8px}',
  '.acx-msg{border-radius:9px;padding:6px 9px;font-size:12px;white-space:pre-wrap;word-break:break-word;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3))}',
  '.acx-msg[data-role=user]{background:var(--dsw-alias-bg-layer-1,transparent);align-self:flex-end;max-width:92%}',
  '.acx-msg[data-role=assistant]{background:transparent;max-width:96%}',
  '.acx-msg[data-role=tool]{font-size:11px;color:var(--dsw-alias-label-secondary,inherit);border-style:dashed;max-width:96%}',
  '.acx-msg[data-live=1]{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}',
  '.acx-compose{border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));padding:9px;display:flex;flex-direction:column;gap:7px;flex:none}',
  '.acx-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}',
  '.acx-res{font-size:11px;display:flex;flex-direction:column;gap:3px;max-height:88px;overflow:auto}',
  '.acx-ok{color:var(--dsw-alias-state-success-primary,#2ea043)}',
  '.acx-err{color:var(--dsw-alias-state-error-primary,#d54941)}',
  '.acx-warn{color:var(--dsw-alias-state-warn-primary,inherit)}',
  '.acx-hint{font-size:11.5px;color:var(--dsw-alias-label-secondary,inherit);line-height:1.5}',
  '.acx-ta{width:100%;min-height:72px;box-sizing:border-box;resize:vertical;background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit);border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:9px;padding:8px;font:inherit;font-size:12.5px}',
  '.acx-ta::placeholder,.acx-inp::placeholder{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));opacity:.85}',
  '.acx-inp{background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit);border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:8px;padding:5px 8px;font:inherit;font-size:12px;box-sizing:border-box;flex:1 1 140px;min-width:0}',
  '.acx-sel{background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit);border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:8px;padding:5px 7px;font:inherit;font-size:12px;box-sizing:border-box}',
  '.acx-btns{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
  '.acx-slist{display:flex;flex-direction:column;gap:5px;max-height:240px;overflow:auto;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:9px;padding:6px}',
  '.acx-srow{display:flex;flex-direction:column;gap:2px;padding:6px 9px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:9px;cursor:pointer;background:var(--dsw-alias-bg-layer-1,transparent);text-align:left}',
  '.acx-srow:hover{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}',
  '.acx-st{font-size:12.5px}',
  '.acx-sm{font-size:10.5px;color:var(--dsw-alias-label-secondary,inherit);word-break:break-all}',
  '.acx-empty{color:var(--dsw-alias-label-secondary,inherit);font-size:12px;padding:12px;text-align:center;max-width:520px;margin:0 auto}',
  '.acx-inline{border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:7px;font-size:12.5px;background:var(--dsw-alias-bg-layer-1,transparent)}',
  '.acx-toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:40;max-width:86%;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:10px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));padding:7px 12px;font-size:12px;box-shadow:0 10px 26px rgba(0,0,0,.24)}',
  '.acx-errbox{border:1px solid var(--dsw-alias-state-error-primary,#d54941);border-radius:9px;padding:7px 9px;font-size:11.5px;color:var(--dsw-alias-state-error-primary,#d54941);white-space:pre-wrap;word-break:break-word}',
  '.acx-legend{position:absolute;left:10px;bottom:10px;z-index:11;display:flex;align-items:center;gap:8px;pointer-events:none;font-size:10.5px;color:var(--dsw-alias-label-secondary,inherit)}',
  '.acx-touch .acx-hover{display:none}',
  '@media (max-width: 760px){',
  '.acx-dock{top:auto;left:8px;right:8px;bottom:8px;width:auto;height:min(52%,360px)}',
  '.acx-form{max-height:70%}',
  '.acx-bar{top:6px;left:6px;right:6px;padding:5px}',
  '.acx-btn{padding:7px 11px;font-size:12.5px}',
  '.acx-mini{padding:3px 7px;font-size:12px}',
  '.acx-sheet{max-height:66%}',
  '}',
].join('\n')

function merge(a, b) {
  const out = {}
  for (const k in a) out[k] = a[k]
  for (const k in b) out[k] = b[k]
  return out
}

function firstLine(text, max) {
  const raw = String(text === undefined || text === null ? '' : text).trim()
  if (!raw) return ''
  const lines = raw.split('\n')
  let out = ''
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t) { out = t; break }
  }
  if (out.length > max) out = out.slice(0, max) + '...'
  return out
}

function basename(p) {
  const s = String(p === undefined || p === null ? '' : p).replace(/\/+$/, '')
  const i = s.lastIndexOf('/')
  return i >= 0 ? s.slice(i + 1) : s
}

function dirname(p) {
  const s = String(p === undefined || p === null ? '' : p).replace(/\/+$/, '')
  const i = s.lastIndexOf('/')
  return i > 0 ? s.slice(0, i) : '/'
}

function commonDir(paths) {
  if (!paths || paths.length === 0) return null
  const dirs = paths.map(function (p) { return dirname(p) })
  let parts = dirs[0].split('/')
  for (let i = 1; i < dirs.length; i++) {
    const other = dirs[i].split('/')
    let j = 0
    while (j < parts.length && j < other.length && parts[j] === other[j]) j += 1
    parts = parts.slice(0, j)
    if (parts.length === 0) return '/'
  }
  const joined = parts.join('/')
  return joined.length === 0 ? '/' : joined
}

function initials(name) {
  const s = String(name === undefined || name === null ? '' : name).trim()
  if (!s) return '?'
  const parts = s.split(/\s+/)
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
  return s.slice(0, 2).toUpperCase()
}

function fmtSize(n) {
  if (typeof n !== 'number' || !isFinite(n)) return ''
  if (n < 1024) return String(n) + 'B'
  if (n < 1048576) return (n / 1024).toFixed(1) + 'K'
  return (n / 1048576).toFixed(1) + 'M'
}

function extractPath(text) {
  const s = String(text === undefined || text === null ? '' : text)
  const m = /(^|[\s(\[])(\/[^\s"'()[\]]+)/.exec(s)
  if (!m) return null
  return m[2].replace(/[.,;:]+$/, '')
}

function slugify(text) {
  const raw = String(text === undefined || text === null ? '' : text).toLowerCase()
  let out = ''
  for (let i = 0; i < raw.length && out.length < 24; i++) {
    const c = raw.charAt(i)
    if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) out += c
    else if (c === ' ' || c === '-' || c === '_' || c === '/') out += '-'
  }
  out = out.replace(/-+/g, '-').replace(/^-|-$/g, '')
  return out || 'agent'
}

function detectTouch() {
  try {
    if (typeof window === 'undefined') return false
    if (typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(hover: none), (pointer: coarse)').matches === true
  } catch (e) {
    return false
  }
}

function blocksText(content) {
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

function mapWindow(win) {
  if (!win || !win.entries) return []
  const entries = win.entries
  const out = []
  const live = {}
  const liveOrder = []
  const start = entries.length > 300 ? entries.length - 300 : 0
  for (let i = start; i < entries.length; i++) {
    const ent = entries[i]
    if (!ent) continue
    if (ent.type === 'event') {
      const ev = ent.event
      if (!ev) continue
      const data = ev.data || {}
      if (ev.type === 'user/message') {
        out.push({ key: 's' + String(ev.seq), role: 'user', text: blocksText(data.message && data.message.content) })
      } else if (ev.type === 'assistant/message') {
        out.push({ key: 's' + String(ev.seq), role: 'assistant', text: blocksText(data.message && data.message.content) })
      } else if (ev.type === 'tool/call') {
        out.push({ key: 's' + String(ev.seq), role: 'tool', text: String(data.name || 'tool') })
      }
    } else if (ent.type === 'transient') {
      const ev = ent.event
      if (!ev || ev.type !== 'assistant/live-chunk' || !ev.data) continue
      const chunk = ev.data.chunk
      if (!chunk || chunk.type !== 'text-delta' || typeof chunk.text !== 'string') continue
      const aid = String(ev.data.attemptId)
      if (live[aid] === undefined) { live[aid] = ''; liveOrder.push(aid) }
      live[aid] = live[aid] + chunk.text
    }
  }
  for (let i = 0; i < liveOrder.length; i++) {
    const aid = liveOrder[i]
    out.push({ key: 'live-' + aid, role: 'assistant', text: live[aid], live: true })
  }
  return out
}

function curve(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2
  return 'M ' + x1 + ' ' + y1 + ' C ' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2
}

function createStore(initial) {
  let state = initial
  const listeners = []
  return {
    get: function () { return state },
    set: function (patch) {
      state = merge(state, patch)
      for (let i = 0; i < listeners.length; i++) {
        try { listeners[i]() } catch (e) { console.error('[agent-canvas] listener failed', e) }
      }
    },
    subscribe: function (fn) {
      listeners.push(fn)
      return function () {
        const i = listeners.indexOf(fn)
        if (i >= 0) listeners.splice(i, 1)
      }
    },
  }
}

return {
  apply(ctx) {
    let seq = 0
    function nextId(prefix) {
      seq += 1
      return prefix + '-' + String(seq)
    }

    const store = createStore({
      agents: [],
      files: [],
      agentSel: [],
      fileSel: [],
      activeAgentId: null,
      sessions: {},
      sessionList: [],
      dock: false,
      home: null,
      scanNote: null,
      lastScan: null,
    })

    const baselines = {}
    const manual = {}

    function useStore() {
      const pair = React.useState(store.get())
      const snap = pair[0]
      const setSnap = pair[1]
      React.useEffect(function () {
        setSnap(store.get())
        return store.subscribe(function () { setSnap(store.get()) })
      }, [])
      return snap
    }

    function findAgent(agents, id) {
      for (let i = 0; i < agents.length; i++) if (agents[i].id === id) return agents[i]
      return null
    }

    function toggleAgent(id) {
      const cur = store.get()
      const has = cur.agentSel.indexOf(id) >= 0
      store.set({
        agentSel: has ? cur.agentSel.filter(function (i) { return i !== id }) : cur.agentSel.concat([id]),
        activeAgentId: id,
      })
    }

    function toggleFile(path) {
      const cur = store.get()
      const has = cur.fileSel.indexOf(path) >= 0
      store.set({ fileSel: has ? cur.fileSel.filter(function (i) { return i !== path }) : cur.fileSel.concat([path]) })
    }

    function removeAgent(id) {
      const cur = store.get()
      store.set({
        agents: cur.agents.filter(function (a) { return a.id !== id }),
        agentSel: cur.agentSel.filter(function (i) { return i !== id }),
        activeAgentId: cur.activeAgentId === id ? null : cur.activeAgentId,
      })
    }

    function openInSidebar(sessionId) {
      if (!sessionId) return 'this agent has no session yet'
      const svc = ctx.get('sessions')
      if (svc === undefined || typeof svc.open !== 'function') return 'sessions service unavailable'
      try {
        svc.open(sessionId)
        return null
      } catch (e) {
        return String((e && e.message) || e)
      }
    }

    async function hostCall(method, args, timeoutMs) {
      const call = Promise.resolve()
        .then(function () { return host.call(method, args) })
        .then(function (r) {
          return r === undefined || r === null ? { ok: false, error: 'empty response' } : r
        }, function (e) {
          return { ok: false, error: String((e && e.message) || e) }
        })
      if (!timeoutMs || timeoutMs <= 0) return call
      const timer = ctx.get('timer')
      if (timer === undefined || typeof timer.timeout !== 'function') return call
      const deadline = timer.timeout(timeoutMs).then(function () {
        return { ok: false, error: 'timed out after ' + String(timeoutMs) + 'ms: host did not respond', timeout: true }
      })
      return Promise.race([call, deadline])
    }

    async function sendToAgent(sessionId, text, mode) {
      const svc = ctx.get('sessions')
      let binding = null
      if (svc !== undefined && typeof svc.binding === 'function') {
        try { binding = svc.binding(sessionId) } catch (e) { binding = null }
      }
      if (binding && binding.session && typeof binding.session.prompt === 'function') {
        try {
          const res = await binding.session.prompt([{ type: 'text', text: text }], mode === 'steer' ? 'steer' : 'queue')
          if (res && (res.ok === true || res.accepted === true)) return { ok: true, via: 'session' }
          const err = res && res.error ? (res.error.message || res.error.code || 'rejected') : 'rejected'
          return { ok: false, error: String(err), via: 'session' }
        } catch (e) {
          return { ok: false, error: String((e && e.message) || e), via: 'session' }
        }
      }
      const r = await hostCall('canvas-send-prompt', { sessionId: sessionId, text: text, mode: mode === 'steer' ? 'steer' : 'queue' })
      if (r.ok) return { ok: true, via: 'host', requestId: r.requestId || null, aborted: r.aborted === true }
      return { ok: false, error: r.error || 'send failed', via: 'host', requestId: null }
    }

    // Flips the plugin-owned abort flag for a request this half queued. This only
    // signals the flag handed to sessionController.prompt; whether the runtime
    // stops the underlying prompt on seeing it cannot be verified from here.
    async function abortPrompt(requestId) {
      if (!requestId) return { ok: false, error: 'no requestId' }
      const r = await hostCall('canvas-abort-request', { requestId: requestId }, 3000)
      if (r && r.ok) return { ok: true, requestId: requestId }
      return { ok: false, error: (r && r.error) || 'abort failed', requestId: requestId }
    }

    async function createViaWorkspace(cwd) {
      const workspacesSvc = ctx.get('workspaces')
      const ui = ctx.get('uiWorkspace')
      if (workspacesSvc === undefined || ui === undefined) return { ok: false, error: 'workspace services unavailable' }
      const work = (async function () {
        const view = await workspacesSvc.create({ path: cwd })
        const id = view && (view.workspaceId || view.id)
        if (!id) return { ok: false, error: 'workspace create returned no id' }
        const sessionId = await ui.connectWorkspace(id)
        return { ok: true, sessionId: String(sessionId) }
      })()
      const guarded = work.then(
        function (v) { return v },
        function (e) { return { ok: false, error: String((e && e.message) || e) } },
      )
      const timer = ctx.get('timer')
      if (timer === undefined || typeof timer.timeout !== 'function') return guarded
      return Promise.race([
        guarded,
        timer.timeout(12000).then(function () { return { ok: false, error: 'workspace path timed out after 12000ms', timeout: true } }),
      ])
    }

    async function refresh() {
      const cur = store.get()
      const sessRes = await hostCall('canvas-sessions', {})
      const sessions = {}
      const sessionList = []
      if (sessRes.ok && sessRes.items) {
        for (let i = 0; i < sessRes.items.length; i++) {
          const s = sessRes.items[i]
          sessions[s.id] = s
          sessionList.push(s)
        }
      }
      const agents = cur.agents.map(function (a) {
        const s = sessions[a.sessionId]
        return s && s.cwd && !a.cwd ? merge(a, { cwd: s.cwd }) : a
      })
      const roots = []
      const seen = {}
      for (let i = 0; i < agents.length; i++) {
        const cwd = agents[i].cwd
        if (!cwd || seen[cwd] === true) continue
        seen[cwd] = true
        // The host resolves the directory from the agent's own session record,
        // so no path string ever crosses the RPC boundary.
        roots.push({ agentId: agents[i].sessionId, cwd: cwd })
      }
      const files = []
      let note = null
      for (let i = 0; i < roots.length; i++) {
        const root = roots[i].cwd
        const r = await hostCall('canvas-list-files', { agentId: roots[i].agentId, maxDepth: 2, limit: 160 })
        if (!r.ok) {
          note = 'scan failed for ' + root + ': ' + (r.error || '')
          continue
        }
        const entries = r.entries || []
        const assigned = assignOwner(agents, root)
        if (baselines[root] === undefined) {
          const base = {}
          for (let j = 0; j < entries.length; j++) base[entries[j].path] = true
          baselines[root] = base
        }
        for (let j = 0; j < entries.length; j++) {
          const e = entries[j]
          files.push({
            path: e.path,
            name: e.name,
            rel: e.rel,
            type: e.type,
            size: e.size,
            agentId: assigned,
            root: root,
            isNew: baselines[root][e.path] !== true,
          })
        }
        if (r.truncated) note = root + ' has too many entries; only the first 160 are shown'
      }
      store.set({ sessions: sessions, sessionList: sessionList, agents: agents, files: files, scanNote: note, lastScan: Date.now() })
    }

    function assignOwner(agents, root) {
      let best = null
      let bestLen = -1
      for (let i = 0; i < agents.length; i++) {
        const cwd = agents[i].cwd
        if (!cwd) continue
        if (root === cwd || root.indexOf(cwd + '/') === 0) {
          if (cwd.length > bestLen) { bestLen = cwd.length; best = agents[i].id }
        }
      }
      return best
    }

    function filePos(agent, index, file) {
      const m = manual[file.path]
      if (m) return m
      const col = Math.floor(index / ROW_PER_COL)
      const row = index % ROW_PER_COL
      return { x: agent.x + 150 + col * (FILE_W + 12), y: agent.y - 30 + row * (FILE_H + 8) }
    }

    function useTranscript(agent) {
      const pair = React.useState({ messages: [], running: false, source: 'none', error: null })
      const state = pair[0]
      const setState = pair[1]
      const sessionId = agent && agent.sessionId ? agent.sessionId : null
      React.useEffect(function () {
        if (!sessionId) {
          setState({ messages: [], running: false, source: 'none', error: null })
          return
        }
        const svc = ctx.get('sessions')
        let binding = null
        if (svc !== undefined && typeof svc.binding === 'function') {
          try { binding = svc.binding(sessionId) } catch (e) { binding = null }
        }
        if (binding && binding.eventSource && typeof binding.eventSource.getSnapshot === 'function') {
          const read = function () {
            let win = null
            let snap = null
            try { win = binding.eventSource.getSnapshot() } catch (e) { win = null }
            try { snap = binding.session.getSnapshot() } catch (e) { snap = null }
            setState({ messages: mapWindow(win), running: !!(snap && snap.running), source: 'live', error: null })
          }
          read()
          const un1 = binding.eventSource.subscribe(read)
          const un2 = binding.session && typeof binding.session.subscribe === 'function' ? binding.session.subscribe(read) : null
          return function () { if (un1) un1(); if (un2) un2() }
        }
        let stopped = false
        let dispose = null
        const timer = ctx.get('timer')
        // Polling is only used when no live binding exists. Back off from 1.2s to
        // 12s while the transcript is unchanged, then snap back when it moves.
        const BASE_MS = 1200
        const MAX_MS = 12000
        let delayMs = BASE_MS
        let lastShape = null
        function cancelScheduled() {
          if (dispose !== null) { try { dispose() } catch (e) {} }
          dispose = null
        }
        const schedule = function (ms) {
          if (stopped) return
          cancelScheduled()
          if (timer !== undefined && typeof timer.timeout === 'function') dispose = timer.timeout(tick, ms)
        }
        const tick = function () {
          hostCall('canvas-read-session', { sessionId: sessionId }).then(function (r) {
            if (stopped) return
            if (r.ok) {
              const msgs = r.messages || []
              const last = msgs.length > 0 ? msgs[msgs.length - 1] : null
              const shape = msgs.length + '|' + (last ? last.seq + ':' + String(last.text).length : '0')
              if (lastShape !== null && shape === lastShape) delayMs = Math.min(delayMs * 2, MAX_MS)
              else delayMs = BASE_MS
              lastShape = shape
              setState({ messages: msgs, running: false, source: 'poll', error: null })
            } else {
              setState({ messages: [], running: false, source: 'poll', error: r.error || 'read failed' })
            }
            schedule(delayMs)
          })
        }
        tick()
        return function () { stopped = true; cancelScheduled() }
      }, [sessionId])
      return state
    }

    function CanvasIcon(props) {
      const size = (props && props.size) || 18
      const color = props && props.active ? 'var(--dsw-alias-brand-primary,currentColor)' : 'currentColor'
      return h('svg', { width: size, height: size, viewBox: '0 0 20 20', fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' },
        h('circle', { cx: 4.2, cy: 5.2, r: 2.2 }),
        h('circle', { cx: 15.6, cy: 4.6, r: 2.2 }),
        h('circle', { cx: 9.6, cy: 15.4, r: 2.2 }),
        h('path', { d: 'M6.3 6.1l7.2-1.2M5.5 7.2l3.3 6.1M14.6 6.5l-3.5 6.6' }),
      )
    }

    function ChatDock(props) {
      const touchInput = !!(props && props.touch)
      const st = useStore()
      const t1 = React.useState('')
      const text = t1[0]
      const setText = t1[1]
      const m1 = React.useState('queue')
      const mode = m1[0]
      const setMode = m1[1]
      const b1 = React.useState(false)
      const busy = b1[0]
      const setBusy = b1[1]
      const r1 = React.useState([])
      const results = r1[0]
      const setResults = r1[1]
      const scrollRef = React.useRef(null)

      const targets = []
      for (let i = 0; i < st.agents.length; i++) {
        if (st.agentSel.indexOf(st.agents[i].id) >= 0) targets.push(st.agents[i])
      }
      const single = targets.length === 1 ? targets[0] : null
      const transcript = useTranscript(single)
      const msgs = transcript.messages
      const tail = msgs.length > 0 ? String(msgs[msgs.length - 1].text.length) : '0'
      const sig = String(msgs.length) + ':' + tail
      React.useEffect(function () {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
      }, [sig, single ? single.id : 'none'])

      const pickedFiles = st.files.filter(function (f) { return st.fileSel.indexOf(f.path) >= 0 })

      const doSend = function () {
        const raw = text.trim()
        if (!raw || busy || targets.length === 0) return
        setBusy(true)
        const jobs = targets.map(function (a) {
          if (!a.sessionId) return Promise.resolve({ id: a.id, name: a.name, ok: false, error: 'no session bound' })
          const lines = ['[Canvas task]']
          if (a.mission) lines.push('Mission: ' + a.mission)
          if (a.cwd) lines.push('Working directory: ' + a.cwd)
          if (pickedFiles.length > 0) {
            lines.push('Selected files on canvas:')
            for (let i = 0; i < pickedFiles.length && i < 30; i++) lines.push('- ' + pickedFiles[i].path)
          }
          lines.push('')
          lines.push(raw)
          return sendToAgent(a.sessionId, lines.join('\n'), mode).then(function (r) {
            return { id: a.id, name: a.name, ok: !!r.ok, error: r.error || null, via: r.via, requestId: r.requestId || null }
          })
        })
        Promise.all(jobs).then(function (out) {
          setResults(out)
          setText('')
          setBusy(false)
        })
      }

      const head = h('div', { className: 'acx-dock-head' },
        h('span', null, 'session projector'),
        h('span', { className: 'acx-spacer' }),
        h('span', { className: 'acx-sm' }, targets.length === 0 ? 'no agent selected' : (targets.length === 1 ? 'solo' : 'broadcast to ' + String(targets.length))),
      )

      const chips = h('div', { className: 'acx-chips' },
        targets.length === 0
          ? h('span', { className: 'acx-sm' }, 'Click an agent to select it; Ctrl/Cmd/Shift for multi-select. Hover an agent to see the context scope it owns.')
          : targets.map(function (a) {
              return h('span', { key: a.id, className: 'acx-chip' },
                h('span', { style: { color: a.color } }, '*'),
                h('span', null, a.name),
                h('button', { className: 'acx-mini', onClick: function () { toggleAgent(a.id) } }, 'x'),
              )
            }),
        h('span', { className: 'acx-spacer' }),
        h('button', { className: 'acx-mini', onClick: function () { store.set({ agentSel: store.get().agents.map(function (a) { return a.id }) }) } }, 'all'),
        h('button', { className: 'acx-mini', onClick: function () { store.set({ agentSel: [] }) } }, 'clear'),
      )

      let body = null
      if (targets.length === 0) {
        body = h('div', { className: 'acx-empty' }, 'Select one or more agents to start chatting. Chat is projected straight from DSH sessions, so the sidebar stays in sync.')
      } else if (single) {
        const mine = st.files.filter(function (f) { return f.agentId === single.id })
        body = h('div', { className: 'acx-log', ref: scrollRef },
          h('div', { className: 'acx-row' },
            h('span', { className: 'acx-sm' }, 'session: ' + (single.sessionId || 'none')),
            h('span', { className: 'acx-spacer' }),
            transcript.source === 'poll' ? h('span', { className: 'acx-sm' }, 'polling mode') : null,
            transcript.running ? h('span', { className: 'acx-sm acx-ok' }, 'running') : null,
          ),
          h('div', { className: 'acx-sm' }, 'working dir: ' + (single.cwd || 'unknown') + ' · ' + String(mine.length) + ' file node(s) on the canvas'),
          transcript.error ? h('div', { className: 'acx-errbox' }, transcript.error) : null,
          msgs.length === 0 ? h('div', { className: 'acx-sm' }, '(no messages yet)') : null,
          msgs.map(function (m) {
            return h('div', {
              key: m.key,
              className: 'acx-msg',
              'data-role': m.role,
              'data-live': m.live ? '1' : '0',
            }, m.role === 'tool' ? ('[tool] ' + m.text) : m.text)
          }),
        )
      } else {
        body = h('div', { className: 'acx-log' },
          h('div', { className: 'acx-hint' }, 'Broadcast mode: one prompt goes to each of the ' + String(targets.length) + ' agents below, each carrying its own working directory and mission.'),
          targets.map(function (a) {
            return h('div', { key: a.id, className: 'acx-srow', onClick: function () { store.set({ agentSel: [a.id], activeAgentId: a.id }) } },
              h('div', { className: 'acx-st' }, h('span', { style: { color: a.color } }, '* '), a.name),
              h('div', { className: 'acx-sm' }, 'cwd: ' + (a.cwd || 'unknown')),
              h('div', { className: 'acx-sm' }, 'session: ' + (a.sessionId || 'none')),
            )
          }),
        )
      }

      const foot = h('div', { className: 'acx-compose' },
        pickedFiles.length > 0 ? h('div', { className: 'acx-sm acx-warn' }, 'the ' + String(pickedFiles.length) + ' selected file(s) travel with the message to every agent') : null,
        h('div', { className: 'acx-row' },
          h('select', { className: 'acx-sel', value: mode, onChange: function (e) { setMode(e.target.value) } },
            h('option', { value: 'queue' }, 'queue'),
            h('option', { value: 'steer' }, 'steer'),
          ),
          h('span', { className: 'acx-sm' }, busy ? 'sending...' : (touchInput ? 'tap send' : 'Enter to send')),
          h('span', { className: 'acx-spacer' }),
          h('button', {
            className: 'acx-btn acx-primary',
            disabled: busy || !text.trim() || targets.length === 0,
            onClick: doSend,
          }, targets.length > 1 ? ('broadcast to ' + String(targets.length)) : 'send'),
        ),
        h('textarea', {
          className: 'acx-ta',
          style: { minHeight: '62px' },
          value: text,
          placeholder: 'type a prompt...',
          onChange: function (e) { setText(e.target.value) },
          onKeyDown: function (e) {
            if (touchInput) return
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend() }
          },
        }),
        results.length > 0 ? h('div', { className: 'acx-res' }, results.map(function (r) {
          const label = (r.ok ? 'OK ' : 'FAIL ') + r.name + (r.ok ? '' : ' - ' + r.error) + (r.via === 'host' ? ' (host)' : '')
          if (!r.requestId) {
            return h('div', { key: r.id, className: r.ok ? 'acx-ok' : 'acx-err' }, label)
          }
          return h('div', { key: r.id, className: r.ok ? 'acx-ok' : 'acx-err' },
            h('span', null, label + ' [' + r.requestId + ']' + (r.aborted === true ? ' - abort signal sent' : '') + (r.abortError ? ' - abort failed: ' + r.abortError : '')),
            h('button', {
              className: 'acx-mini',
              disabled: r.aborted === true,
              onClick: function () {
                abortPrompt(r.requestId).then(function (ar) {
                  setResults(results.map(function (x) {
                    if (x.requestId !== r.requestId) return x
                    return merge(x, { aborted: ar.ok === true, abortError: ar.ok === true ? null : (ar.error || null) })
                  }))
                })
              },
            }, r.aborted === true ? 'aborted' : 'abort signal'))
        })) : null,
        single ? h('div', { className: 'acx-row' },
          h('button', { className: 'acx-btn', onClick: function () {
            const err = openInSidebar(single.sessionId)
            if (err) console.error('[agent-canvas] open failed', err)
          } }, 'open in sidebar'),
          h('button', { className: 'acx-btn', onClick: function () { forkAgent(single) } }, 'fork'),
          h('span', { className: 'acx-spacer' }),
          h('button', { className: 'acx-btn acx-danger', onClick: function () { removeAgent(single.id) } }, 'remove'),
        ) : null,
      )

      return h('div', { className: 'acx-dock' }, head, chips, body, foot)
    }

    async function forkAgent(agent) {
      if (!agent || !agent.sessionId) return { ok: false, error: 'this agent has no session yet' }
      const r = await hostCall('canvas-fork-session', { sessionId: agent.sessionId })
      if (!r.ok) return { ok: false, error: r.error }
      const cur = store.get()
      const id = nextId('agent')
      const copy = merge(agent, {
        id: id,
        sessionId: r.sessionId,
        name: firstLine(agent.name + ' fork', 16),
        x: agent.x + 82,
        y: agent.y + 82,
        tag: 'fork',
      })
      store.set({ agents: cur.agents.concat([copy]), agentSel: [id], activeAgentId: id })
      return { ok: true }
    }

    function CanvasApp() {
      const st = useStore()
      const p1 = React.useState({ x: 36, y: 30 })
      const pan = p1[0]
      const setPan = p1[1]
      const g1 = React.useState(null)
      const draggingId = g1[0]
      const setDraggingId = g1[1]
      const fd1 = React.useState(null)
      const draggingFile = fd1[0]
      const setDraggingFile = fd1[1]
      const ha1 = React.useState(null)
      const hoverAgentId = ha1[0]
      const setHoverAgentId = ha1[1]
      const hf1 = React.useState(null)
      const hoverFile = hf1[0]
      const setHoverFile = hf1[1]
      const to1 = React.useState(null)
      const toast = to1[0]
      const setToast = to1[1]
      const z1 = React.useState(function () { return detectTouch() ? 0.75 : 1 })
      const zoom = z1[0]
      const setZoom = z1[1]
      const mm1 = React.useState(false)
      const multiMode = mm1[0]
      const setMultiMode = mm1[1]
      const tm1 = React.useState(function () { return detectTouch() })
      const touchMode = tm1[0]
      const setTouchMode = tm1[1]
      const inf1 = React.useState(null)
      const info = inf1[0]
      const setInfo = inf1[1]

      const f1 = React.useState(null)
      const form = f1[0]
      const setForm = f1[1]
      const f2 = React.useState('')
      const formMission = f2[0]
      const setFormMission = f2[1]
      const f3 = React.useState('')
      const formCwd = f3[0]
      const setFormCwd = f3[1]
      const f4 = React.useState('')
      const formPreset = f4[0]
      const setFormPreset = f4[1]
      const f5 = React.useState(null)
      const formErr = f5[0]
      const setFormErr = f5[1]
      const f6 = React.useState(false)
      const formBusy = f6[0]
      const setFormBusy = f6[1]
      const f10 = React.useState(0)
      const elapsed = f10[0]
      const setElapsed = f10[1]
      const f7 = React.useState([])
      const presets = f7[0]
      const setPresets = f7[1]
      const f8 = React.useState([])
      const sessionItems = f8[0]
      const setSessionItems = f8[1]
      const f9 = React.useState('')
      const projectQuery = f9[0]
      const setProjectQuery = f9[1]

      const canvasRef = React.useRef(null)
      const panRef = React.useRef(null)
      const dragRef = React.useRef(null)
      const fileDragRef = React.useRef(null)

      React.useEffect(function () {
        let stopped = false
        let dispose = null
        const timer = ctx.get('timer')
        // Adaptive polling. Walking every agent cwd with fs.listDir is the expensive
        // part, so the interval grows while two scans in a row see the same graph
        // shape and snaps back to BASE_MS the moment anything changes.
        const BASE_MS = 1200
        const MAX_MS = 20000
        let delayMs = BASE_MS
        let lastShape = null
        function graphShape(files) {
          let bytes = 0
          for (let i = 0; i < files.length; i++) {
            if (typeof files[i].size === 'number') bytes += files[i].size
          }
          return store.get().agents.length + '|' + files.length + '|' + bytes
        }
        function cancelScheduled() {
          if (dispose !== null) { try { dispose() } catch (e) {} }
          dispose = null
        }
        const schedule = function (ms) {
          if (stopped) return
          cancelScheduled()
          if (timer !== undefined && typeof timer.timeout === 'function') {
            dispose = timer.timeout(function () { run() }, ms)
          }
        }
        const run = async function () {
          if (stopped) return
          try { await refresh() } catch (e) { console.error('[agent-canvas] refresh failed', e) }
          const shape = graphShape(store.get().files)
          if (lastShape !== null && shape === lastShape) delayMs = Math.min(delayMs * 2, MAX_MS)
          else delayMs = BASE_MS
          lastShape = shape
          schedule(delayMs)
        }
        const ui = ctx.get('uiWorkspace')
        if (ui !== undefined && typeof ui.listDirectory === 'function') {
          Promise.resolve(ui.listDirectory()).then(function (listing) {
            if (listing && typeof listing.home === 'string') store.set({ home: listing.home })
          }, function () {})
        }
        run()
        return function () { stopped = true; cancelScheduled() }
      }, [])

      React.useEffect(function () {
        if (!toast) return
        const timer = ctx.get('timer')
        let dispose = null
        if (timer !== undefined && typeof timer.timeout === 'function') dispose = timer.timeout(function () { setToast(null) }, 5000)
        return function () { if (dispose) dispose() }
      }, [toast])

      React.useEffect(function () {
        if (!formBusy) { setElapsed(0); return undefined }
        const started = Date.now()
        const timer = ctx.get('timer')
        let dispose = null
        if (timer !== undefined && typeof timer.interval === 'function') {
          dispose = timer.interval(function () { setElapsed(Math.round((Date.now() - started) / 1000)) }, 1000)
        }
        return function () { if (dispose) dispose() }
      }, [formBusy])

      React.useEffect(function () {
        let query = null
        let onChange = null
        try {
          if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
          query = window.matchMedia('(hover: none), (pointer: coarse)')
          onChange = function () { setTouchMode(query.matches === true) }
          if (typeof query.addEventListener === 'function') query.addEventListener('change', onChange)
          else if (typeof query.addListener === 'function') query.addListener(onChange)
        } catch (e) {
          return undefined
        }
        return function () {
          try {
            if (query === null || onChange === null) return
            if (typeof query.removeEventListener === 'function') query.removeEventListener('change', onChange)
            else if (typeof query.removeListener === 'function') query.removeListener(onChange)
          } catch (e) {}
        }
      }, [])

      React.useEffect(function () {
        if (!form) return
        let alive = true
        if (form.kind === 'agent') {
          hostCall('canvas-presets', {}).then(function (r) {
            if (alive && r.ok && r.items) setPresets(r.items)
          })
          return function () { alive = false }
        }
        if (form.kind === 'project') {
          hostCall('canvas-sessions', {}).then(function (r) {
            if (!alive) return
            if (r.ok) { setSessionItems(r.items || []); setFormErr(null) }
            else setFormErr(r.error || 'list failed')
          })
          return function () { alive = false }
        }
        return undefined
      }, [form])

      function point(e) {
        const el = canvasRef.current
        if (!el) return { x: 0, y: 0 }
        const r = el.getBoundingClientRect()
        return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom }
      }

      function onCanvasPointerDown(e) {
        if (e.button !== 0) return
        panRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) {}
      }

      function onCanvasPointerMove(e) {
        const d = panRef.current
        if (!d) return
        setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) })
      }

      function onCanvasPointerUp(e) {
        panRef.current = null
        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) {}
      }

      function onAgentPointerDown(e, agent) {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        const p = point(e)
        dragRef.current = { id: agent.id, dx: p.x - agent.x, dy: p.y - agent.y, moved: false, x0: p.x, y0: p.y }
        setDraggingId(agent.id)
        setHoverAgentId(null)
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) {}
        const multi = multiMode || e.metaKey || e.ctrlKey || e.shiftKey
        if (multi) toggleAgent(agent.id)
        else store.set({ agentSel: [agent.id], activeAgentId: agent.id })
      }

      function onAgentPointerMove(e) {
        const d = dragRef.current
        if (!d) return
        e.preventDefault()
        const p = point(e)
        const nx = p.x - d.dx
        const ny = p.y - d.dy
        if (Math.abs(p.x - d.x0) > 3 || Math.abs(p.y - d.y0) > 3) d.moved = true
        const agents = store.get().agents
        const next = []
        for (let i = 0; i < agents.length; i++) next.push(agents[i].id === d.id ? merge(agents[i], { x: nx, y: ny }) : agents[i])
        store.set({ agents: next })
      }

      function onAgentPointerUp(e) {
        const d = dragRef.current
        if (!d) return
        dragRef.current = null
        setDraggingId(null)
        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) {}
        if (!d.moved && touchMode) setInfo({ kind: 'agent', id: d.id })
      }

      function onFilePointerDown(e, f) {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        const p = point(e)
        const pos = filePosOf(f)
        fileDragRef.current = { path: f.path, dx: p.x - pos.x, dy: p.y - pos.y, moved: false, x0: p.x, y0: p.y }
        setDraggingFile(f.path)
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) {}
      }

      function onFilePointerMove(e) {
        const d = fileDragRef.current
        if (!d) return
        e.preventDefault()
        const p = point(e)
        if (!d.moved && Math.abs(p.x - d.x0) <= 3 && Math.abs(p.y - d.y0) <= 3) return
        d.moved = true
        manual[d.path] = { x: p.x - d.dx, y: p.y - d.dy }
        store.set({})
      }

      function onFilePointerUp(e) {
        const d = fileDragRef.current
        if (!d) return
        fileDragRef.current = null
        setDraggingFile(null)
        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) {}
        if (d.moved) return
        toggleFile(d.path)
        if (touchMode) setInfo({ kind: 'file', path: d.path })
      }

      function filePosOf(f) {
        const owner = findAgent(st.agents, f.agentId)
        let index = 0
        let seen = 0
        for (let i = 0; i < st.files.length; i++) {
          if (st.files[i].agentId !== f.agentId) continue
          if (st.files[i].path === f.path) { index = seen; break }
          seen += 1
        }
        if (!owner) return { x: 60, y: 60 }
        return filePos(owner, index, f)
      }

      function openAgentForm(prefillMission, prefillCwd) {
        setForm({ kind: 'agent' })
        setFormMission(prefillMission || '')
        setFormCwd(prefillCwd || '')
        setFormPreset('')
        setFormErr(null)
      }

      function openAgentFromSelection() {
        const picked = store.get().files.filter(function (f) { return store.get().fileSel.indexOf(f.path) >= 0 })
        if (picked.length === 0) return
        const lines = ['Own these files (from the canvas selection):']
        for (let i = 0; i < picked.length && i < 40; i++) lines.push('- ' + picked[i].path)
        lines.push('')
        lines.push('Change only these files; leave everything else alone.')
        openAgentForm(lines.join('\n'), commonDir(picked.map(function (f) { return f.path })))
      }

      function openProjectForm() {
        setSessionItems(store.get().sessionList)
        setProjectQuery('')
        setFormErr(null)
        setForm({ kind: 'project' })
      }

      function closeForm() { setForm(null); setFormErr(null); setFormBusy(false) }

      function nextFreshCwd(mission) {
        const home = store.get().home
        if (!home) return null
        return home + '/agent-canvas/' + slugify(firstLine(mission, 24)) + '-' + String(Date.now()).slice(-6)
      }

      function adoptExisting(targetCwd, since) {
        if (!targetCwd) return null
        const list = store.get().sessionList
        for (let i = 0; i < list.length; i++) {
          const s = list[i]
          if (s.cwd !== targetCwd) continue
          if (typeof since === 'number' && typeof s.createdAt === 'number' && s.createdAt < since) continue
          return s.id
        }
        return null
      }

      async function createAgent(mission, cwdInput, preset) {
        const typed = String(cwdInput || '').trim()
        const explicit = typed || extractPath(mission)
        const fresh = explicit ? null : nextFreshCwd(mission)
        const target = explicit || fresh
        const errors = []
        let attemptTimedOut = false
        // Taken before the first attempt so a timed-out create can be adopted by
        // matching cwd + createdAt. Declared above the closure that reads it.
        const since = Date.now()
        const attempt = async function (cwd) {
          const r = await hostCall('canvas-create-session', { cwd: cwd, agentPreset: preset || null }, 8000)
          if (r.ok && r.sessionId) return r
          errors.push((cwd ? 'cwd=' + cwd : 'default cwd') + ': ' + (r.error || 'no session id'))
          if (r.timeout) {
            attemptTimedOut = true
            const relist = await hostCall('canvas-sessions', {}, 5000)
            if (relist.ok && relist.items) {
              const sessions = {}
              for (let i = 0; i < relist.items.length; i++) sessions[relist.items[i].id] = relist.items[i]
              store.set({ sessions: sessions, sessionList: relist.items })
              const adopted = adoptExisting(cwd || typed, since)
              if (adopted) {
                errors.pop()
                errors.push('response timed out but the session was created; adopted: ' + adopted)
                return { ok: true, sessionId: adopted, adopted: true }
              }
            }
          }
          return null
        }
        let used = target
        let res = await attempt(target)
        if (!res && target && !attemptTimedOut) {
          used = null
          res = await attempt(null)
        }
        if (!res) return { ok: false, error: 'failed to create session\n' + errors.join('\n') }
        if (used && baselines[used] === undefined && fresh) baselines[used] = {}
        const cur = store.get()
        const id = nextId('agent')
        const idx = cur.agents.length
        const agent = {
          id: id,
          name: firstLine(mission, 16) || ('Agent ' + String(idx + 1)),
          mission: mission,
          sessionId: res.sessionId,
          cwd: used,
          x: 60 + (idx % 4) * 300,
          y: 70 + Math.floor(idx / 4) * 260,
          color: COLORS[idx % COLORS.length],
          tag: 'create',
        }
        store.set({ agents: cur.agents.concat([agent]), agentSel: [id], activeAgentId: id, dock: true })
        return { ok: true, warning: typed && !used ? 'the specified working directory was unusable; fell back to the default' : null }
      }

      async function submitAgentForm() {
        const mission = formMission.trim()
        if (!mission || formBusy) return
        setFormBusy(true)
        setFormErr(null)
        let r = null
        try {
          const timer = ctx.get('timer')
          const work = createAgent(mission, formCwd, formPreset)
          r = timer !== undefined && typeof timer.timeout === 'function'
            ? await Promise.race([work, timer.timeout(20000).then(function () {
                return { ok: false, error: 'overall timeout 20s: the create flow never returned (check the console for [agent-canvas] logs)', timeout: true }
              })])
            : await work
        } catch (e) {
          r = { ok: false, error: 'create threw: ' + String((e && e.message) || e) }
        } finally {
          setFormBusy(false)
        }
        if (!r || !r.ok) { setFormErr((r && r.error) || 'create failed'); return }
        setForm(null)
        setFormMission('')
        store.set({ fileSel: [] })
        if (r.warning) setToast({ id: nextId('t'), text: r.warning })
        refresh()
      }

      function projectSession(s) {
        const cur = store.get()
        const id = nextId('agent')
        const idx = cur.agents.length
        const agent = {
          id: id,
          name: s.title ? firstLine(s.title, 16) : (s.cwd ? firstLine(s.cwd, 16) : 'session'),
          mission: '',
          sessionId: s.id,
          cwd: s.cwd || null,
          x: 60 + (idx % 4) * 300,
          y: 70 + Math.floor(idx / 4) * 260,
          color: COLORS[idx % COLORS.length],
          tag: 'project',
        }
        store.set({ agents: cur.agents.concat([agent]), agentSel: [id], activeAgentId: id, dock: true })
        setForm(null)
        refresh()
      }

      function renderFile(f) {
        const pos = filePosOf(f)
        const isDir = f.type === 'directory'
        const picked = st.fileSel.indexOf(f.path) >= 0
        return h('div', {
          key: f.path,
          className: 'acx-file',
          'data-kind': isDir ? 'dir' : 'file',
          'data-selected': picked ? '1' : '0',
          'data-new': f.isNew ? '1' : '0',
          'data-dragging': draggingFile === f.path ? '1' : '0',
          style: { left: pos.x + 'px', top: pos.y + 'px', width: FILE_W + 'px', height: FILE_H + 'px' },
          title: f.path,
          onPointerDown: function (e) { onFilePointerDown(e, f) },
          onPointerMove: onFilePointerMove,
          onPointerUp: onFilePointerUp,
          onPointerCancel: onFilePointerUp,
          onPointerEnter: function () { if (!fileDragRef.current) setHoverFile(f.path) },
          onPointerLeave: function () { setHoverFile(function (cur) { return cur === f.path ? null : cur }) },
        },
          h('div', { className: 'acx-fname' }, (isDir ? '[D] ' : '[F] ') + f.name),
          h('div', { className: 'acx-fmeta' },
            h('span', null, f.rel || f.name),
            h('span', { className: 'acx-spacer' }),
            f.isNew ? h('span', { className: 'acx-ok' }, 'new') : null,
            !isDir && f.size !== null ? h('span', null, fmtSize(f.size)) : null,
          ),
        )
      }

      function renderAgent(a) {
        const sess = st.sessions[a.sessionId] || null
        const live = !!(sess && sess.live)
        let mine = 0
        let fresh = 0
        for (let i = 0; i < st.files.length; i++) {
          if (st.files[i].agentId !== a.id) continue
          mine += 1
          if (st.files[i].isNew) fresh += 1
        }
        return h('div', {
          key: a.id,
          className: 'acx-agent',
          'data-selected': st.agentSel.indexOf(a.id) >= 0 ? '1' : '0',
          'data-dragging': draggingId === a.id ? '1' : '0',
          style: { left: a.x + 'px', top: a.y + 'px', borderColor: a.color },
          onPointerDown: function (e) { onAgentPointerDown(e, a) },
          onPointerMove: onAgentPointerMove,
          onPointerUp: onAgentPointerUp,
          onPointerCancel: onAgentPointerUp,
          onPointerEnter: function () { if (!dragRef.current) setHoverAgentId(a.id) },
          onPointerLeave: function () { setHoverAgentId(function (cur) { return cur === a.id ? null : cur }) },
          onDoubleClick: function () { openInSidebar(a.sessionId) },
        },
          fresh > 0 ? h('div', { className: 'acx-badge' }, String(fresh)) : null,
          h('span', { style: { color: a.color } }, initials(a.name)),
          h('div', { className: 'acx-dot', style: { background: live ? 'var(--dsw-alias-state-success-primary,#2ea043)' : 'var(--dsw-alias-border-l2,rgba(127,127,127,.3))' } }),
          h('div', { className: 'acx-agent-label' }, a.name),
        )
      }

      function agentInfoRows(a) {
        const mine = st.files.filter(function (f) { return f.agentId === a.id })
        const fresh = mine.filter(function (f) { return f.isNew })
        const sess = st.sessions[a.sessionId] || null
        const shown = mine.slice(0, 8)
        return [
          h('div', { key: 'mission', className: 'acx-sm' }, a.mission ? ('mission: ' + firstLine(a.mission, 80)) : 'mission: (none set)'),
          h('div', { key: 'scope', className: 'acx-hsect' },
            h('div', { className: 'acx-hlab' }, 'context scope it owns'),
            h('div', { className: 'acx-mono' }, a.cwd || '(working directory unknown)'),
            h('div', { className: 'acx-sm' }, String(mine.length) + ' file node(s) on the canvas, ' + String(fresh.length) + ' created by this session'),
            mine.length > 0 ? h('div', { className: 'acx-flist' }, shown.map(function (f) {
              return h('div', { key: f.path, className: 'acx-frow' },
                h('span', { className: f.isNew ? 'acx-ok' : '' }, f.isNew ? 'new' : '   '),
                h('span', { style: { color: 'var(--dsw-alias-label-secondary,inherit)' } }, f.rel || f.name),
              )
            })) : h('div', { className: 'acx-sm' }, 'no files yet; files the agent creates show up here automatically'),
          ),
          h('div', { key: 'sess', className: 'acx-hsect' },
            h('div', { className: 'acx-hlab' }, 'DSH session (projection)'),
            h('div', { className: 'acx-mono' }, a.sessionId || '(none)'),
            h('div', { className: 'acx-sm' }, (sess && sess.live ? 'live' : 'cold') + ' · select to chat'),
          ),
        ]
      }

      function fileInfoRows(f) {
        const owner = findAgent(st.agents, f.agentId)
        return [
          h('div', { key: 'path', className: 'acx-mono' }, f.path),
          h('div', { key: 'meta', className: 'acx-sm' }, (f.type === 'directory' ? 'dir' : 'file') + (f.size !== null && f.type !== 'directory' ? ' · ' + fmtSize(f.size) : '')),
          h('div', { key: 'owner', className: 'acx-hsect' },
            h('div', { className: 'acx-hlab' }, 'owned by agent'),
            h('div', null, owner ? owner.name : '(unowned)'),
            f.isNew ? h('div', { className: 'acx-ok' }, 'appeared after the canvas started watching (most likely created by the agent)') : null,
            h('div', { className: 'acx-sm' }, 'click to select; selected files can seed a new agent'),
          ),
        ]
      }

      function hoverAgentCard(a) {
        return h('div', { className: 'acx-hover', style: { left: (a.x + 84) + 'px', top: (a.y - 10) + 'px' } },
          h('div', null, h('b', { style: { color: a.color } }, a.name)),
          agentInfoRows(a),
        )
      }

      function hoverFileCard(f) {
        const pos = filePosOf(f)
        return h('div', { className: 'acx-hover', style: { left: (pos.x + 20) + 'px', top: (pos.y + FILE_H + 6) + 'px' } },
          h('div', null, h('b', null, f.name)),
          fileInfoRows(f),
        )
      }

      const edges = []
      for (let i = 0; i < st.files.length; i++) {
        const f = st.files[i]
        const owner = findAgent(st.agents, f.agentId)
        if (!owner) continue
        const pos = filePosOf(f)
        edges.push({
          key: f.path,
          ax: owner.x + AGENT_SIZE / 2,
          ay: owner.y + AGENT_SIZE / 2,
          fx: pos.x,
          fy: pos.y + FILE_H / 2,
          isNew: f.isNew,
        })
      }

      const svg = h('svg', {
        className: 'acx-edges',
        width: CONTENT_W,
        height: CONTENT_H,
        viewBox: '0 0 ' + String(CONTENT_W) + ' ' + String(CONTENT_H),
      }, edges.map(function (e) {
        return h('path', {
          key: e.key,
          d: curve(e.ax, e.ay, e.fx, e.fy),
          fill: 'none',
          stroke: e.isNew ? 'var(--dsw-alias-state-success-primary,#2ea043)' : 'var(--dsw-alias-border-l2,rgba(127,127,127,.3))',
          strokeWidth: e.isNew ? 2 : 1.5,
          strokeDasharray: e.isNew ? '6 4' : '4 5',
          opacity: 0.9,
        })
      }))

      const pickedFiles = st.files.filter(function (f) { return st.fileSel.indexOf(f.path) >= 0 })

      const bar = h('div', { className: 'acx-bar' },
        h('b', null, 'Agent Canvas'),
        h('button', {
          className: st.dock ? 'acx-btn acx-primary' : 'acx-btn',
          onClick: function () { store.set({ dock: !store.get().dock }) },
        }, st.dock ? 'chat on' : 'chat'),
        h('button', { className: 'acx-btn acx-primary', onClick: function () { openAgentForm('', '') } }, '+ Agent'),
        h('button', {
          className: 'acx-btn',
          disabled: pickedFiles.length === 0,
          onClick: openAgentFromSelection,
        }, pickedFiles.length > 0 ? ('agent from ' + String(pickedFiles.length) + ' selected file(s)') : 'agent from selected files'),
        h('button', {
          className: multiMode ? 'acx-btn acx-primary' : 'acx-btn',
          onClick: function () { setMultiMode(!multiMode) },
        }, multiMode ? 'multi-select on' : 'multi-select off'),
        h('button', { className: 'acx-btn', onClick: openProjectForm }, 'project session'),
        h('span', { className: 'acx-spacer' }),
        h('button', { className: 'acx-btn', onClick: function () { setZoom(function (z) { return z <= 0.5 ? 0.5 : Math.round((z - 0.25) * 100) / 100 }) } }, '-'),
        h('button', { className: 'acx-btn', onClick: function () { setZoom(1) } }, Math.round(zoom * 100) + '%'),
        h('button', { className: 'acx-btn', onClick: function () { setZoom(function (z) { return z >= 1.5 ? 1.5 : Math.round((z + 0.25) * 100) / 100 }) } }, '+'),
        h('button', { className: 'acx-btn', onClick: function () {
          for (const k in manual) delete manual[k]
          store.set({})
        } }, 'relayout'),
        h('button', { className: 'acx-btn', onClick: function () { setPan({ x: 36, y: 30 }) } }, 'reset view'),
      )

      let formEl = null
      if (form && form.kind === 'agent') {
        const options = [h('option', { key: '__default', value: '' }, 'default preset')]
        for (let i = 0; i < presets.length; i++) options.push(h('option', { key: presets[i].id, value: presets[i].id }, presets[i].name))
        formEl = h('div', { className: 'acx-form' },
          h('div', { className: 'acx-form-title' }, pickedFiles.length > 0 ? 'create an agent from the selected files' : 'new agent'),
          h('div', { className: 'acx-hint' }, 'You only give an agent a goal. Files it creates appear as nodes automatically; select those files later to derive a new agent from them.'),
          h('textarea', {
            className: 'acx-ta',
            value: formMission,
            placeholder: 'e.g. write hello.py under /tmp/demo and run it',
            onChange: function (e) { setFormMission(e.target.value) },
          }),
          h('div', { className: 'acx-row' },
            h('span', { className: 'acx-sm' }, 'working directory'),
            h('input', {
              className: 'acx-inp',
              value: formCwd,
              placeholder: (store.get().home ? store.get().home + '/agent-canvas/...' : '(leave empty to create a fresh directory)'),
              onChange: function (e) { setFormCwd(e.target.value) },
            }),
            h('span', { className: 'acx-sm' }, 'Agent preset'),
            h('select', { className: 'acx-sel', value: formPreset, onChange: function (e) { setFormPreset(e.target.value) } }, options),
          ),
          h('div', { className: 'acx-hint' }, 'When the working directory is empty, a dedicated directory is created under ' + (store.get().home ? store.get().home + '/agent-canvas/' : 'the DSH canvas scratch dir') + ' so the files this agent produces are clearly attributed to it.'),
          formErr ? h('div', { className: 'acx-errbox' }, formErr) : null,
          h('div', { className: 'acx-btns' },
            h('span', { className: 'acx-spacer' }),
            h('button', { className: 'acx-btn', onClick: closeForm }, 'cancel'),
            h('button', { className: 'acx-btn acx-primary', disabled: formBusy || !formMission.trim(), onClick: submitAgentForm }, formBusy ? ('creating ' + String(elapsed) + 's (8s per attempt)') : 'create agent'),
          ),
        )
      } else if (form && form.kind === 'project') {
        const source = sessionItems.length > 0 ? sessionItems : st.sessionList
        const needle = projectQuery.trim().toLowerCase()
        const filtered = source.filter(function (s) {
          if (!needle) return true
          return (String(s.title || '') + ' ' + String(s.cwd || '') + ' ' + String(s.id) + ' ' + String(s.origin || '')).toLowerCase().indexOf(needle) >= 0
        })
        formEl = h('div', { className: 'acx-form' },
          h('div', { className: 'acx-form-title' }, 'project an existing session (a projection of a sidebar session)'),
          h('div', { className: 'acx-hint' }, 'The list is directly clickable. A projected agent is the very same session as the sidebar: messages sent here show there too, and the files under its working directory appear on the canvas.'),
          h('div', { className: 'acx-row' },
            h('input', {
              className: 'acx-inp',
              value: projectQuery,
              placeholder: 'filter title / cwd / id',
              onChange: function (e) { setProjectQuery(e.target.value) },
            }),
            h('button', { className: 'acx-btn', onClick: function () {
              hostCall('canvas-sessions', {}).then(function (r) {
                if (r.ok) { setSessionItems(r.items || []); setFormErr(null) }
                else setFormErr(r.error || 'list failed')
              })
            } }, 'refresh'),
            h('span', { className: 'acx-sm' }, String(filtered.length) + ' / ' + String(source.length)),
          ),
          formErr ? h('div', { className: 'acx-errbox' }, formErr) : null,
          h('div', { className: 'acx-slist' },
            filtered.length === 0
              ? h('div', { className: 'acx-empty' }, 'no matching sessions')
              : filtered.slice(0, 300).map(function (s) {
                  return h('div', { key: s.id, className: 'acx-srow', onClick: function () { projectSession(s) } },
                    h('div', { className: 'acx-st' }, (s.title || '(untitled session)') + (s.live ? ' · live' : '')),
                    h('div', { className: 'acx-sm' }, s.id + (s.cwd ? ' · ' + s.cwd : '') + (s.origin ? ' · ' + s.origin : '')),
                  )
                }),
          ),
          h('div', { className: 'acx-btns' },
            h('span', { className: 'acx-spacer' }),
            h('button', { className: 'acx-btn', onClick: closeForm }, 'close'),
          ),
        )
      }

      const hoveredAgent = hoverAgentId ? findAgent(st.agents, hoverAgentId) : null
      let hoveredFileObj = null
      if (hoverFile) {
        for (let i = 0; i < st.files.length; i++) if (st.files[i].path === hoverFile) hoveredFileObj = st.files[i]
      }

      const canvas = h('div', {
        className: 'acx-canvas',
        ref: canvasRef,
        'data-panning': panRef.current ? '1' : '0',
        onPointerDown: onCanvasPointerDown,
        onPointerMove: onCanvasPointerMove,
        onPointerUp: onCanvasPointerUp,
        onPointerCancel: onCanvasPointerUp,
      },
        h('div', { className: 'acx-content', style: { transform: 'translate(' + String(pan.x) + 'px,' + String(pan.y) + 'px) scale(' + String(zoom) + ')', transformOrigin: '0 0' } },
          svg,
          st.files.map(renderFile),
          st.agents.map(renderAgent),
          hoveredAgent && draggingId !== hoveredAgent.id ? hoverAgentCard(hoveredAgent) : null,
          hoveredFileObj && draggingFile !== hoveredFileObj.path ? hoverFileCard(hoveredFileObj) : null,
        ),
        st.agents.length === 0
          ? h('div', { className: 'acx-empty', style: { position: 'absolute', left: 0, right: 0, top: '34%' } },
              'Hit "+ agent" to give an agent a goal. Files it creates appear as nodes automatically; select those files to derive further agents.')
          : null,
      )

      let infoSheet = null
      if (info && info.kind === 'agent') {
        const a = findAgent(st.agents, info.id)
        if (a) {
          infoSheet = h('div', { className: 'acx-sheet' },
            h('div', { className: 'acx-sheet-head' },
              h('b', { style: { color: a.color } }, a.name),
              h('button', { className: 'acx-btn', onClick: function () { setInfo(null) } }, 'close'),
            ),
            agentInfoRows(a),
          )
        }
      } else if (info && info.kind === 'file') {
        let f = null
        for (let i = 0; i < st.files.length; i++) if (st.files[i].path === info.path) f = st.files[i]
        if (f) {
          infoSheet = h('div', { className: 'acx-sheet' },
            h('div', { className: 'acx-sheet-head' },
              h('b', null, f.name),
              h('button', { className: 'acx-btn', onClick: function () { setInfo(null) } }, 'close'),
            ),
            fileInfoRows(f),
          )
        }
      }

      const legend = h('div', { className: 'acx-legend' },
        h('span', null, 'agents ' + String(st.agents.length) + ' · files ' + String(st.files.length)),
        st.scanNote ? h('span', null, st.scanNote) : null,
      )

      return h('div', { className: touchMode ? 'acx-root acx-touch' : 'acx-root' },
        canvas,
        bar,
        legend,
        st.dock ? h(ChatDock, { touch: touchMode }) : null,
        formEl,
        infoSheet,
        toast ? h('div', { className: 'acx-toast' }, toast.text) : null,
      )
    }

    function RunCard() {
      const st = useStore()
      const m1 = React.useState('')
      const msg = m1[0]
      const setMsg = m1[1]
      function openPanel() {
        const layout = ctx.get('layout')
        if (layout === undefined || typeof layout.selectPanel !== 'function') {
          setMsg('layout service unavailable: use the Agent Canvas icon in the sidebar')
          return
        }
        try {
          layout.selectPanel(PANEL_ID)
          setMsg('switched to Agent Canvas')
        } catch (e) {
          setMsg('failed to switch: ' + String((e && e.message) || e) + ' (use the sidebar icon)')
        }
      }
      return h('div', { className: 'acx-inline' },
        h('div', { style: { fontWeight: 600 } }, 'Agent Canvas · graph workspace'),
        h('div', { className: 'acx-sm' }, 'agents ' + String(st.agents.length) + ' · file nodes ' + String(st.files.length) + ' · agents selected ' + String(st.agentSel.length) + ' · files selected ' + String(st.fileSel.length)),
        h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap' } },
          h('button', { className: 'acx-btn acx-primary', onClick: openPanel }, 'open canvas panel'),
        ),
        msg ? h('div', { className: 'acx-sm' }, msg) : null,
      )
    }

    const slots = ctx.get('slots')
    if (slots === undefined) {
      console.error('[agent-canvas] slots service unavailable; UI not registered')
      return
    }

    ctx.effect(function () { return styles.insert(CSS) })

    slots.inject('main', function () {
      return slots.register({ name: 'main', key: PANEL_ID }, function () { return h(CanvasApp, null) })
    })
    slots.inject('sidebar.panellist', function () {
      return slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 3, label: 'Agent Canvas' }, function (props) {
        return h(CanvasIcon, { size: (props && props.size) || 18, active: !!(props && props.active) })
      })
    })
    slots.inject('tool.view.cordis', function () {
      return slots.register({ name: 'tool.view.cordis', key: 'self' }, function () { return h(RunCard, null) })
    })

    console.log('[agent-canvas] client apply: panel "' + PANEL_ID + '" registered')
  },
}

