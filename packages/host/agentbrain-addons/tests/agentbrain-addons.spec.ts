import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'
import { Context } from '@agentbrain-harness/cordis'
import { AgentbrainAddonsGateway, parseAddonId } from '../src/index.ts'

/** A gateway whose `script` runs `body`; the default exits 0 unless the addon id contains "bad". */
async function scriptGateway(body = '#!/bin/bash\nif [[ "$2" == *bad* ]]; then echo "boom" >&2; exit 1; fi\necho "$1 ok"\n'): Promise<AgentbrainAddonsGateway> {
  const root = await mkdtemp(join(tmpdir(), 'abh-addons-script-'))
  const script = join(root, 'addons.sh')
  await writeFile(script, body)
  await chmod(script, 0o755)
  const gateway = Object.create(AgentbrainAddonsGateway.prototype) as AgentbrainAddonsGateway
  Object.defineProperty(gateway, 'script', { value: script })
  return gateway
}

/** A gateway backed by a mock skill registry and optional preset scope. */
function skillGateway(options: {
  list?: readonly { name: string; description: string; whenToUse?: string; provider: string }[]
  get?: (name: string) => {
    name: string
    description: string
    whenToUse?: string
    provider: string
    content: string
    metadata?: Record<string, unknown>
  } | undefined
  enabled?: (name: string) => boolean
  scope?: () => Promise<object> | object
  presets?: boolean
}): { gateway: AgentbrainAddonsGateway; scopes: (object | undefined)[] } {
  const scopes: (object | undefined)[] = []
  const presets = options.presets === false
    ? undefined
    : { standingKeyFor: async () => (options.scope ? await options.scope() : { agentPreset: 'default' }) }
  const ctx = {
    get: (name: string) => (name === 'agentPresets' ? presets : undefined),
    skills: {
      list: async (view: { scope?: object }) => { scopes.push(view.scope); return options.list ?? [] },
      get: async (name: string) => options.get?.(name),
      isEnabled: (name: string) => options.enabled?.(name) ?? true,
    },
  }
  const gateway = Object.create(AgentbrainAddonsGateway.prototype) as AgentbrainAddonsGateway
  Object.defineProperty(gateway, 'ctx', { value: ctx })
  return { gateway, scopes }
}

describe('addon ids', () => {
  it('accepts lowercase hyphenated ids', () => {
    expect(parseAddonId('youtube-digest')).toBe('youtube-digest')
  })

  it.each(['', '../voice', 'Voice', 'voice/foo', 'voice;rm'])('rejects unsafe id %j', (id) => {
    expect(() => parseAddonId(id)).toThrow(/invalid addon id/)
  })
})

describe('addon inventory', () => {
  const previousRoot = process.env.AGENTBRAIN_DIR

  afterEach(() => {
    if (previousRoot === undefined) delete process.env.AGENTBRAIN_DIR
    else process.env.AGENTBRAIN_DIR = previousRoot
  })

  it('ignores filesystem metadata, prefers local manifests, and reads support', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abh-addons-'))
    process.env.AGENTBRAIN_DIR = root
    await mkdir(join(root, 'local', 'addons', 'shared-addon'), { recursive: true })
    await mkdir(join(root, 'system', 'addons', 'shared-addon'), { recursive: true })
    await writeFile(join(root, 'local', 'addons', '.DS_Store'), '')
    await writeFile(join(root, 'local', 'addons', 'shared-addon', 'manifest.md'), '---\nname: Local addon\nversion: 2.0.0\nsupport:\n  pi: full\n---\n')
    await writeFile(join(root, 'system', 'addons', 'shared-addon', 'manifest.md'), '---\nname: Bundled addon\nversion: 1.0.0\n---\n')
    const script = join(root, 'scripts', 'addons.sh')
    await mkdir(join(root, 'scripts'), { recursive: true })
    await writeFile(script, '')

    const gateway = Object.create(AgentbrainAddonsGateway.prototype) as AgentbrainAddonsGateway
    Object.defineProperty(gateway, 'script', { value: script })
    const result = await gateway.list()

    expect(result.addons).toHaveLength(1)
    expect(result.addons[0]).toMatchObject({ name: 'Local addon', version: '2.0.0', support: { pi: 'full' } })
  })

  it('surfaces a bundled addon skill and enabled state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abh-addons-'))
    process.env.AGENTBRAIN_DIR = root
    await mkdir(join(root, 'system', 'addons', 'youtube-digest'), { recursive: true })
    await writeFile(join(root, 'system', 'addons', 'youtube-digest', 'manifest.md'), '---\nname: YouTube Digest\nversion: 1.2.0\nprivacy: sends-docs\ncommand: yt-dlp\n---\n')
    await writeFile(join(root, 'system', 'addons', 'youtube-digest', 'SKILL.md'), '---\nname: yt-digest\ndescription: Sync channels\n---\n')
    await mkdir(join(root, 'local', 'addons', 'youtube-digest'), { recursive: true })
    await writeFile(join(root, 'local', 'addons', 'youtube-digest', 'enabled'), '')
    const script = join(root, 'scripts', 'addons.sh')
    await mkdir(join(root, 'scripts'), { recursive: true })
    await writeFile(script, '')

    const gateway = Object.create(AgentbrainAddonsGateway.prototype) as AgentbrainAddonsGateway
    Object.defineProperty(gateway, 'script', { value: script })
    const result = await gateway.list()

    expect(result.addons[0]).toMatchObject({
      name: 'YouTube Digest', privacy: 'sends-docs', command: 'yt-dlp', hasSkill: true, state: 'enabled',
      skills: [{ name: 'yt-digest', description: 'Sync channels' }],
    })
  })

  it('skips the template dir, reads every support level, and falls back when a name is absent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abh-addons-'))
    process.env.AGENTBRAIN_DIR = root
    await mkdir(join(root, 'system', 'addons', '_template'), { recursive: true })
    await writeFile(join(root, 'system', 'addons', '_template', 'manifest.md'), '---\nname: Template\n---\n')
    // manifestSupport reads the first support line, so give each level its own addon.
    for (const [id, level] of [['rules-addon', 'rules'], ['none-addon', 'none'], ['unknown-addon', 'unknown']] as const) {
      await mkdir(join(root, 'system', 'addons', id), { recursive: true })
      await writeFile(join(root, 'system', 'addons', id, 'manifest.md'), `---\nname: ${id}\nsupport:\n  pi: ${level}\n---\n`)
    }
    await mkdir(join(root, 'system', 'addons', 'nameless'), { recursive: true })
    await writeFile(join(root, 'system', 'addons', 'nameless', 'manifest.md'), '---\nversion: 0.1.0\n---\n')
    await writeFile(join(root, 'system', 'addons', 'nameless', 'SKILL.md'), '---\ndescription: no name here\n---\n')
    const script = join(root, 'scripts', 'addons.sh')
    await mkdir(join(root, 'scripts'), { recursive: true })
    await writeFile(script, '')

    const gateway = Object.create(AgentbrainAddonsGateway.prototype) as AgentbrainAddonsGateway
    Object.defineProperty(gateway, 'script', { value: script })
    const result = await gateway.list()

    const ids = result.addons.map(addon => addon.id)
    expect(ids).not.toContain('_template')
    expect(result.addons.find(addon => addon.id === 'rules-addon')?.support).toEqual({ pi: 'rules' })
    expect(result.addons.find(addon => addon.id === 'none-addon')?.support).toEqual({ pi: 'none' })
    expect(result.addons.find(addon => addon.id === 'unknown-addon')?.support).toEqual({ pi: 'unknown' })
    const nameless = result.addons.find(addon => addon.id === 'nameless')
    expect(nameless?.name).toBe('nameless')
    expect(nameless?.hasSkill).toBe(false)
  })

  it('mounts under the agentBrain home and resolves the script path', async () => {
    const root = '/tmp/abh-home-fixture'
    process.env.AGENTBRAIN_DIR = root
    const ctx = new Context()
    ctx.provide('skills', { list: async () => [], get: async () => undefined, isEnabled: () => true } as never)
    await ctx.plugin(AgentbrainAddonsGateway)
    const gateway = ctx.get('agentbrainAddons') as AgentbrainAddonsGateway
    expect((gateway as unknown as { script: string }).script).toBe(join(root, 'scripts', 'addons.sh'))
    await ctx.fiber.dispose()
  })
})

describe('addon operations', () => {
  it('checks and tests an addon, reporting captured output', async () => {
    const gateway = await scriptGateway()
    expect(await gateway.check('youtube-digest')).toEqual({ id: 'youtube-digest', ok: true, detail: 'check ok' })
    expect(await gateway.test('youtube-digest')).toEqual({ id: 'youtube-digest', ok: true, detail: 'test ok' })
    expect(await gateway.check('bad-addon')).toEqual({ id: 'bad-addon', ok: false, detail: 'boom' })
    expect(await gateway.test('bad-addon')).toEqual({ id: 'bad-addon', ok: false, detail: 'boom' })
  })

  it('enables and disables an addon, throwing on failure', async () => {
    const gateway = await scriptGateway()
    expect(await gateway.enable('youtube-digest')).toEqual({ id: 'youtube-digest', enabled: true })
    expect(await gateway.disable('youtube-digest')).toEqual({ id: 'youtube-digest', enabled: false })
    await expect(gateway.enable('bad-addon')).rejects.toThrow(/boom/)
    await expect(gateway.disable('bad-addon')).rejects.toThrow(/boom/)
  })

  it('throws its own message when a failing operation writes no stderr', async () => {
    const gateway = await scriptGateway('#!/bin/bash\nexit 1\n')
    await expect(gateway.enable('youtube-digest')).rejects.toThrow('addon enable failed')
    await expect(gateway.disable('youtube-digest')).rejects.toThrow('addon disable failed')
    expect(await gateway.check('youtube-digest')).toEqual({ id: 'youtube-digest', ok: false, detail: '' })
  })

  it('sets a skill policy through the registry', () => {
    const calls: [string, boolean][] = []
    const gateway = Object.create(AgentbrainAddonsGateway.prototype) as AgentbrainAddonsGateway
    Object.defineProperty(gateway, 'ctx', { value: { skills: { setEnabled: (name: string, enabled: boolean) => { calls.push([name, enabled]) } } } })
    expect(gateway.setSkillEnabled('grill-me', false)).toEqual({ name: 'grill-me', enabled: false })
    expect(calls).toEqual([['grill-me', false]])
  })
})

describe('skill inventory', () => {
  it('maps whenToUse, provider, and enablement at the default preset scope', async () => {
    const { gateway, scopes } = skillGateway({
      list: [
        { name: 'save-learning', description: 'Save an insight', whenToUse: 'after a discovery', provider: 'agentbrain' },
        { name: 'grill-me', description: 'Interview the user', provider: 'agentbrain' },
      ],
      enabled: name => name !== 'grill-me',
    })
    const result = await gateway.listSkills()
    expect(result.skills).toEqual([
      { name: 'save-learning', description: 'Save an insight', whenToUse: 'after a discovery', provider: 'agentbrain', enabled: true },
      { name: 'grill-me', description: 'Interview the user', whenToUse: null, provider: 'agentbrain', enabled: false },
    ])
    expect(scopes).toEqual([{ agentPreset: 'default' }])
  })

  it('degrades to the global layer when no preset is registered', async () => {
    const { gateway, scopes } = skillGateway({ list: [], presets: false })
    await gateway.listSkills()
    expect(scopes).toEqual([undefined])
  })

  it('degrades to the global layer when the preset scope throws', async () => {
    const { gateway, scopes } = skillGateway({ list: [], scope: () => { throw new Error('no preset') } })
    await gateway.listSkills()
    expect(scopes).toEqual([undefined])
  })

  it('loads one skill body with its frontmatter tags', async () => {
    const { gateway } = skillGateway({
      get: name => name === 'save-learning'
        ? { name, description: 'Save an insight', whenToUse: 'after a discovery', provider: 'agentbrain', content: '# body', metadata: { tags: ['brain', 42, 'learning'] } }
        : undefined,
    })
    const detail = await gateway.getSkill('save-learning')
    expect(detail).toEqual({
      name: 'save-learning', description: 'Save an insight', whenToUse: 'after a discovery',
      provider: 'agentbrain', content: '# body', tags: ['brain', 'learning'],
    })
  })

  it('returns null when no skill owns the name', async () => {
    const { gateway } = skillGateway({ get: () => undefined })
    expect(await gateway.getSkill('absent')).toBeNull()
  })

  it('reports an empty tag list when a skill has no frontmatter tags', async () => {
    const { gateway } = skillGateway({
      get: name => ({ name, description: 'd', provider: 'agentbrain', content: 'c' }),
    })
    const detail = await gateway.getSkill('whatever')
    expect(detail?.tags).toEqual([])
    expect(detail?.whenToUse).toBeNull()
  })
})
