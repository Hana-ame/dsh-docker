# DSH Agent Canvas

A **dynamic Cordis Plugin** that adds an *Agent Canvas* screen to the DeepSeek Harness Web GUI: a graph where **agents and real files are the nodes**.

> Status: experimental. The canvas is a runtime extension of a live DSH process, not a persistent install.

## Install

A dynamic Cordis package only exists inside a live DSH process, so it cannot be installed from the shell. What the shell can do is verify the package and produce the prompt to hand to your DSH agent:

```
node scripts/install.mjs
```

That runs the pre-flight checks first — it refuses to emit anything while the package is broken — then prints a paste-ready prompt naming both halves with their sha256 fingerprints.

| Command | Emits |
| --- | --- |
| `node scripts/install.mjs` | Short prompt; the agent reads `./src` from disk |
| `node scripts/install.mjs --prompt` | Self-contained prompt with both halves inlined (~85 KB) |
| `node scripts/install.mjs --json` | Machine-readable summary for tooling |
| `node scripts/install.mjs --host-only` / `--client-only` | Restrict the emit to one half |
| `node scripts/check.mjs` | Pre-flight only: parse, banned constructs, RPC wiring |
| `node scripts/selftest.mjs` | Behavioural test of the Host half against fake DSH services |
| `npm run check` | Pre-flight via package scripts |
| `npm test` | Pre-flight **and** behavioural test |

## What it does

| Capability | How it works |
| --- | --- |
| **A new screen** | Registers `sidebar.panellist` (a sidebar icon) plus a `main` screen with key `agent-canvas`. Those two registrations together form a new main panel. |
| **Humans only create agents** | There is no "create node" dialog. You give an agent a mission; that is the only input. |
| **Files become nodes** | The Host half walks each agent's working directory with the `fs` service. Anything that appeared **after the canvas started watching** is flagged `new` (green border, solid edge, a count badge on the agent). |
| **Select files → spawn a new agent** | Click files to select them (multi-select), then *Create Agent from N selected files*. The mission is pre-filled with the selected absolute paths and the working directory defaults to their common parent. |
| **Hover an agent = its context scope** | Hovering shows the mission, working directory, file-node count, how many of those this session created, the file list, and the projected DSH session id. |
| **Chat is a projection of the sidebar** | Selecting an agent renders that session's transcript with live streaming. Sending goes through the same `sessions.binding(id).session.prompt(...)` path the web UI uses, so the sidebar and the canvas stay in sync. |
| **Multi-select broadcast** | Select several agents and send one prompt to all of them; each receives its own working directory and mission. Per-agent success/failure is reported. |
| **Projection / fork** | *Project session* lists existing sessions and binds one as an agent. *Fork* derives a child session via `sessionController.fork`. *Open in sidebar* switches to the native conversation view. |
| **Mobile** | Narrow screens use a top canvas with bottom sheets instead of a fixed side drawer; tap opens the context card (touch has no hover); a *multi-select* toggle replaces Ctrl/Cmd; zoom controls and 50%–150% scaling. |

## Layout

```
src/
  host.js    Host half   — JSON RPC handlers (harness.handle) over DSH services
  client.js  Client half — the React canvas UI, slots, and stylesheet
scripts/
  check.mjs    Pre-flight validator for both halves; imported by install.mjs
  selftest.mjs Behavioural test: evaluates the Host half against fake DSH services
  install.mjs  Emits the paste-ready cordis_define prompt
.github/
  workflows/check.yml   Runs the pre-flight on every push and pull request
```

Both files are **plain function bodies**: `src/host.js` is the content of `code.host` and
`src/client.js` is the content of `code.client` for the `cordis_define` tool. They are plain
JavaScript — no TypeScript, JSX, or bundler — and both are syntax-checked with `new Function`.

## Host RPC surface

| Method | Purpose |
| --- | --- |
| `canvas-sessions` | Visible sessions with `cwd`, `live`, `persisted`, and durable titles. |
| `canvas-presets` | Agent presets available to new sessions. |
| `canvas-list-files` | Filesystem projection of an agent's own working directory (depth 2, capped). Takes `agentId`, not `path`. |
| `canvas-create-session` | Create/adopt a session; optionally with an explicit `cwd` and preset. |
| `canvas-fork-session` | Fork a session. |
| `canvas-read-session` | Fallback transcript reader when no live client binding exists. |
| `canvas-send-prompt` | Fallback prompt delivery (the client binding is preferred). Returns a `requestId`. |
| `canvas-abort-request` | Flips the live `AbortSignal` of a request `canvas-send-prompt` queued. |

Services are read with `ctx.get(name)` and an explicit `undefined` check, because a dynamic Host
half must tolerate a service being absent rather than assume it.

## Pre-flight checks

`scripts/check.mjs` is both the local gate and the CI gate. For each half it:

- parses the file as a function body with `new Function` — the same evaluation the Cordis evaluator performs before a package can run;
- rejects the constructs that evaluator forbids: `import`, dynamic `import()`, `require()`, `export`, TypeScript `enum` / `interface` / `as`-casts, and JSX elements;
- warns on off-guidance usage: `window.`, `document.`, native `setTimeout` / `setInterval`, `fetch`, `JSON.stringify` and `structuredClone` on live DSH objects, `eval`, `innerHTML`;
- reconciles the Client→Host RPC surface in both directions, so a `hostCall` with no matching `harness.handle` is an error and a handler the client never calls is a warning.

String literals, regex literals and comments are blanked before scanning, so English prose inside a string cannot trip the `as`-cast rule and a quote inside a regex character class cannot derail the scanner. Exit 0 means no errors; warnings never fail the run.

`scripts/selftest.mjs` tests behaviour where `check.mjs` only tests hygiene. It evaluates `src/host.js` as a function body against a harness the test owns, installs fake DSH services (`sessionQuery`, `sessionController`, `agentPresets`, `fs`) shaped to match what the handlers actually read, and calls every captured handler directly. It needs no DSH process, no Cordis runtime, and nothing to approve. `npm test` runs both.

## Using it

The plugin is a **dynamic** Cordis package: it is defined in the running DSH process with the `cordis_define` tool, then activated with `cordis_run`.

1. Run `node scripts/install.mjs` in this repository and copy the printed prompt.
2. Paste it to your DSH agent. It embeds `src/host.js` as `code.host` and `src/client.js` as `code.client`, then calls `cordis_run` on the returned package.
3. **Approve the client half.** A client package returns `awaiting-approval`; one check mark authorises the current package, two authorise future versions of the same plugin.
4. **Refresh the browser page.** A client half is loaded at page load, so an already-open page keeps running the previous version until it is reloaded.

`cordis_define` alone does not execute `apply`, request approval, or move the version pointer — `cordis_run` is what activates. Do not wait inside a single turn for the browser result.

## Version compatibility

The plugin reaches into DSH and the Cordis runtime through surfaces that are **not versioned in this repository**. It was written and verified against the DSH checkout that ships the `cordis` preset at `node_modules/@deepseek-ai/dsh-agent-presets/presets/cordis` — nothing older, nothing newer. The unversioned touchpoints are:

| Touchpoint | Half | Fails as |
| --- | --- | --- |
| `sessions.binding(id)` → `.session.prompt` | client | chat send falls back to the host RPC |
| `sessions.binding(id)` → `.eventSource.getSnapshot` / `.subscribe` | client | live transcript degrades to adaptive polling |
| `binding.session.getSnapshot()` / `.subscribe` | client | streaming status disappears |
| `sessionQuery.listSessions()` records; `header.parentSession`, `.cwd`, `.origin` | host | session list, fork lineage, working directories |
| `sessionQuery.readTitleSnapshots(ids)` | host | durable titles disappear |
| `sessionQuery.readSession(id)` to `{ session, events }` | host | fallback transcript reader |
| `sessionController.prompt({requestId, sessionId, mode, content}, signal)`, and whether it inspects `signal.aborted` during the call | host | fallback prompt delivery, and prompt cancellation |
| `sessionController.fork(...)` | host | fork |
| `agentPresets.list()` | host | preset picker empties |
| `fs.resolve(path)` → target, then `fs.listDir(target)` | host | file nodes disappear |
| Cordis slots `main` (key `agent-canvas`), `sidebar.panellist` (id `agent-canvas`), `tool.view.cordis` (key `self`) | client | the screen never appears |
| Cordis `timer` service via `ctx.timeout` / `ctx.interval` | client | graph refresh and the elapsed-seconds ticker |
| `styles.insert(css)` returned to `ctx.effect` | client | the stylesheet |

If `node scripts/check.mjs` still passes but the canvas misbehaves after a DSH upgrade, suspect one of the rows above rather than the package: the checks verify the package's own hygiene, not the runtime's shape.

## Design notes / known limits

- **State is per-process.** Nodes, agents, and positions live only in the running DSH process. A DSH restart clears the canvas. Dynamic plugins are not written to disk by DSH, which is why this repository exists: it is the durable copy.
- **The canvas never affects real sessions destructively.** Removing an agent only removes it from the canvas; it does not delete the session.
- **Baseline semantics.** "New" means *appeared after this canvas began watching that directory*. It is a heuristic for "the agent created it", not a guarantee.
- **Every Host call carries a deadline.** A Host half that never answers surfaces as a reported error instead of an interface stuck on "creating"; a create that times out re-lists sessions and adopts a matching one, since the session may exist even when the reply was lost.
- Files are laid out by index; drag positions are remembered per path in memory.
- **Prompt cancellation is best-effort.** `canvas-send-prompt` hands `sessionController.prompt` a live plugin-owned `AbortSignal` and `canvas-abort-request` flips it, so cancellation can now originate from the plugin. Whether the runtime actually stops the underlying prompt depends on it inspecting the signal during its call, which this repository cannot verify: `scripts/selftest.mjs` proves the signal behaves like a real AbortSignal against a co-operative callee, not that the real callee is co-operative.
- **`canvas-list-files` takes `agentId`, not `path`.** The working directory is read from the agent's own session record, so no path string crosses the RPC boundary and an unknown id fails cleanly. It still resolves whatever that directory is, at most depth 2 / 600 entries: a projection helper, not a sandbox.
- **The mobile breakpoint reads `window.matchMedia`.** There is no Cordis service for media queries, and guessing at one is worse than depending on the browser object, so it stays. All four call sites guard with `typeof window.matchMedia !== 'function'` and fall back to the desktop layout.
- **Polling is adaptive, not fixed.** The graph re-scans on a 1.2 s base that doubles up to 20 s while the agent/file fingerprint is unchanged, and the transcript poll uses the same scheme (1.2 s → 12 s) only when no subscription is available. Both reset to the base the moment the shape changes.

## License

MIT — see [LICENSE](LICENSE).
