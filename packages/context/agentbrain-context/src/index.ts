/** Inject canonical AgentBrain rules, preferences, and project context once per session. */

import { basename, dirname, join, resolve } from 'node:path'
import type { Context } from '@agentbrain-harness/cordis'
import type { Agent, PreStepDecision } from '@agentbrain-harness/agent'
import type { FsTarget } from '@agentbrain-harness/fs'
import { createUserMessage, type UserMessage } from '@agentbrain-harness/llm'
import type { Session } from '@agentbrain-harness/session'
import { resolveAgentBrainHome } from '@agentbrain-harness/home-paths'

export const name = 'agentbrain-context'
export const inject = ['agents', 'fs']

/** Runtime limits and source selection for canonical AgentBrain context. */
export interface Config {
  /** AgentBrain checkout. Defaults to the canonical AgentBrain environment contract. */
  agentBrainHome?: string
  /** Maximum bytes of core rules, preferences, and startup context. */
  maxBytes: number
  /** Maximum bytes of one project's notes. */
  maxProjectBytes: number
  /** Include local personal, organization, and team preference notes. */
  includePreferences: boolean
}

const CORE_FILES = ['system/rules.md', 'system/agent-config/shared.md', 'system/skills.md', 'system/lifecycle.md'] as const
const PROJECT_FILES = ['index.md', 'prd.md', 'decisions.md', 'deploy.md', 'changelog.md', 'context.md'] as const
const PREFERENCE_SCOPES = ['personal', 'organization', 'team'] as const

function cwdOf(agent: Agent): string { return resolve(agent.session.header.cwd ?? process.cwd()) }

async function target(ctx: Context, path: string, cwd: string, signal: AbortSignal): Promise<FsTarget | undefined> {
  const resolved = await ctx.fs.resolve(path, { cwd, signal })
  return await ctx.fs.stat(resolved, signal) === undefined ? undefined : resolved
}

async function readLimited(ctx: Context, file: FsTarget, maxBytes: number, signal: AbortSignal): Promise<string> {
  const text = await ctx.fs.readText(file, signal)
  const bytes = Buffer.byteLength(text)
  if (bytes <= maxBytes) return text
  let end = Math.max(0, Math.min(text.length, maxBytes))
  while (end > 0 && Buffer.byteLength(text.slice(0, end)) > maxBytes) end--
  return `${text.slice(0, end)}\n\n[Truncated by ABH AgentBrain context limit]`
}

async function appendFile(
  ctx: Context,
  sections: string[],
  filePath: string,
  cwd: string,
  remaining: { value: number },
  signal: AbortSignal,
): Promise<void> {
  if (remaining.value <= 0) return
  const file = await target(ctx, filePath, cwd, signal)
  if (file === undefined) return
  const text = await readLimited(ctx, file, remaining.value, signal)
  sections.push(`## ${filePath}\n\n${text.trim()}`)
  remaining.value -= Buffer.byteLength(text)
}

async function projectNames(ctx: Context, cwd: string, signal: AbortSignal): Promise<string[]> {
  const names = new Set<string>()
  let current = cwd
  while (true) {
    if (await target(ctx, join(current, '.git'), cwd, signal) !== undefined) {
      names.add(basename(current))
      break
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  names.add(basename(cwd))
  return [...names].filter(Boolean)
}

async function collect(
  ctx: Context,
  config: Config,
  agent: Agent,
  signal: AbortSignal,
): Promise<string | undefined> {
  const cwd = cwdOf(agent)
  const home = resolveAgentBrainHome(config.agentBrainHome)
  const local = await target(ctx, join(home, 'local'), cwd, signal)
  if (local === undefined) return undefined
  const sections: string[] = []
  const remaining = { value: config.maxBytes }
  for (const file of CORE_FILES) await appendFile(ctx, sections, join(home, file), cwd, remaining, signal)
  if (config.includePreferences && remaining.value > 0) {
    for (const scope of PREFERENCE_SCOPES) {
      const directory = await target(ctx, join(home, 'local', 'preferences', scope), cwd, signal)
      if (directory === undefined) continue
      for (const entry of await ctx.fs.listDir(directory, signal)) {
        if (entry.type === 'file' && entry.name.endsWith('.md')) await appendFile(ctx, sections, entry.target.displayPath, cwd, remaining, signal)
      }
    }
  }
  const projectRemaining = { value: config.maxProjectBytes }
  const names = await projectNames(ctx, cwd, signal)
  for (const project of names) {
    const projectDir = join(home, 'local', 'projects', project)
    const index = await target(ctx, join(projectDir, 'index.md'), cwd, signal)
    if (index === undefined) continue
    sections.push(`## AgentBrain project: local/projects/${project}`)
    for (const file of PROJECT_FILES) await appendFile(ctx, sections, join(projectDir, file), cwd, projectRemaining, signal)
    break
  }
  if (remaining.value > 0) await appendFile(ctx, sections, join(home, 'local', 'sessions', 'startup-context.md'), cwd, remaining, signal)
  if (sections.length === 0) return undefined
  return `# AgentBrain context\n\n${sections.join('\n\n---\n\n')}`
}

/** Register one durable, source-attributed AgentBrain context injection per session. */
export function apply(ctx: Context, config: Config): void {
  if (!Number.isSafeInteger(config.maxBytes) || config.maxBytes < 1) throw new TypeError('agentbrain-context: maxBytes must be a positive safe integer')
  if (!Number.isSafeInteger(config.maxProjectBytes) || config.maxProjectBytes < 1) throw new TypeError('agentbrain-context: maxProjectBytes must be a positive safe integer')
  const injected = new WeakSet<Session>()
  ctx.on('agent/pre-step', async ({ agent, signal }, next): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision.kind === 'reject' || injected.has(agent.session)) return decision
    signal.throwIfAborted()
    const text = await collect(ctx, config, agent, signal)
    injected.add(agent.session)
    if (text === undefined) return decision
    const message: UserMessage = createUserMessage({
      content: [{ type: 'text', text }],
      source: { kind: 'plugin', plugin: name, form: 'snapshot', sections: [{ name, text }] },
    })
    return { kind: 'enter', messages: [...decision.messages, message] }
  })
}
