/**
 * Preset definitions for the advanced patrol plugin.
 *
 * Each preset is a complete LLM instruction set that gets injected when the
 * patrol timer fires. The template uses {ROUND} and {INTERVAL} placeholders
 * that are replaced at runtime.
 *
 * @module src/presets.js
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

/**
 * Built-in preset definitions.
 * @type {Record<string, {label: string, description: string, file: string}>}
 */
const BUILTIN_PRESETS = {
  'standard-patrol': {
    label: '标准巡检',
    description: '通用巡检：查账本、读回执、查卡住、KB健康',
    file: 'standard-patrol.md',
  },
  'context-review': {
    label: '上下文审查',
    description: '检查上下文完整性、冗余、断层',
    file: 'context-review.md',
  },
  'knowledge-entry': {
    label: '知识录入',
    description: '发现新知识、验证过时信息、检查缺口',
    file: 'knowledge-entry.md',
  },
  'stuck-rescue': {
    label: '卡住脱困',
    description: '扫描卡住会话、分析原因、尝试脱困',
    file: 'stuck-rescue.md',
  },
}

export function listPresets() {
  return Object.keys(BUILTIN_PRESETS)
}

export function getPresetMeta(name) {
  return BUILTIN_PRESETS[name] ?? null
}

export function loadPresetTemplate(name) {
  const meta = BUILTIN_PRESETS[name]
  if (!meta) return null
  try {
    return fs.readFileSync(path.join(PKG_DIR, 'presets', meta.file), 'utf8')
  } catch {
    return null
  }
}

export function renderPreset(name, round, intervalSeconds) {
  const template = loadPresetTemplate(name)
  if (!template) return null
  return template
    .replace(/\{ROUND\}/g, String(round))
    .replace(/\{INTERVAL\}/g, String(intervalSeconds))
}

export function listPresetsDetailed() {
  return Object.entries(BUILTIN_PRESETS).map(([name, meta]) => ({
    name,
    label: meta.label,
    description: meta.description,
  }))
}

export function getDefaultPreset() {
  return 'standard-patrol'
}

export function isValidPreset(name) {
  return name in BUILTIN_PRESETS
}
