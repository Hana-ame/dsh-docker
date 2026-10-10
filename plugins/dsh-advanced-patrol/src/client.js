/**
 * dsh-advanced-patrol — Client half (cordis mode).
 *
 * Injects a sidebar icon and a control panel into the DSH Web GUI.
 * The sidebar icon shows the current patrol status (running/stopped).
 * The panel provides toggle, preset selection, and interval controls.
 *
 * @module src/client.js
 */

const h = React.createElement

const PANEL_ID = 'advanced-patrol'
const DEFAULT_INTERVAL = '1200'
const INTERVAL_MIN = 30
const INTERVAL_MAX = 86400

// ── CSS ───────────────────────────────────────────────────────────────────

const CSS = [
  '.dpx-root{position:relative;flex:1 1 auto;height:100%;min-height:0;width:100%;overflow:auto;background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-primary,inherit);font-size:13px;line-height:1.5;padding:16px;display:flex;flex-direction:column;gap:16px}',
  '.dpx-header{display:flex;align-items:center;gap:10px;font-weight:600;font-size:14px}',
  '.dpx-status{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:500}',
  '.dpx-status.on{background:var(--dsw-alias-state-success-bg,var(--dsw-alias-bg-layer-2,rgba(16,185,129,.12)));color:var(--dsw-alias-state-success-primary,#10b981);border:1px solid var(--dsw-alias-state-success-primary,#10b981)}',
  '.dpx-status.off{background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-secondary,inherit);border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35))}',
  '.dpx-section{display:flex;flex-direction:column;gap:8px}',
  '.dpx-section-title{font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--dsw-alias-label-secondary,inherit)}',
  '.dpx-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.4));background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit);border-radius:8px;padding:8px 16px;font:inherit;font-size:13px;line-height:1.4;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s}',
  '.dpx-btn:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-3,transparent))}',
  '.dpx-btn[disabled]{opacity:.45;cursor:default}',
  '.dpx-primary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#4d6bfe));border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}',
  '.dpx-primary:hover:not([disabled]){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#4d6bfe));color:var(--dsw-alias-label-primary-foreground,#fff)}',
  '.dpx-danger{color:var(--dsw-alias-state-error-primary,#ef4444);border-color:var(--dsw-alias-state-error-primary,#ef4444)}',
  '.dpx-danger:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover-danger,rgba(239,68,68,.08));color:var(--dsw-alias-state-error-primary,#ef4444)}',
  '.dpx-preset-list{display:flex;flex-direction:column;gap:6px}',
  '.dpx-preset-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.3));border-radius:8px;cursor:pointer;transition:border-color .15s,background .15s}',
  '.dpx-preset-item:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-3,transparent))}',
  '.dpx-preset-item.active{border-color:var(--dsw-alias-brand-primary,#4d6bfe);background:var(--dsw-alias-interactive-bg-selected,rgba(77,107,254,.08))}',
  '.dpx-preset-name{font-weight:600;font-size:12px}',
  '.dpx-preset-desc{font-size:11px;color:var(--dsw-alias-label-secondary,inherit)}',
  '.dpx-interval-row{display:flex;align-items:center;gap:8px}',
  '.dpx-interval-input{width:80px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:6px;background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit);font:inherit;font-size:13px}',
  '.dpx-interval-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#4d6bfe)}',
  '.dpx-msg{padding:8px 10px;border-radius:6px;font-size:12px;border:1px solid}',
  '.dpx-msg.ok{background:var(--dsw-alias-state-success-bg,rgba(16,185,129,.08));border-color:var(--dsw-alias-state-success-primary,#10b981);color:var(--dsw-alias-state-success-primary,#10b981)}',
  '.dpx-msg.err{background:var(--dsw-alias-state-error-bg,rgba(239,68,68,.08));border-color:var(--dsw-alias-state-error-primary,#ef4444);color:var(--dsw-alias-state-error-primary,#ef4444)}',
  '.dpx-loading{font-size:12px;color:var(--dsw-alias-label-secondary,inherit)}',
  '.dpx-icon{width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center}',
].join('\n')

// ── Inline SVG icons ──────────────────────────────────────────────────────

const PATROL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
const STOP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`
const PLAY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
const DOT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>`

// ── React hooks ───────────────────────────────────────────────────────────

function useState(val) {
  return React.useState(val)
}

function useEffect(fn, deps) {
  return React.useEffect(fn, deps)
}

function useCallback(fn, deps) {
  return React.useCallback(fn, deps)
}

// ── Store (simple state container) ────────────────────────────────────────

function createStore(initial) {
  const state = { ...initial }
  const listeners = new Set()
  return {
    get() { return state },
    set(partial) {
      Object.assign(state, partial)
      listeners.forEach(l => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

// ── Sidebar icon component ────────────────────────────────────────────────

function PatrolIcon(props) {
  const size = props.size || 18
  const active = props.active || false
  const running = props.running || false

  return h('div', {
    className: 'dpx-icon',
    style: {
      width: size,
      height: size,
      color: active ? 'var(--dsw-alias-brand-primary,#4d6bfe)' : 'var(--dsw-alias-label-secondary,inherit)',
      opacity: running ? 1 : 0.7,
    },
    dangerouslySetInnerHTML: { __html: running ? DOT_ICON : PATROL_ICON },
  })
}

// ── Main panel component ──────────────────────────────────────────────────

function PatrolPanel() {
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [presets, setPresets] = useState([])
  const [currentPreset, setCurrentPreset] = useState('standard-patrol')
  const [running, setRunning] = useState(false)
  const [interval, setInterval] = useState(DEFAULT_INTERVAL)

  const store = createStore({ running, currentPreset, interval, presets })

  useEffect(() => {
    // Load presets
    hostCall('patrol-presets', {})
      .then(r => {
        if (r.ok && r.presets) setPresets(r.presets)
      })
      .catch(() => {})
  }, [])

  // Poll status periodically
  useEffect(() => {
    const poll = () => {
      hostCall('patrol-status', { sessionId: getCurrentSessionId() })
        .then(r => {
          if (r.ok) {
            // Parse running status from text
            const isRunning = r.text.includes('运行中')
            setRunning(isRunning)
          }
        })
        .catch(() => {})
    }
    poll()
    const timer = setInterval(poll, 5000)
    return () => clearInterval(timer)
  }, [])

  const showMsg = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  const handleStart = useCallback(async () => {
    setLoading(true)
    try {
      const r = await hostCall('patrol-start', {
        sessionId: getCurrentSessionId(),
        interval: interval,
        preset: currentPreset,
      })
      if (r.ok) {
        showMsg('ok', r.text)
        setRunning(true)
      } else {
        showMsg('err', r.error || '启动失败')
      }
    } catch (e) {
      showMsg('err', String(e.message || e))
    } finally {
      setLoading(false)
    }
  }, [interval, currentPreset])

  const handleStop = useCallback(async () => {
    setLoading(true)
    try {
      const r = await hostCall('patrol-stop', { sessionId: getCurrentSessionId() })
      if (r.ok) {
        showMsg('ok', r.text)
        setRunning(false)
      } else {
        showMsg('err', r.error || '停止失败')
      }
    } catch (e) {
      showMsg('err', String(e.message || e))
    } finally {
      setLoading(false)
    }
  }, [])

  const handlePreset = useCallback(async (presetName) => {
    setLoading(true)
    try {
      const r = await hostCall('patrol-preset', {
        sessionId: getCurrentSessionId(),
        preset: presetName,
      })
      if (r.ok) {
        showMsg('ok', r.text)
        setCurrentPreset(presetName)
      } else {
        showMsg('err', r.error || '切换失败')
      }
    } catch (e) {
      showMsg('err', String(e.message || e))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleIntervalChange = useCallback(async () => {
    setLoading(true)
    try {
      const r = await hostCall('patrol-interval', {
        sessionId: getCurrentSessionId(),
        interval: interval,
      })
      if (r.ok) {
        showMsg('ok', r.text)
      } else {
        showMsg('err', r.error || '更新失败')
      }
    } catch (e) {
      showMsg('err', String(e.message || e))
    } finally {
      setLoading(false)
    }
  }, [interval])

  return h('div', { className: 'dpx-root' },
    // Header
    h('div', { className: 'dpx-header' },
      h(PatrolIcon, { size: 20, running }),
      h('span', null, '高级巡检'),
      h('span', { className: `dpx-status ${running ? 'on' : 'off'}` },
        running ? '运行中' : '已停止',
      ),
    ),

    // Message
    msg ? h('div', { className: `dpx-msg ${msg.type === 'ok' ? 'ok' : 'err'}` }, msg.text) : null,

    // Start / Stop button
    h('div', { className: 'dpx-section' },
      running
        ? h('button', {
            className: 'dpx-btn dpx-danger',
            onClick: handleStop,
            disabled: loading,
            dangerouslySetInnerHTML: { __html: STOP_ICON + ' ' },
          }, '停止巡检')
        : h('button', {
            className: 'dpx-btn dpx-primary',
            onClick: handleStart,
            disabled: loading,
            dangerouslySetInnerHTML: { __html: PLAY_ICON + ' ' },
          }, '启动巡检'),
    ),

    // Preset selector
    h('div', { className: 'dpx-section' },
      h('div', { className: 'dpx-section-title' }, '预设'),
      h('div', { className: 'dpx-preset-list' },
        presets.map(p =>
          h('div', {
            key: p.name,
            className: `dpx-preset-item ${currentPreset === p.name ? 'active' : ''}`,
            onClick: () => handlePreset(p.name),
          },
            h('div', null,
              h('div', { className: 'dpx-preset-name' }, p.label),
              h('div', { className: 'dpx-preset-desc' }, p.description),
            ),
          )
        ),
      ),
    ),

    // Interval
    h('div', { className: 'dpx-section' },
      h('div', { className: 'dpx-section-title' }, '间隔（秒）'),
      h('div', { className: 'dpx-interval-row' },
        h('input', {
          className: 'dpx-interval-input',
          type: 'number',
          min: INTERVAL_MIN,
          max: INTERVAL_MAX,
          value: interval,
          onChange: (e) => setInterval(e.target.value),
          placeholder: DEFAULT_INTERVAL,
        }),
        h('button', {
          className: 'dpx-btn',
          onClick: handleIntervalChange,
          disabled: loading,
        }, '更新'),
      ),
    ),

    // Loading indicator
    loading ? h('div', { className: 'dpx-loading' }, '处理中...') : null,
  )
}

// ── Helper: get current session ID ────────────────────────────────────────

function getCurrentSessionId() {
  try {
    const svc = ctx.get('sessions')
    if (svc !== undefined && typeof svc.current === 'function') {
      const current = svc.current()
      if (current && typeof current.id === 'string') return current.id
    }
  } catch { /* ignore */ }
  return ''
}

// ── Helper: host RPC call ─────────────────────────────────────────────────

async function hostCall(method, args, timeoutMs) {
  const call = Promise.resolve()
    .then(() => host.call(method, args))
    .then(r => (r === undefined || r === null ? { ok: false, error: 'empty response' } : r))
    .catch(e => ({ ok: false, error: String(e.message || e) }))
  if (!timeoutMs || timeoutMs <= 0) return call
  const timer = ctx.get('timer')
  if (timer === undefined || typeof timer.timeout !== 'function') return call
  const deadline = timer.timeout(timeoutMs).then(() => ({ ok: false, error: 'timed out', timeout: true }))
  return Promise.race([call, deadline])
}

// ── Export ────────────────────────────────────────────────────────────────

export default {
  name: 'advanced-patrol',

  apply(ctx) {
    // Get slots service
    const slots = ctx.get('slots')
    if (slots === undefined) {
      console.error('[advanced-patrol] slots service unavailable; UI not registered')
      return
    }

    // Inject styles
    ctx.effect(function () { return styles.insert(CSS) })

    // Register main panel
    slots.inject('main', function () {
      return slots.register({ name: 'main', key: PANEL_ID }, function () {
        return h(PatrolPanel, null)
      })
    })

    // Register sidebar icon
    slots.inject('sidebar.panellist', function () {
      return slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 5,
        label: '高级巡检',
      }, function (props) {
        return h(PatrolIcon, {
          size: (props && props.size) || 18,
          active: !!(props && props.active),
          running: false,
        })
      })
    })

    console.log('[advanced-patrol] client applied: panel "' + PANEL_ID + '" registered')
  },
}