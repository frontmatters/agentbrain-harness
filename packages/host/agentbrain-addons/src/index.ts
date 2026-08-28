/** Host Remote gateway for the canonical agentBrain addon manager. */
import { execFile, type ExecFileException } from 'node:child_process'
import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Context } from '@agentbrain-harness/cordis'
import type {} from '@agentbrain-harness/skill'
// Type-only: merges `agentPresets` into the Context so the skills view can be
// taken at the default preset's scope, not the empty host-global layer.
import type {} from '@agentbrain-harness/agent-presets'
import { resolveAgentBrainHome } from '@agentbrain-harness/home-paths'
import { Remote, TypertRemoteService } from '@agentbrain-harness/typert-protocol'
import type { AddonCheckResult, AddonId, AddonInfo, AddonInventorySnapshot, AddonMutationResult, AddonTestResult, SkillDetail, SkillInventorySnapshot } from './types.ts'

export type * from './types.ts'

/** Maximum subprocess lifetime and captured stream size for one operation. */
export const ADDON_COMMAND_TIMEOUT_MS = 5_000
/** Maximum captured output size for one addon operation. */
export const ADDON_COMMAND_MAX_OUTPUT_BYTES = 256 * 1024
const ADDON_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Validate and brand an addon id before it reaches argv.
 * @param value Candidate addon identifier.
 * @returns Validated addon identifier.
 */
export function parseAddonId(value: string): AddonId {
  if (!ADDON_ID.test(value)) throw new Error(`invalid addon id: ${JSON.stringify(value)}`)
  return value as AddonId
}

type CommandResult = { stdout: string; stderr: string; code: number }

/** The exit code for one finished command: 0 on success, the numeric exit
 * otherwise, so every caller reads one shape (captured streams plus a code).
 */
function commandExitCode(error: ExecFileException | null): number {
  if (error === null) return 0
  // A spawn failure (missing binary) carries a string code; every caller runs
  // /bin/bash, which resolves, so the string-code arm is not reproducible here.
  /* v8 ignore next */
  if (typeof error.code !== 'number') return 1
  return error.code
}

function run(command: string, args: readonly string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(command, [...args], {
      encoding: 'utf8', timeout: ADDON_COMMAND_TIMEOUT_MS,
      maxBuffer: ADDON_COMMAND_MAX_OUTPUT_BYTES, windowsHide: true,
    }, (error, stdout, stderr) => {
      resolve({ stdout, stderr, code: commandExitCode(error) })
    })
  })
}

/** The string `tags` from a skill's parsed frontmatter, or an empty list. */
function skillTags(metadata: Readonly<Record<string, unknown>> | undefined): readonly string[] {
  const tags = metadata?.tags
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : []
}

function manifestField(document: string, field: string): string | null {
  const match = document.match(new RegExp(`^${field}:\\s*(.+?)\\s*$`, 'm'))
  return match?.[1]?.replace(/^['\"]|['\"]$/g, '') ?? null
}

function manifestSupport(document: string): Readonly<Record<string, AddonInfo['support'][string]>> {
  const support: Record<string, AddonInfo['support'][string]> = {}
  const section = document.match(/^support:\s*\r?\n([\s\S]*?)(?=^[^ \t]|\s*$)/m)?.[1] ?? ''
  for (const line of section.split(/\r?\n/)) {
    const match = line.match(/^\s{2}([a-z0-9-]+):\s*(full|rules|none|unknown)\s*$/)
    const level = match?.[2]
    if (match?.[1] !== undefined && (level === 'full' || level === 'rules' || level === 'none' || level === 'unknown')) support[match[1]] = level
  }
  return support
}

async function discoverAddonSkills(path: string): Promise<AddonInfo['skills']> {
  try {
    const document = await readFile(path, 'utf8')
    return [{ name: manifestField(document, 'name') ?? '', description: manifestField(document, 'description') }].filter(skill => skill.name.length > 0)
  } catch { return [] }
}

async function discoverAddons(root: string): Promise<AddonInfo[]> {
  const manifests: Array<{ id: AddonId; source: AddonInfo['source']; path: string; dir: string }> = []
  for (const [source, base] of [['local', join(root, 'local', 'addons')], ['bundled', join(root, 'system', 'addons')]] as const) {
    let names: string[]
    try { names = await readdir(base) } catch { continue }
    for (const name of names) {
      if (name === '_template' || !ADDON_ID.test(name)) continue
      const id = parseAddonId(name)
      const dir = join(base, name)
      const path = join(dir, 'manifest.md')
      try { await access(path) } catch { continue }
      manifests.push({ id, source, path, dir })
    }
  }
  const seen = new Set<string>()
  const result: AddonInfo[] = []
  for (const item of manifests) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    const document = await readFile(item.path, 'utf8')
    result.push({
      id: item.id, version: manifestField(document, 'version'), state: 'available', source: item.source,
      name: manifestField(document, 'name') ?? item.id, privacy: manifestField(document, 'privacy'),
      os: manifestField(document, 'os'), command: manifestField(document, 'command'),
      hasSkill: (await discoverAddonSkills(join(item.dir, 'SKILL.md'))).length > 0,
      skills: await discoverAddonSkills(join(item.dir, 'SKILL.md')),
      support: manifestSupport(document),
    })
  }
  return result
}

/** Remote-only addon management service. */
export class AgentbrainAddonsGateway extends TypertRemoteService {
  static inject = ['skills']
  private readonly script: string

  constructor(ctx: Context) {
    super(ctx, 'agentbrainAddons')
    this.script = join(resolveAgentBrainHome(), 'scripts', 'addons.sh')
  }

  /** List bundled and local addons from the canonical manager.
   * @returns Current addon inventory.
   */
  @Remote('list')
  async list(): Promise<AddonInventorySnapshot> {
    await access(this.script)
    const addons = await discoverAddons(resolveAgentBrainHome())
    const root = resolveAgentBrainHome()
    return {
      addons: await Promise.all(addons.map(async addon => ({
        ...addon,
        state: await access(join(root, 'local', 'addons', addon.id, 'enabled')).then(
          () => 'enabled' as const, () => 'available' as const,
        ),
      }))),
    }
  }

  /** Check one enabled addon without allowing shell interpolation.
   * @param id Addon identifier to check.
   * @returns Addon check result.
   */
  @Remote('check')
  async check(id: string): Promise<AddonCheckResult> {
    const addonId = parseAddonId(id)
    const result = await run('/bin/bash', [this.script, 'check', addonId])
    return { id: addonId, ok: result.code === 0, detail: (result.stdout || result.stderr).trim() }
  }

  /** Run the addon's declared manifest test through the canonical manager.
   * @param id Addon identifier to test.
   * @returns Addon test result.
   */
  @Remote('test')
  async test(id: string): Promise<AddonTestResult> {
    const addonId = parseAddonId(id)
    const result = await run('/bin/bash', [this.script, 'test', addonId])
    return { id: addonId, ok: result.code === 0, detail: (result.stdout || result.stderr).trim() }
  }

  /** Enable one addon through the canonical manager.
   * @param id Addon identifier to enable.
   * @returns Addon mutation result.
   */
  @Remote('enable')
  async enable(id: string): Promise<AddonMutationResult> {
    const addonId = parseAddonId(id)
    const result = await run('/bin/bash', [this.script, 'enable', addonId])
    if (result.code !== 0) throw new Error(result.stderr || 'addon enable failed')
    return { id: addonId, enabled: true }
  }

  /** Disable one addon through the canonical manager.
   * @param id Addon identifier to disable.
   * @returns Addon mutation result.
   */
  @Remote('disable')
  async disable(id: string): Promise<AddonMutationResult> {
    const addonId = parseAddonId(id)
    const result = await run('/bin/bash', [this.script, 'disable', addonId])
    if (result.code !== 0) throw new Error(result.stderr || 'addon disable failed')
    return { id: addonId, enabled: false }
  }

  /** The default preset's standing scope, or undefined to read the global layer.
   *
   * The host-global skill layer is empty in the web deployment (presets own
   * local discovery), so skill reads view the default preset's standing scope —
   * the same catalog a fresh session serves. A missing or broken preset degrades
   * to the global layer rather than failing the read.
   * @returns The viewing scope, or undefined for the global layer.
   */
  private async skillScope(): Promise<object | undefined> {
    const presets = this.ctx.get('agentPresets')
    if (presets === undefined) return undefined
    try { return await presets.standingKeyFor() } catch { return undefined }
  }

  /** List the skill catalog the default preset composes, without exposing local paths.
   * @returns Current skill inventory.
   */
  @Remote('listSkills')
  async listSkills(): Promise<SkillInventorySnapshot> {
    const scope = await this.skillScope()
    const skills = await this.ctx.skills.list({ scope, includeDisabled: true })
    return {
      skills: skills.map(skill => ({
        name: skill.name,
        description: skill.description,
        whenToUse: skill.whenToUse ?? null,
        provider: skill.provider,
        enabled: this.ctx.skills.isEnabled(skill.name),
      })),
    }
  }

  /** Load one skill's full instruction body for the detail view.
   * @param name Skill name to load.
   * @returns The skill detail, or null when no skill owns the name.
   */
  @Remote('getSkill')
  async getSkill(name: string): Promise<SkillDetail | null> {
    const scope = await this.skillScope()
    const skill = await this.ctx.skills.get(name, { scope })
    if (skill === undefined) return null
    return {
      name: skill.name,
      description: skill.description,
      whenToUse: skill.whenToUse ?? null,
      provider: skill.provider,
      content: skill.content,
      tags: skillTags(skill.metadata),
    }
  }

  /** Change one global skill policy; the registry enforces it for list and get.
   * @param name Skill name.
   * @param enabled Whether the skill should be enabled.
   * @returns Updated skill policy.
   */
  @Remote('setSkillEnabled')
  setSkillEnabled(name: string, enabled: boolean): { name: string; enabled: boolean } {
    this.ctx.skills.setEnabled(name, enabled)
    return { name, enabled }
  }
}

export default AgentbrainAddonsGateway
