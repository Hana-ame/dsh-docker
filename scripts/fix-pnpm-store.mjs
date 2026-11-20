#!/usr/bin/env node
/**
 * 把 node_modules/.modules.yaml 里记录的 pnpm storeDir 修正为当前实际 store。
 *
 * 为什么需要：pnpm 用硬链接把 node_modules 链到 store。运行期 $DSH_HOME 是数据
 * 卷（独立文件系统），跨文件系统无法硬链接 → pnpm 会改用项目旁的 store；如果
 * .modules.yaml 里记录的还是旧 store（镜像构建时用的默认路径），之后任何
 * `dsh plugin add` 都会失败：
 *   ERR_PNPM_UNEXPECTED_STORE: Unexpected store location
 *
 * 这个字段只是「上次使用的 store」标记，改写成实际值即可自愈。
 * 已实测：改写后 `dsh plugin add` 立刻成功，不需要重装 node_modules。
 *
 * 用法：node fix-pnpm-store.mjs [--profile web]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const profileIdx = args.indexOf('--profile')
const profile = profileIdx >= 0 ? args[profileIdx + 1] : 'web'

const home = process.env.DSH_HOME || join(process.env.HOME || '/home/dshuser', '.dsh')
const store = join(home, '.pnpm-store', 'v11')
const modulesYaml = join(home, 'profiles', profile, 'node_modules', '.modules.yaml')

if (!existsSync(modulesYaml)) {
  console.log(`[plugins] 没有 ${modulesYaml}，跳过 storeDir 修正`)
  process.exit(0)
}

const raw = readFileSync(modulesYaml, 'utf8')
const match = raw.match(/^(\s*)"?storeDir"?\s*:\s*"([^"]*)"/m)
if (!match) {
  console.log('[plugins] .modules.yaml 里没有 storeDir 字段（pnpm 会在下次安装时写入）')
  process.exit(0)
}

const current = match[2]
if (current === store) {
  console.log(`[plugins] .modules.yaml storeDir 已是正确值（${store}）`)
  process.exit(0)
}

writeFileSync(modulesYaml, raw.replace(match[0], `${match[1]}"storeDir": "${store}"`))
console.log(`[plugins] .modules.yaml storeDir: ${current} -> ${store}`)
