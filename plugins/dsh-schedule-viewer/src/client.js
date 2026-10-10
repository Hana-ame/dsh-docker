/**
 * dsh-schedule-viewer — Client half (cordis mode).
 *
 * Injects a sidebar icon and a panel into the DSH Web GUI.
 * The panel shows all scheduled tasks with metadata, and optionally
 * a delegation ledger section.
 *
 * @module src/client.js
 */

const h = React.createElement

const PANEL_ID = 'schedule-viewer'

// ── CSS ───────────────────────────────────────────────────────────────────

const CSS = [
  '.sv-root{position:relative;flex:1 1 auto;height:100%;min-height:0;width:100%;overflow:auto;background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-primary,inherit);font-size:13px;line-height:1.5;padding:16px;display:flex;flex-direction:column;gap:16px}',
  '.sv-header{display:flex;align-items:center;gap:10px;font-weight:600;font-size:14px}',
  '.sv-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12));color:var(--dsw-alias-label-secondary,inherit)}',
  '.sv-tabs{display:flex;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.2));padding-bottom:8px}',
  '.sv-tab{padding:6px 14px;border-radius:6px 6px 0 0;cursor:pointer;font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary,inherit);border:1px solid transparent;border-bottom:none;transition:all .15s}',
  '.sv-tab:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-3,transparent))}',
  '.sv-tab.active{background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-primary,inherit);border-color:var(--dsw-alias-border-l3,rgba(127,127,127,.2))}',
  '.sv-list{display:flex;flex-direction:column;gap:8px}',
  '.sv-card{border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.2));border-radius:8px;padding:12px;background:var(--dsw-alias-bg-layer-1,transparent)}',
  '.sv-card-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}',
  '.sv-card-title{font-weight:600;font-size:13px;display:flex;align-items:center;gap:8px}',
  '.sv-card-id{font-size:10px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));font-family:monospace}',
  '.sv-status{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500;white-space:nowrap}',
  '.sv-status.active{background:var(--dsw-alias-state-success-bg,rgba(16,185,129,.12));color:var(--dsw-alias-state-success-primary,#10b981);border:1px solid var(--dsw-alias-state-success-primary,#10b981)}',
  '.sv-status.inactive{background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-secondary,inherit);border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.3))}',
  '.sv-meta{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--dsw-alias-label-secondary,inherit);margin-bottom:6px}',
  '.sv-meta-item{display:flex;align-items:center;gap:4px}',
  '.sv-meta-label{font-weight:500}',
  '.sv-prompt{font-size:11px;color:var(--dsw-alias-label-secondary,inherit);background:var(--dsw-alias-bg-layer-1,transparent);border-radius:6px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.15));white-space:pre-wrap;word-break:break-word;max-height:60px;overflow:hidden;cursor:pointer;transition:all .15s}',
  '.sv-prompt:hover{max-height:200px;border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.3))}',
  '.sv-prompt-full{max-height:none}',
  '.sv-delegation-stats{display:flex;gap:12px;margin-bottom:8px}',
  '.sv-stat{display:flex;flex-direction:column;align-items:center;padding:6px 12px;border-radius:6px;background:var(--dsw-alias-bg-layer-1,transparent);border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.15))}',
  '.sv-stat-num{font-size:16px;font-weight:600}',
  '.sv-stat-label{font-size:10px;color:var(--dsw-alias-label-secondary,inherit)}',
  '.sv-delegation-list{display:flex;flex-direction:column;gap:4px}',
  '.sv-delegation-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;background:var(--dsw-alias-bg-layer-1,transparent);font-size:11px;cursor:pointer;transition:background .1s}',
  '.sv-delegation-item:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-3,transparent))}',
  '.sv-delegation-id{font-family:monospace;font-size:10px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));min-width:60px}',
  '.sv-delegation-status{padding:1px 6px;border-radius:4px;font-size:10px;font-weight:500}',
  '.sv-delegation-status.pending{background:rgba(234,179,8,.15);color:#b45309}',
  '.sv-delegation-status.done{background:rgba(16,185,129,.12);color:#059669}',
  '.sv-delegation-status.failed{background:rgba(239,68,68,.12);color:#dc2626}',
  '.sv-delegation-status.unknown{background:rgba(127,127,127,.15);color:var(--dsw-alias-label-secondary,inherit)}',
  '.sv-delegation-task{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.sv-refresh-btn{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.3));background:transparent;color:var(--dsw-alias-label-secondary,inherit);border-radius:6px;padding:4px 10px;font:inherit;font-size:11px;cursor:pointer;transition:all .15s}',
  '.sv-refresh-btn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-3,transparent));color:var(--dsw-alias-label-primary,inherit)}',
  '.sv-empty{text-align:center;padding:40px 20px;color:var(--dsw-alias-label-secondary,inherit);font-size:13px}',
  '.sv-loading{text-align:center;padding:20px;color:var(--dsw-alias-label-secondary,inherit);font-size:12px}',
  '.sv-icon{width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center}',
  '.sv-time{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit))}',
].join('\n')

// ── Inline SVG icons ──────────────────────────────────────────────────────

const CLOCK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
const PLAY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
const STOP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`
const REFRESH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`
const DELEGATE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`

// ── React hooks ───────────────────────────────────────────────────────────

function useState(val) { return React.useState(val) }
function useEffect(fn, deps) { return React.useEffect(fn, deps) }
function useCallback(fn, deps) { return React.useCallback(fn, deps) }

// ── Sidebar icon component ────────────────────────────────────────────────

function ScheduleIcon(props) {
  const size = props.size || 18
  const active = props.active || false
  return h('div', {
    className: 'sv-icon',
    style: {
      width: size,
      height: size,
      color: active ? 'var(--dsw-alias-brand-primary,#4d6bfe)' : 'var(--dsw-alias-label-secondary,inherit)',
      opacity: active ? 1 : 0.7,
    },
    dangerouslySetInnerHTML: { __html: CLOCK_ICON },
  })
}

// ── Schedule card component ───────────────────────────────────────────────

function ScheduleCard(props) {
  const { task, expanded, onToggle } = props
  const statusClass = task.status === 'active' ? 'active' : 'inactive'
  const StatusIcon = task.status === 'active' ? PLAY_ICON : STOP_ICON

  return h('div', { className: 'sv-card' },
    // Header
    h('div', { className: 'sv-card-header' },
      h('div', { className: 'sv-card-title' },
        h('span', {
          style: { fontSize: 12, opacity: 0.8 },
          dangerouslySetInnerHTML: { __html: StatusIcon },
        }),
        h('span', null, task.title),
      ),
      h('div', { className: `sv-status ${statusClass}` },
        task.status === 'active' ? '运行中' : '已停止',
      ),
    ),

    // Meta
    h('div', { className: 'sv-meta' },
      h('div', { className: 'sv-meta-item' },
        h('span', { className: 'sv-meta-label' }, '频率'),
        h('span', null, task.frequency),
      ),
      h('div', { className: 'sv-meta-item' },
        h('span', { className: 'sv-meta-label' }, '状态'),
        h('span', null, task.kind),
      ),
      h('div', { className: 'sv-meta-item' },
        h('span', { className: 'sv-meta-label' }, '下次'),
        h('span', { className: 'sv-time' }, task.nextTrigger ? new Date(task.nextTrigger).toLocaleString() : '—'),
      ),
      h('div', { className: 'sv-meta-item' },
        h('span', { className: 'sv-meta-label' }, '上次'),
        h('span', { className: 'sv-time' }, task.lastDeliveryRelative || '—'),
      ),
      h('div', { className: 'sv-meta-item' },
        h('span', { className: 'sv-meta-label' }, '已执行'),
        h('span', null, `${task.deliveryCount}次`),
      ),
    ),

    // Prompt (expandable)
    h('div', {
      className: `sv-prompt ${expanded ? 'sv-prompt-full' : ''}`,
      onClick: onToggle,
      title: expanded ? '点击收起' : '点击展开',
    }, task.prompt),
  )
}

// ── Delegation item component ─────────────────────────────────────────────

function DelegationItem(props) {
  const { d } = props
  const statusClass = d.status === 'done' ? 'done' : d.status === 'failed' ? 'failed' : d.status === 'pending' ? 'pending' : 'unknown'

  return h('div', { className: 'sv-delegation-item', title: d.taskSummary },
    h('span', { className: 'sv-delegation-id' }, d.shortId),
    h('span', { className: `sv-delegation-status ${statusClass}` }, d.status),
    h('span', { className: 'sv-delegation-task' }, d.taskSummary || '(no task)'),
  )
}

// ── Main panel component ──────────────────────────────────────────────────

function SchedulePanel() {
  const [tab, setTab] = useState('schedules')
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [delegations, setDelegations] = useState([])
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await hostCall('schedules-list', {})
      if (r.ok && r.tasks) {
        setTasks(r.tasks)
      } else {
        setError(r.error || 'Failed to load schedules')
      }
    } catch (e) {
      setError(String(e.message || e))
    }
    try {
      const d = await hostCall('delegations-list', {})
      if (d.ok) {
        setDelegations(d.delegations || [])
        setStats(d.stats)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const activeCount = tasks.filter(t => t.status === 'active').length
  const totalCount = tasks.length

  return h('div', { className: 'sv-root' },
    // Header
    h('div', { className: 'sv-header' },
      h(ScheduleIcon, { size: 20, active: true }),
      h('span', null, '定时任务'),
      h('span', { className: 'sv-badge' }, `${activeCount}/${totalCount} 运行中`),
      h('span', { style: { flex: 1 } }),
      h('button', {
        className: 'sv-refresh-btn',
        onClick: loadData,
        disabled: loading,
        dangerouslySetInnerHTML: { __html: REFRESH_ICON + ' ' },
      }, '刷新'),
    ),

    // Error
    error ? h('div', { style: { padding: '8px 12px', borderRadius: 6, background: 'rgba(239,68,68,.08)', border: '1px solid #ef4444', color: '#ef4444', fontSize: 12 } }, error) : null,

    // Tabs
    h('div', { className: 'sv-tabs' },
      h('div', {
        className: `sv-tab ${tab === 'schedules' ? 'active' : ''}`,
        onClick: () => setTab('schedules'),
      }, `定时任务 (${totalCount})`),
      h('div', {
        className: `sv-tab ${tab === 'delegations' ? 'active' : ''}`,
        onClick: () => setTab('delegations'),
      }, `委派记录 (${delegations.length})`),
    ),

    // Loading
    loading ? h('div', { className: 'sv-loading' }, '加载中...') : null,

    // Schedules tab
    tab === 'schedules' && !loading ? (
      tasks.length === 0
        ? h('div', { className: 'sv-empty' }, '暂无定时任务')
        : h('div', { className: 'sv-list' },
            tasks.map(task =>
              h(ScheduleCard, {
                key: task.id,
                task,
                expanded: !!expanded[task.id],
                onToggle: () => toggleExpand(task.id),
              })
            )
          )
    ) : null,

    // Delegations tab
    tab === 'delegations' && !loading ? (
      h('div', null,
        // Stats
        stats ? h('div', { className: 'sv-delegation-stats' },
          h('div', { className: 'sv-stat' },
            h('div', { className: 'sv-stat-num' }, stats.total),
            h('div', { className: 'sv-stat-label' }, '总计'),
          ),
          h('div', { className: 'sv-stat' },
            h('div', { className: 'sv-stat-num', style: { color: '#b45309' } }, stats.pending),
            h('div', { className: 'sv-stat-label' }, '待处理'),
          ),
          h('div', { className: 'sv-stat' },
            h('div', { className: 'sv-stat-num', style: { color: '#059669' } }, stats.done),
            h('div', { className: 'sv-stat-label' }, '已完成'),
          ),
          h('div', { className: 'sv-stat' },
            h('div', { className: 'sv-stat-num', style: { color: '#dc2626' } }, stats.failed),
            h('div', { className: 'sv-stat-label' }, '失败'),
          ),
        ) : null,

        // List
        delegations.length === 0
          ? h('div', { className: 'sv-empty' }, '暂无委派记录')
          : h('div', { className: 'sv-delegation-list' },
              delegations.map(d =>
                h(DelegationItem, { key: d.id, d })
              )
            ),
      )
    ) : null,
  )
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
  name: 'schedule-viewer',

  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) {
      console.error('[schedule-viewer] slots service unavailable; UI not registered')
      return
    }

    // Inject styles
    ctx.effect(function () { return styles.insert(CSS) })

    // Register main panel
    slots.inject('main', function () {
      return slots.register({ name: 'main', key: PANEL_ID }, function () {
        return h(SchedulePanel, null)
      })
    })

    // Register sidebar icon
    slots.inject('sidebar.panellist', function () {
      return slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 6,
        label: '定时任务',
      }, function (props) {
        return h(ScheduleIcon, {
          size: (props && props.size) || 18,
          active: !!(props && props.active),
        })
      })
    })

    console.log('[schedule-viewer] client applied: panel "' + PANEL_ID + '" registered')
  },
}