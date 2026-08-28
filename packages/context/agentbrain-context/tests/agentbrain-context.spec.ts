import { afterEach, describe, expect, it } from 'vitest'
import { isAbsolute, join, relative } from 'node:path'
import { Context } from '@agentbrain-harness/cordis'
import { Session, SessionId, SESSION_FORMAT_VERSION } from '@agentbrain-harness/session'
import type { SessionEvent } from '@agentbrain-harness/session'
import AgentRegistry, { agentEvents, Inbox } from '@agentbrain-harness/agent'
import type { Agent } from '@agentbrain-harness/agent'
import { FileSystem, FsTargetKey, FsVersion } from '@agentbrain-harness/fs'
import type { FsDirEntry, FsEditOutcome, FsEditRequest, FsInfo, FsPathInfo, FsTarget, FsWriteIntent, FsWriteOutcome } from '@agentbrain-harness/fs'
import * as AgentBrainContext from '../src/index.ts'
import type { Config } from '../src/index.ts'

// ---------------------------------------------------------------------------
// Scriptable FileSystem stub — mounted via ctx.plugin() so Service constructor
// receives the context it requires.
// ---------------------------------------------------------------------------

class StubFs extends FileSystem {
  entries = new Map<string, { type: FsInfo['type']; content?: string }>()
  dirEntries = new Map<string, FsDirEntry[]>()

  override async resolve(path: string, opts?: { cwd?: string; signal?: AbortSignal }): Promise<FsTarget> {
    const abs = path.startsWith('/') ? path : join(opts?.cwd ?? '/', path)
    return { targetKey: FsTargetKey(abs), displayPath: abs }
  }

  override processPath(target: FsTarget): string { return String(target.targetKey) }
  override fileUrl(target: FsTarget): string { return `file://${target.targetKey}` }

  override contains(parent: FsTarget, child: FsTarget): boolean {
    const rel = relative(String(parent.targetKey), String(child.targetKey))
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
  }

  override async stat(target: FsTarget): Promise<FsInfo | undefined> {
    const entry = this.entries.get(String(target.targetKey))
    if (entry === undefined) return undefined
    return { type: entry.type, version: FsVersion(`v:${target.targetKey}`) }
  }

  override async lstat(path: string, opts?: { cwd?: string }): Promise<FsPathInfo | undefined> {
    const target = await this.resolve(path, opts)
    const info = await this.stat(target)
    if (info === undefined) return undefined
    return { type: info.type, version: info.version }
  }

  override async readText(target: FsTarget): Promise<string> {
    return this.entries.get(String(target.targetKey))?.content ?? ''
  }

  override async streamText(target: FsTarget): Promise<AsyncIterable<string>> {
    const content = this.entries.get(String(target.targetKey))?.content ?? ''
    return (async function* () { yield content })()
  }

  override async readBytes(): Promise<Uint8Array> {
    throw new Error('readBytes not needed in agentbrain-context tests')
  }

  override async listDir(target: FsTarget): Promise<FsDirEntry[]> {
    return this.dirEntries.get(String(target.targetKey)) ?? []
  }

  override async writeText(_target: FsTarget, _content: string, _expected?: FsWriteIntent): Promise<FsWriteOutcome> {
    return { operation: 'update', version: FsVersion('unused'), before: '', after: _content }
  }

  override async editText(_target: FsTarget, _edit: FsEditRequest): Promise<FsEditOutcome> {
    return { version: FsVersion('unused'), before: '', after: '' }
  }

  file(path: string, content = ''): this {
    this.entries.set(path, { type: 'file', content })
    return this
  }

  dir(path: string): this {
    this.entries.set(path, { type: 'directory' })
    return this
  }

  listing(dirPath: string, entries: FsDirEntry[]): this {
    this.dirEntries.set(dirPath, entries)
    return this
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOME = '/test-brain'
const CWD = '/test-workspace'

const DEFAULT_CONFIG: Config = {
  agentBrainHome: HOME,
  maxBytes: 50_000,
  maxProjectBytes: 50_000,
  includePreferences: false,
}

const contexts: Context[] = []

async function mount(config: Config): Promise<{ ctx: Context; fs: StubFs }> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(StubFs)
  const fs = ctx.fs as StubFs
  await ctx.plugin(AgentBrainContext, config)
  return { ctx, fs }
}

function makeSession(cwd?: string, seed?: readonly SessionEvent[]): Session {
  const id = SessionId('test-session')
  if (cwd === undefined) return Session.create(id, seed)
  return Session.create(id, seed, {
    version: SESSION_FORMAT_VERSION,
    id,
    createdAt: 0,
    cwd,
  })
}

function stubAgent(cwd?: string): Agent {
  const session = makeSession(cwd)
  return {
    id: SessionId('agent-1'),
    options: {},
    session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'running',
    ctx: new Context(),
    send: () => {},
    followup: () => {},
    steer: () => {},
    inject: () => { throw new Error('agentbrain-context must not call inject') },
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
}

async function fire(
  ctx: Context,
  agent: Agent,
  signal: AbortSignal = new AbortController().signal,
): Promise<{ kind: string; messages: unknown[] }> {
  // The waterfall resolves a PreStepDecision (a reject variant carries no
  // messages); the enter cases these tests assert always do, so read it as one.
  const decision = await agentEvents(ctx, agent).waterfall(
    'agent/pre-step',
    { messages: [], turn: 1, step: 1, signal },
    () => Promise.resolve({ kind: 'enter' as const, messages: [] }),
  )
  return decision as { kind: string; messages: unknown[] }
}

function extractText(decision: { kind: string; messages: unknown[] }): string {
  const msgs = decision.messages as Array<{ content: Array<{ type: string; text?: string }> }>
  return msgs[0]?.content[0]?.text ?? ''
}

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

// ---------------------------------------------------------------------------
// Config validation
// ---------------------------------------------------------------------------

describe('agentbrain-context config validation', () => {
  it('throws when maxBytes is zero', async () => {
    await expect(mount({ ...DEFAULT_CONFIG, maxBytes: 0 })).rejects.toThrow(
      /maxBytes must be a positive safe integer/,
    )
  })

  it('throws when maxBytes is negative', async () => {
    await expect(mount({ ...DEFAULT_CONFIG, maxBytes: -1 })).rejects.toThrow(
      /maxBytes must be a positive safe integer/,
    )
  })

  it('throws when maxBytes is not an integer', async () => {
    await expect(mount({ ...DEFAULT_CONFIG, maxBytes: 1.5 })).rejects.toThrow(
      /maxBytes must be a positive safe integer/,
    )
  })

  it('throws when maxProjectBytes is zero', async () => {
    await expect(mount({ ...DEFAULT_CONFIG, maxProjectBytes: 0 })).rejects.toThrow(
      /maxProjectBytes must be a positive safe integer/,
    )
  })

  it('throws when maxProjectBytes is not an integer', async () => {
    await expect(mount({ ...DEFAULT_CONFIG, maxProjectBytes: 2.7 })).rejects.toThrow(
      /maxProjectBytes must be a positive safe integer/,
    )
  })
})

// ---------------------------------------------------------------------------
// No-op when local/ is absent
// ---------------------------------------------------------------------------

describe('agentbrain-context no-op paths', () => {
  it('returns the original enter decision unchanged when local/ is absent', async () => {
    const { ctx } = await mount(DEFAULT_CONFIG)
    const agent = stubAgent(CWD)

    const decision = await fire(ctx, agent)

    expect(decision.kind).toBe('enter')
    expect(decision.messages).toHaveLength(0)
  })

  it('passes through a reject decision without collecting', async () => {
    const { ctx, fs } = await mount(DEFAULT_CONFIG)
    fs.dir(`${HOME}/local`).file(`${HOME}/system/rules.md`, 'rules')
    const agent = stubAgent(CWD)

    const decision = await agentEvents(ctx, agent).waterfall(
      'agent/pre-step',
      { messages: [], turn: 1, step: 1, signal: new AbortController().signal },
      () => Promise.resolve({ kind: 'reject' as const, reason: 'test rejection' }),
    )

    expect(decision.kind).toBe('reject')
  })

  it('does not inject on subsequent pre-steps after the first for the same session', async () => {
    const { ctx, fs } = await mount(DEFAULT_CONFIG)
    // No files → collection returns undefined, but session is still marked injected.
    fs.dir(`${HOME}/local`)
    const agent = stubAgent(CWD)

    await fire(ctx, agent)
    const second = await fire(ctx, agent)

    // Second call: session already injected, decision passes through as-is.
    expect(second.kind).toBe('enter')
    expect(second.messages).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Core file collection
// ---------------------------------------------------------------------------

describe('agentbrain-context core file injection', () => {
  it('includes a core file that exists in the injected text', async () => {
    const { ctx, fs } = await mount(DEFAULT_CONFIG)
    fs.dir(`${HOME}/local`).file(`${HOME}/system/rules.md`, 'canonical rules')
    const agent = stubAgent(CWD)

    const decision = await fire(ctx, agent)

    expect(decision.kind).toBe('enter')
    expect(decision.messages).toHaveLength(1)
    expect(extractText(decision)).toContain('canonical rules')
  })

  it('marks the injected message source as plugin/agentbrain-context/snapshot', async () => {
    const { ctx, fs } = await mount(DEFAULT_CONFIG)
    fs.dir(`${HOME}/local`).file(`${HOME}/system/rules.md`, 'rules')
    const agent = stubAgent(CWD)

    const decision = await fire(ctx, agent)

    const msg = (decision.messages as Array<{ source: { kind: string; plugin: string; form: string } }>)[0]
    expect(msg?.source.kind).toBe('plugin')
    expect(msg?.source.plugin).toBe('agentbrain-context')
    expect(msg?.source.form).toBe('snapshot')
  })

  it('appends existing core files in declaration order', async () => {
    const { ctx, fs } = await mount(DEFAULT_CONFIG)
    fs.dir(`${HOME}/local`)
    fs.file(`${HOME}/system/rules.md`, 'RULES')
    fs.file(`${HOME}/system/agent-config/shared.md`, 'SHARED')
    fs.file(`${HOME}/system/skills.md`, 'SKILLS')
    // lifecycle.md absent — skipped silently.
    const agent = stubAgent(CWD)

    const decision = await fire(ctx, agent)

    const text = extractText(decision)
    expect(text).toContain('RULES')
    expect(text).toContain('SHARED')
    expect(text).toContain('SKILLS')
    expect(text.indexOf('RULES')).toBeLessThan(text.indexOf('SHARED'))
    expect(text.indexOf('SHARED')).toBeLessThan(text.indexOf('SKILLS'))
  })

  it('skips absent core files without error and produces no message when none exist', async () => {
    const { ctx, fs } = await mount(DEFAULT_CONFIG)
    fs.dir(`${HOME}/local`)
    // No core files — all absent.
    const agent = stubAgent(CWD)

    const decision = await fire(ctx, agent)

    expect(decision.kind).toBe('enter')
    expect(decision.messages).toHaveLength(0)
  })

  it('appends startup-context.md after core files when budget allows', async () => {
    const { ctx, fs } = await mount(DEFAULT_CONFIG)
    fs.dir(`${HOME}/local`)
    fs.file(`${HOME}/system/rules.md`, 'RULES')
    fs.file(`${HOME}/local/sessions/startup-context.md`, 'STARTUP')
    const agent = stubAgent(CWD)

    const decision = await fire(ctx, agent)

    const text = extractText(decision)
    expect(text).toContain('RULES')
    expect(text).toContain('STARTUP')
    expect(text.indexOf('RULES')).toBeLessThan(text.indexOf('STARTUP'))
  })
})

// ---------------------------------------------------------------------------
// Byte-limit / truncation
// ---------------------------------------------------------------------------

describe('agentbrain-context byte truncation', () => {
  it('truncates a file that exceeds the remaining byte budget', async () => {
    const { ctx, fs } = await mount({ ...DEFAULT_CONFIG, maxBytes: 5 })
    fs.dir(`${HOME}/local`).file(`${HOME}/system/rules.md`, '1234567890')
    const agent = stubAgent(CWD)

    const decision = await fire(ctx, agent)

    const text = extractText(decision)
    expect(text).toContain('[Truncated by ABH AgentBrain context limit]')
  })

  it('skips a second file when the budget is consumed by the first', async () => {
    // 12 bytes — enough for a 10-char file but not a second.
    const { ctx, fs } = await mount({ ...DEFAULT_CONFIG, maxBytes: 12 })
    fs.dir(`${HOME}/local`)
    fs.file(`${HOME}/system/rules.md`, 'x'.repeat(10))
    fs.file(`${HOME}/system/agent-config/shared.md`, 'SHARED_CONTENT')
    const agent = stubAgent(CWD)

    const decision = await fire(ctx, agent)

    expect(extractText(decision)).not.toContain('SHARED_CONTENT')
  })

  it('truncates at a safe code-point boundary when the naive slice still exceeds the byte limit', async () => {
    // '€' is 3 bytes in UTF-8, 1 char. With maxBytes=2 the naive slice(0, 2) would be
    // '€€' (6 bytes > 2), so the while-loop must decrement end until Buffer.byteLength fits.
    // With end=1 the slice is '€' (3 bytes > 2), so end becomes 0 → empty slice + truncation notice.
    const { ctx, fs } = await mount({ ...DEFAULT_CONFIG, maxBytes: 2 })
    fs.dir(`${HOME}/local`).file(`${HOME}/system/rules.md`, '€€€')
    const agent = stubAgent(CWD)

    const decision = await fire(ctx, agent)

    const text = extractText(decision)
    expect(text).toContain('[Truncated by ABH AgentBrain context limit]')
    // No partial multi-byte sequences in the output.
    expect(text).not.toContain('€')
  })
})

// ---------------------------------------------------------------------------
// Preferences loading
// ---------------------------------------------------------------------------

describe('agentbrain-context preference loading', () => {
  it('includes .md files from the personal preference scope when includePreferences is true', async () => {
    const { ctx, fs } = await mount({ ...DEFAULT_CONFIG, includePreferences: true })
    const prefDir = `${HOME}/local/preferences/personal`
    fs.dir(`${HOME}/local`).dir(prefDir)
    const prefTarget: FsTarget = { targetKey: FsTargetKey(`${prefDir}/style.md`), displayPath: `${prefDir}/style.md` }
    const prefEntry: FsDirEntry = { name: 'style.md', type: 'file', target: prefTarget }
    fs.listing(prefDir, [prefEntry])
    fs.file(`${prefDir}/style.md`, 'PERSONAL_PREF')
    const agent = stubAgent(CWD)

    const decision = await fire(ctx, agent)

    expect(extractText(decision)).toContain('PERSONAL_PREF')
  })

  it('skips non-.md directory entries inside a preference scope', async () => {
    const { ctx, fs } = await mount({ ...DEFAULT_CONFIG, includePreferences: true })
    const prefDir = `${HOME}/local/preferences/personal`
    fs.dir(`${HOME}/local`).dir(prefDir)
    const txtTarget: FsTarget = { targetKey: FsTargetKey(`${prefDir}/ignore.txt`), displayPath: `${prefDir}/ignore.txt` }
    const txtEntry: FsDirEntry = { name: 'ignore.txt', type: 'file', target: txtTarget }
    fs.listing(prefDir, [txtEntry])
    fs.file(`${prefDir}/ignore.txt`, 'SHOULD_NOT_APPEAR')
    const agent = stubAgent(CWD)

    const decision = await fire(ctx, agent)

    expect(decision.messages).toHaveLength(0)
  })

  it('skips a preference scope directory that does not exist', async () => {
    const { ctx, fs } = await mount({ ...DEFAULT_CONFIG, includePreferences: true })
    fs.dir(`${HOME}/local`).file(`${HOME}/system/rules.md`, 'RULES')
    // No preference directories seeded — all scopes absent.
    const agent = stubAgent(CWD)

    const decision = await fire(ctx, agent)

    expect(extractText(decision)).toContain('RULES')
  })

  it('does not load preferences when includePreferences is false', async () => {
    const { ctx, fs } = await mount({ ...DEFAULT_CONFIG, includePreferences: false })
    const prefDir = `${HOME}/local/preferences/personal`
    fs.dir(`${HOME}/local`).dir(prefDir)
    const prefTarget: FsTarget = { targetKey: FsTargetKey(`${prefDir}/style.md`), displayPath: `${prefDir}/style.md` }
    const prefEntry: FsDirEntry = { name: 'style.md', type: 'file', target: prefTarget }
    fs.listing(prefDir, [prefEntry])
    fs.file(`${prefDir}/style.md`, 'PERSONAL_PREF')
    fs.file(`${HOME}/system/rules.md`, 'RULES')
    const agent = stubAgent(CWD)

    const decision = await fire(ctx, agent)

    expect(extractText(decision)).not.toContain('PERSONAL_PREF')
  })
})

// ---------------------------------------------------------------------------
// Project detection
// ---------------------------------------------------------------------------

describe('agentbrain-context project detection', () => {
  it('loads project files when a .git directory is found in the agent cwd', async () => {
    const cwd = '/my-project'
    const { ctx, fs } = await mount(DEFAULT_CONFIG)
    fs.dir(`${HOME}/local`).dir(`${cwd}/.git`)
    fs.file(`${HOME}/local/projects/my-project/index.md`, 'PROJECT_INDEX')
    const agent = stubAgent(cwd)

    const decision = await fire(ctx, agent)

    const text = extractText(decision)
    expect(text).toContain('PROJECT_INDEX')
    expect(text).toContain('local/projects/my-project')
  })

  it('adds the cwd basename as a project name candidate even without a .git marker', async () => {
    const cwd = '/workdir/my-app'
    const { ctx, fs } = await mount(DEFAULT_CONFIG)
    fs.dir(`${HOME}/local`)
    fs.file(`${HOME}/local/projects/my-app/index.md`, 'APP_INDEX')
    const agent = stubAgent(cwd)

    const decision = await fire(ctx, agent)

    expect(extractText(decision)).toContain('APP_INDEX')
  })

  it('skips the project section when the project index.md is absent', async () => {
    const cwd = '/my-project'
    const { ctx, fs } = await mount(DEFAULT_CONFIG)
    fs.dir(`${HOME}/local`).dir(`${cwd}/.git`).file(`${HOME}/system/rules.md`, 'RULES')
    const agent = stubAgent(cwd)

    const decision = await fire(ctx, agent)

    const text = extractText(decision)
    expect(text).not.toContain('AgentBrain project:')
    expect(text).toContain('RULES')
  })

  it('loads project-specific files when index.md exists', async () => {
    const cwd = '/repo'
    const { ctx, fs } = await mount(DEFAULT_CONFIG)
    fs.dir(`${HOME}/local`).dir(`${cwd}/.git`)
    fs.file(`${HOME}/local/projects/repo/index.md`, 'INDEX')
    fs.file(`${HOME}/local/projects/repo/decisions.md`, 'DECISIONS')
    const agent = stubAgent(cwd)

    const decision = await fire(ctx, agent)

    const text = extractText(decision)
    expect(text).toContain('INDEX')
    expect(text).toContain('DECISIONS')
  })

  it('uses process.cwd() as fallback when agent session carries no cwd', async () => {
    const { ctx, fs } = await mount(DEFAULT_CONFIG)
    fs.dir(`${HOME}/local`).file(`${HOME}/system/rules.md`, 'FALLBACK_RULES')
    const agent = stubAgent(undefined)

    const decision = await fire(ctx, agent)

    // Should still run without throwing.
    expect(decision.kind).toBe('enter')
  })
})

// ---------------------------------------------------------------------------
// Session-level deduplication
// ---------------------------------------------------------------------------

describe('agentbrain-context session deduplication', () => {
  it('injects context only once per session even when pre-step fires multiple times', async () => {
    const { ctx, fs } = await mount(DEFAULT_CONFIG)
    fs.dir(`${HOME}/local`).file(`${HOME}/system/rules.md`, 'RULES')
    const agent = stubAgent(CWD)

    const first = await fire(ctx, agent)
    const second = await fire(ctx, agent)

    expect(first.messages).toHaveLength(1)
    expect(second.messages).toHaveLength(0)
  })

  it('injects independently for two agents with separate sessions', async () => {
    const { ctx, fs } = await mount(DEFAULT_CONFIG)
    fs.dir(`${HOME}/local`).file(`${HOME}/system/rules.md`, 'RULES')
    const agentA = stubAgent(CWD)
    const agentB = stubAgent(CWD)

    const a = await fire(ctx, agentA)
    const b = await fire(ctx, agentB)

    expect(a.messages).toHaveLength(1)
    expect(b.messages).toHaveLength(1)
  })
})
