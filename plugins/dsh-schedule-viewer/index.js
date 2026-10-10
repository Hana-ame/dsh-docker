/**
 * Schedule Viewer — plugin entry point (cordis dual-half).
 *
 * This plugin uses the Cordis canvas plugin pattern:
 *   - src/host.js   → server-side half (Node.js, harness.handle RPC)
 *   - src/client.js → browser-side half (React UI, host.call RPC)
 *
 * The cordis runtime loads src/host.js when the plugin is composed.
 * The client half is loaded by the browser when the Web GUI renders.
 *
 * @module index.js
 */

export const name = 'schedule-viewer'
export const version = '1.0.0'
export const inject = []

/**
 * @param {object} ctx - the cordis context.
 * @returns {{[Symbol.dispose]: () => void}}
 */
export function apply(ctx) {
  // The actual host logic lives in src/host.js.
  // This entry point exists for package.json "main" compatibility.
  // The cordis runtime calls src/host.js directly via cordis.patch.yml.
  return {
    [Symbol.dispose]: () => {
      /* cleanup handled by src/host.js via ctx.effect */
    },
  }
}

export default { name, version, inject, apply }