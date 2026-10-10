/**
 * Advanced Patrol — plugin entry point.
 *
 * A session-level, timer-driven patrol that wakes the LLM to perform
 * multi-turn tool operations on a fixed interval. Unlike /loop (which is
 * a pure classification + report), this plugin injects a full LLM instruction
 * set (preset) and lets the LLM use tools to investigate, report, and
 * optionally take action.
 *
 * Key differences from /loop:
 *   - Preset-based: switchable instruction templates per session.
 *   - Advanced form: LLM performs multi-turn tool operations, not just report.
 *   - Session-level: each session has its own timer, preset, and state.
 *   - No automatic key switching (same as the sensenova-multi design).
 *
 * @module index.js
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'advanced-patrol'
export const version = '1.0.0'

const PKG_DIR = path.dirname(fileURLToPath(import.meta.url))

/**
 * The plugin declares no hard inject dependencies.
 * Everything is reached through ctx.get() so a headless composition
 * degrades gracefully.
 */
export const inject = []

/**
 * @param {object} ctx - the cordis context.
 * @param {object} [bundleConfig] - configuration from the bundle.
 * @returns {void}
 */
export function apply(ctx, bundleConfig = {}) {
  const logger = ctx.logger ?? {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    log: () => {},
  }

  // Lazy import to avoid loading the engine if the host has no timer service.
  import('./src/patrol-engine.js').then(({ default: patrolPlugin }) => {
    try {
      patrolPlugin.apply(ctx)
      logger.info('advanced-patrol: plugin applied')
    } catch (error) {
      logger.error(`advanced-patrol: apply failed: ${error?.message ?? error}`)
    }
  })

  return {
    [Symbol.dispose]: () => {
      logger.info('advanced-patrol: disposed')
    },
  }
}