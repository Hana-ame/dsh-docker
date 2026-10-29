#!/usr/bin/env node
/**
 * 构建期收尾：把 plugins.list 装进来的插件包登记到 web profile 的
 * dsh.profile.bundles —— 只 `dsh plugin add` 而不登记，包会装进 profile 但不会挂载。
 *
 * 判定规则：profile dependencies 里、node_modules 可解析、且 package.json 声明了
 * dsh.bundle（组合包 patch）或 dsh.client（浏览器半身）的包，按安装顺序追加到
 * dsh.profile.bundles 末尾；已登记的不重复追加。
 *
 * 环境：在镜像内以 dshuser 运行，读取 $DSH_HOME/profiles/web/package.json。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const home = process.env.DSH_HOME || join(process.env.HOME || '/home/dshuser', '.dsh')
const profileDir = join(home, 'profiles', 'web')
const pkgPath = join(profileDir, 'package.json')

if (!existsSync(pkgPath)) {
  console.error(`[plugins] 找不到 web profile：${pkgPath}（请先执行 dsh plugin add）`)
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
pkg.dsh ??= {}
pkg.dsh.profile ??= {}
const bundles = (pkg.dsh.profile.bundles ??= [])
const added = []

for (const dep of Object.keys(pkg.dependencies ?? {})) {
  if (bundles.includes(dep)) continue
  const manifestPath = join(profileDir, 'node_modules', dep, 'package.json')
  if (!existsSync(manifestPath)) {
    console.warn(`[plugins] 跳过 ${dep}：node_modules 内没有可解析的 package.json`)
    continue
  }
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    console.warn(`[plugins] 跳过 ${dep}：package.json 解析失败（${String(error)}）`)
    continue
  }
  if (!manifest.dsh?.bundle && !manifest.dsh?.client) continue
  bundles.push(dep)
  added.push(dep)
}

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(
  added.length > 0
    ? `[plugins] 已登记 ${added.length} 个插件包：${added.join(', ')}`
    : '[plugins] 没有新的插件包需要登记',
)
console.log(`[plugins] web profile bundles：${bundles.join(', ')}`)
